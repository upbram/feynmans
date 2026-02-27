# Feynman Apprentice

Learn any concept from AI, then record yourself teaching it back. The AI watches your video and tells you exactly where your understanding is strong and where it needs work.

## Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Frontend      | React 18 + Vite + TypeScript        |
| Styling       | Tailwind CSS + Framer Motion        |
| Backend       | Express + TypeScript                |
| Database      | PostgreSQL (raw `pg`, no ORM)       |
| AI            | Google Gemini 2.0 Flash             |
| Video         | Browser MediaRecorder API           |
| Storage       | Local filesystem (dev) / R2 (prod)  |

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- A [Gemini API key](https://aistudio.google.com/apikey)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the database
createdb feynman

# 3. Set your Gemini API key in .env
#    Edit .env and replace your_gemini_api_key_here

# 4. Initialize the database schema
npm run db:init

# 5. Start development (runs both server + client)
npm run dev
```

The client runs on `http://localhost:5173` and proxies API requests to the server on port `3001`.

## How It Works

1. **Pick a topic** — enter anything you want to learn
2. **Learn** — read the AI-generated explanation (Phase 1)
3. **Record** — record yourself explaining it back on camera (Phase 2)
4. **Analyze** — submit your video; the AI evaluates your mastery (Phase 3)
5. **Iterate** — review your Feynman Score, fill knowledge gaps, record again

## API Routes

| Method | Route                    | Description                  |
|--------|--------------------------|------------------------------|
| POST   | `/api/user`              | Get or create user session   |
| POST   | `/api/learn`             | Generate AI lesson for topic |
| POST   | `/api/upload`            | Upload video recording       |
| POST   | `/api/analyze/:id`       | Analyze recording with AI    |
| GET    | `/api/recordings`        | List user's recordings       |
| GET    | `/api/gallery`           | Browse public recordings     |
| PATCH  | `/api/recordings/:id`    | Update privacy setting       |
| DELETE | `/api/recordings/:id`    | Delete a recording           |

## Production

```bash
npm run build
npm start
```
# feynmans
# feynmans
