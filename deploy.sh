#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="feynman-apprentice"
DB_INSTANCE="feynman-db"
BUCKET_NAME="${PROJECT_ID}-feynman-videos"

echo "=== Deploying Feynman Apprentice to Google Cloud ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# 1. Enable required APIs
echo "--- Enabling APIs ---"
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID"

# 1b. Grant Cloud Run service account access to secrets
echo "--- Setting up IAM ---"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet

# 2. Create Cloud Storage bucket for videos
echo "--- Setting up Cloud Storage ---"
gcloud storage buckets create "gs://$BUCKET_NAME" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  2>/dev/null || echo "Bucket already exists"

CORS_FILE=$(mktemp)
echo '[{"origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600}]' > "$CORS_FILE"
gcloud storage buckets update "gs://$BUCKET_NAME" --cors-file="$CORS_FILE"
rm -f "$CORS_FILE"

# Make video objects publicly readable
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
  --member="allUsers" \
  --role="roles/storage.objectViewer" \
  2>/dev/null || true

# 3. Create Cloud SQL instance (if not exists)
echo "--- Setting up Cloud SQL ---"
gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" 2>/dev/null || \
gcloud sql instances create "$DB_INSTANCE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --storage-size=10GB \
  --storage-auto-increase

# Create database
gcloud sql databases create feynman --instance="$DB_INSTANCE" --project="$PROJECT_ID" 2>/dev/null || true

# Set postgres password
DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users set-password postgres \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD" \
  --project="$PROJECT_ID"

# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" --format="value(connectionName)")

# 4. Store secrets
echo "--- Setting up secrets ---"
store_secret() {
  local name=$1 value=$2
  echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT_ID" 2>/dev/null || \
  echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
}

store_secret "feynman-db-url" "postgresql://postgres:${DB_PASSWORD}@localhost:5432/feynman?host=/cloudsql/${CONNECTION_NAME}"

echo ""
echo "=== Manual steps ==="
echo "Store these secrets (replace with your actual values):"
echo "  echo -n 'YOUR_KEY' | gcloud secrets create feynman-gemini-key --data-file=- --project=$PROJECT_ID"
echo "  echo -n 'YOUR_ID' | gcloud secrets create feynman-google-client-id --data-file=- --project=$PROJECT_ID"
echo "  echo -n 'YOUR_SECRET' | gcloud secrets create feynman-google-client-secret --data-file=- --project=$PROJECT_ID"
echo "  echo -n 'YOUR_KEY' | gcloud secrets create feynman-stripe-secret --data-file=- --project=$PROJECT_ID"
echo "  echo -n 'YOUR_SECRET' | gcloud secrets create feynman-stripe-webhook --data-file=- --project=$PROJECT_ID"
echo ""

# 5. Build and deploy
echo "--- Building and deploying ---"
GOOGLE_CLIENT_ID_VAL="${GOOGLE_CLIENT_ID:-$(gcloud secrets versions access latest --secret=feynman-google-client-id --project="$PROJECT_ID" 2>/dev/null || echo "")}"
echo "VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID_VAL" > .env.production
gcloud builds submit --tag "gcr.io/$PROJECT_ID/$SERVICE_NAME" --project="$PROJECT_ID"
rm -f .env.production

gcloud run deploy "$SERVICE_NAME" \
  --image="gcr.io/$PROJECT_ID/$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300 \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --set-env-vars="NODE_ENV=production,GCS_BUCKET=$BUCKET_NAME" \
  --set-secrets="DATABASE_URL=feynman-db-url:latest,GEMINI_API_KEY=feynman-gemini-key:latest,GOOGLE_CLIENT_ID=feynman-google-client-id:latest,GOOGLE_CLIENT_SECRET=feynman-google-client-secret:latest,STRIPE_SECRET_KEY=feynman-stripe-secret:latest,STRIPE_WEBHOOK_SECRET=feynman-stripe-webhook:latest"

# 6. Get the URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)")
echo ""
echo "=== Deployed! ==="
echo "URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "  1. Set up custom domain: gcloud run domain-mappings create --service=$SERVICE_NAME --domain=yourdomain.com --region=$REGION"
echo "  2. Update Google OAuth redirect URIs with: $SERVICE_URL"
echo "  3. Update VITE_GOOGLE_CLIENT_ID in your build and redeploy"
echo "  4. Initialize the database schema by visiting the app"
