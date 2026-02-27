import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";

const GCS_BUCKET = process.env.GCS_BUCKET;
const useGCS = !!GCS_BUCKET;

const gcs = useGCS ? new Storage() : null;
const bucket = useGCS ? gcs!.bucket(GCS_BUCKET) : null;

export async function uploadFile(localPath: string, filename: string): Promise<string> {
  if (useGCS && bucket) {
    await bucket.upload(localPath, {
      destination: `videos/${filename}`,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    fs.unlinkSync(localPath);
    return `https://storage.googleapis.com/${GCS_BUCKET}/videos/${filename}`;
  }
  return `/uploads/${filename}`;
}

export function getVideoUrl(filename: string): string {
  if (useGCS) {
    return `https://storage.googleapis.com/${GCS_BUCKET}/videos/${filename}`;
  }
  return `/uploads/${filename}`;
}

export async function deleteFile(filename: string): Promise<void> {
  if (useGCS && bucket) {
    try {
      await bucket.file(`videos/${filename}`).delete();
    } catch {
      // File may not exist, ignore
    }
  } else {
    const uploadsDir = path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export function getLocalPath(filename: string): string {
  return path.join(process.cwd(), "uploads", filename);
}

export async function downloadForAnalysis(filename: string): Promise<string> {
  const localPath = getLocalPath(filename);
  if (fs.existsSync(localPath)) return localPath;

  if (useGCS && bucket) {
    await bucket.file(`videos/${filename}`).download({ destination: localPath });
    return localPath;
  }

  throw new Error("Video file not found");
}
