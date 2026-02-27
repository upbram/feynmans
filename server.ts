import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { OAuth2Client } from "google-auth-library";
import Stripe from "stripe";
import pool from "./src/db/pool.js";
import { teachTopic, analyzeVideo, chatFollowUpStream, RateLimitError } from "./src/services/geminiService.js";
import { uploadFile, deleteFile, downloadForAnalysis } from "./src/services/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || "3001");

const UPLOADS_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

const COOKIE_NAME = "feynman_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSessionFromCookie(req: express.Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.trim().split("=")[1]);
}

function setSessionCookie(res: express.Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const CREDIT_COSTS = { learn: 1, analyze: 3 } as const;
const ADMIN_EMAILS = new Set(["upbram@gmail.com"]);

// --- Stripe webhook needs raw body, must be before express.json() ---
app.post(
  "/api/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(501).json({ error: "Stripe not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"] as string,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ error: "Invalid signature" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const credits = parseInt(session.metadata?.credits || "0");

      if (userId && credits > 0) {
        await pool.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [credits, userId]);
        await pool.query(
          "INSERT INTO transactions (user_id, amount, type, description, stripe_payment_id) VALUES ($1, $2, 'purchase', $3, $4)",
          [userId, credits, `Purchased ${credits} credits`, session.payment_intent]
        );
        console.log(`Added ${credits} credits to user ${userId}`);
      }
    }

    res.json({ received: true });
  }
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
}

// --- Multer ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files are accepted"));
  },
});

// --- DB bootstrap ---
async function bootstrap() {
  const schema = fs.readFileSync(path.join(__dirname, "src/db/schema.sql"), "utf-8");
  await pool.query(schema);
}

// --- Auth: handles both auth-code (button) and credential (One Tap) ---
app.post("/api/auth/google", async (req, res) => {
  try {
    const { code, credential } = req.body;

    let payload;

    if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else if (code) {
      const { tokens } = await googleClient.getToken({
        code,
        redirect_uri: "postmessage",
      });
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      return res.status(400).json({ error: "Auth code or credential required" });
    }

    if (!payload?.sub) return res.status(401).json({ error: "Invalid token" });

    let { rows } = await pool.query("SELECT * FROM users WHERE google_id = $1", [payload.sub]);

    const sessionToken = uuidv4();

    if (rows.length === 0) {
      const result = await pool.query(
        "INSERT INTO users (google_id, google_email, display_name, avatar_url, credits, session_token) VALUES ($1, $2, $3, $4, 5, $5) RETURNING *",
        [payload.sub, payload.email, payload.name || "Apprentice", payload.picture, sessionToken]
      );
      rows = result.rows;
    } else {
      await pool.query("UPDATE users SET session_token = $1, display_name = $2, avatar_url = $3 WHERE id = $4", [
        sessionToken, payload.name || rows[0].display_name, payload.picture || rows[0].avatar_url, rows[0].id,
      ]);
      rows[0].session_token = sessionToken;
    }

    const user = rows[0];
    setSessionCookie(res, sessionToken);

    res.json({
      user: {
        id: user.id,
        displayName: user.display_name,
        email: user.google_email,
        avatarUrl: user.avatar_url,
        credits: user.credits,
        isPremium: user.is_premium,
        isAdmin: isAdmin(user),
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// --- Auth middleware (HTTP-only cookie) ---
async function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getSessionFromCookie(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE session_token = $1", [token]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid session" });
    (req as any).user = rows[0];
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

// --- Credit check helper ---
function isAdmin(user: any): boolean {
  return ADMIN_EMAILS.has(user.google_email);
}

function requireCredits(cost: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (isAdmin(user)) return next();
    if (user.credits < cost) {
      return res.status(402).json({
        error: "Insufficient credits",
        required: cost,
        available: user.credits,
      });
    }
    next();
  };
}

async function spendCredits(userId: string, amount: number, description: string, admin = false) {
  if (admin) return;
  await pool.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [amount, userId]);
  await pool.query(
    "INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, 'spend', $3)",
    [userId, -amount, description]
  );
}

// --- Logout ---
app.post("/api/auth/logout", authenticateUser, async (req, res) => {
  const user = (req as any).user;
  await pool.query("UPDATE users SET session_token = NULL WHERE id = $1", [user.id]);
  clearSessionCookie(res);
  res.json({ success: true });
});

// --- Routes ---

// Get current user
app.get("/api/me", authenticateUser, (req, res) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    displayName: user.display_name,
    email: user.google_email,
    avatarUrl: user.avatar_url,
    credits: user.credits,
    isPremium: user.is_premium,
    isAdmin: isAdmin(user),
  });
});

// AI teaches a topic (costs 1 credit) — also creates a chat
app.post("/api/learn", authenticateUser, requireCredits(CREDIT_COSTS.learn), async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic is required" });

    const user = (req as any).user;
    const lesson = await teachTopic(topic);

    await spendCredits(user.id, CREDIT_COSTS.learn, `Lesson: ${topic}`, isAdmin(user));
    const { rows: creditRows } = await pool.query("SELECT credits FROM users WHERE id = $1", [user.id]);

    const { rows: chatRows } = await pool.query(
      "INSERT INTO chats (user_id, topic) VALUES ($1, $2) RETURNING id",
      [user.id, topic]
    );
    const chatId = chatRows[0].id;
    await pool.query(
      "INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)",
      [chatId, lesson]
    );

    res.json({ lesson, credits: creditRows[0].credits, chatId });
  } catch (err) {
    console.error("Learn error:", err);
    if (err instanceof RateLimitError) {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to generate lesson. Please try again." });
  }
});

// Send follow-up question in a chat — streams response via SSE
app.post("/api/chats/:id/message", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;
    const user = (req as any).user;

    if (!question) return res.status(400).json({ error: "Question is required" });

    const { rows: chatRows } = await pool.query("SELECT * FROM chats WHERE id = $1 AND user_id = $2", [id, user.id]);
    if (chatRows.length === 0) return res.status(404).json({ error: "Chat not found" });

    const { rows: msgRows } = await pool.query(
      "SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at",
      [id]
    );

    const history = msgRows.map((m: any) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    await pool.query(
      "INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'user', $2)",
      [id, question]
    );

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const fullReply = await chatFollowUpStream(chatRows[0].topic, history, question, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    await pool.query(
      "INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)",
      [id, fullReply]
    );
  } catch (err) {
    console.error("Chat message error:", err);
    const msg = err instanceof RateLimitError
      ? err.message
      : "Failed to get AI response. Please try again.";
    if (!res.headersSent) {
      const status = err instanceof RateLimitError ? 429 : 500;
      res.status(status).json({ error: msg });
    } else {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  }
});

// List all user's chats
app.get("/api/chats", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query(
      `SELECT c.id, c.topic, c.created_at,
        (SELECT COUNT(*) FROM chat_messages WHERE chat_id = c.id) as message_count
       FROM chats c WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
      [user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Chats list error:", err);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
});

// Get a single chat with all messages
app.get("/api/chats/:id", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows: chatRows } = await pool.query("SELECT * FROM chats WHERE id = $1 AND user_id = $2", [req.params.id, user.id]);
    if (chatRows.length === 0) return res.status(404).json({ error: "Chat not found" });

    const { rows: messages } = await pool.query(
      "SELECT id, role, content, created_at FROM chat_messages WHERE chat_id = $1 ORDER BY created_at",
      [req.params.id]
    );

    res.json({ ...chatRows[0], messages });
  } catch (err) {
    console.error("Chat get error:", err);
    res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// Delete a chat
app.delete("/api/chats/:id", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query("DELETE FROM chats WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Chat delete error:", err);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// Upload a video recording (free — analysis costs credits, not upload)
app.post("/api/upload", authenticateUser, upload.single("video"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No video file provided" });

    const user = (req as any).user;
    const { topic, isPublic, aiLesson, durationSeconds } = req.body;

    await uploadFile(file.path, file.filename);

    const { rows } = await pool.query(
      `INSERT INTO recordings (user_id, topic, filename, file_size, duration_seconds, is_public, ai_lesson)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.id, topic || "Untitled", file.filename, file.size, durationSeconds ? parseInt(durationSeconds) : null, isPublic === "true", aiLesson || null]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload video" });
  }
});

// Analyze a recording (costs 3 credits)
app.post("/api/analyze/:id", authenticateUser, requireCredits(CREDIT_COSTS.analyze), async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const { rows } = await pool.query("SELECT * FROM recordings WHERE id = $1 AND user_id = $2", [id, user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Recording not found" });

    const recording = rows[0];
    const videoPath = await downloadForAnalysis(recording.filename);

    const analysis = await analyzeVideo(videoPath, recording.topic, recording.ai_lesson);

    await pool.query("UPDATE recordings SET analysis = $1, feynman_score = $2 WHERE id = $3", [
      JSON.stringify(analysis),
      analysis.feynmanScore,
      id,
    ]);
    await spendCredits(user.id, CREDIT_COSTS.analyze, `Analysis: ${recording.topic}`, isAdmin(user));
    const updated = await pool.query("SELECT credits FROM users WHERE id = $1", [user.id]);

    res.json({ ...analysis, credits: updated.rows[0].credits });
  } catch (err) {
    console.error("Analyze error:", err);
    if (err instanceof RateLimitError) {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to analyze video. Please try again." });
  }
});

// User's recordings
app.get("/api/recordings", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM recordings WHERE user_id = $1 ORDER BY created_at DESC", [user.id]);
    res.json(rows);
  } catch (err) {
    console.error("Recordings error:", err);
    res.status(500).json({ error: "Failed to fetch recordings" });
  }
});

// Public gallery (no auth required)
app.get("/api/gallery", async (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "20"), 50);
    const offset = parseInt((req.query.offset as string) || "0");

    const { rows } = await pool.query(
      `SELECT r.id, r.topic, r.filename, r.duration_seconds, r.feynman_score, r.created_at, u.display_name
       FROM recordings r JOIN users u ON r.user_id = u.id
       WHERE r.is_public = true AND r.feynman_score IS NOT NULL
       ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    console.error("Gallery error:", err);
    res.status(500).json({ error: "Failed to fetch gallery" });
  }
});

// Update recording privacy
app.patch("/api/recordings/:id", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { isPublic } = req.body;
    const { rows } = await pool.query("UPDATE recordings SET is_public = $1 WHERE id = $2 AND user_id = $3 RETURNING *", [
      isPublic,
      req.params.id,
      user.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Recording not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Patch error:", err);
    res.status(500).json({ error: "Failed to update recording" });
  }
});

// Delete a recording
app.delete("/api/recordings/:id", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query("DELETE FROM recordings WHERE id = $1 AND user_id = $2 RETURNING filename", [
      req.params.id,
      user.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Recording not found" });

    await deleteFile(rows[0].filename);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete recording" });
  }
});

// --- Notes CRUD ---
app.get("/api/notes", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query("SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC", [user.id]);
    res.json(rows);
  } catch (err) {
    console.error("Notes list error:", err);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

app.post("/api/notes", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { title, content, topic } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO notes (user_id, title, content, topic) VALUES ($1, $2, $3, $4) RETURNING *",
      [user.id, title || "Untitled", content || "", topic || null]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Note create error:", err);
    res.status(500).json({ error: "Failed to create note" });
  }
});

app.patch("/api/notes/:id", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { title, content } = req.body;
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (content !== undefined) { sets.push(`content = $${idx++}`); vals.push(content); }
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id, user.id);

    const { rows } = await pool.query(
      `UPDATE notes SET ${sets.join(", ")} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      vals
    );
    if (rows.length === 0) return res.status(404).json({ error: "Note not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Note update error:", err);
    res.status(500).json({ error: "Failed to update note" });
  }
});

app.delete("/api/notes/:id", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id", [req.params.id, user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Note not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Note delete error:", err);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

// Transaction history
app.get("/api/transactions", authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const { rows } = await pool.query(
      "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Transactions error:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// SPA fallback
if (process.env.NODE_ENV === "production") {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  });
}

// Start listening FIRST (Cloud Run needs the port open quickly), then bootstrap DB
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  bootstrap().catch((err) => {
    console.error("DB bootstrap failed (will retry on first request):", err);
  });
});
