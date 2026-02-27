const BASE = "/api";

async function fetchJson<T>(url: string, init?: RequestInit & { _silent401?: boolean }): Promise<T> {
  const { _silent401, ...fetchInit } = init || {};
  const res = await fetch(url, {
    ...fetchInit,
    credentials: "include",
    headers: {
      ...(fetchInit?.headers as Record<string, string>),
    },
  });

  if (res.status === 401) {
    if (!_silent401) window.dispatchEvent(new Event("feynman:logout"));
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface AppUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  credits: number;
  isPremium: boolean;
  isAdmin: boolean;
}

export interface Recording {
  id: string;
  user_id: string;
  topic: string;
  filename: string;
  file_size: number;
  duration_seconds: number | null;
  is_public: boolean;
  feynman_score: number | null;
  analysis: VideoAnalysis | null;
  ai_lesson: string | null;
  created_at: string;
  display_name?: string;
}

export interface VideoAnalysis {
  feynmanScore: number;
  summary: string;
  strengths: string[];
  knowledgeGaps: string[];
  misconceptions: string[];
  jargonUsed: string[];
  suggestions: string[];
  nextStep: string;
  credits?: number;
}

export async function exchangeAuthCode(code: string): Promise<{ user: AppUser }> {
  const res = await fetch(`${BASE}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Authentication failed");
  }
  return res.json();
}

export async function signInWithCredential(credential: string): Promise<{ user: AppUser }> {
  const res = await fetch(`${BASE}/auth/google`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Authentication failed");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getMe(silent = false): Promise<AppUser> {
  return fetchJson<AppUser>(`${BASE}/me`, { _silent401: silent });
}

export async function learnTopic(topic: string): Promise<{ lesson: string; credits: number; chatId: string }> {
  return fetchJson<{ lesson: string; credits: number; chatId: string }>(`${BASE}/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
}

export async function uploadVideo(
  file: Blob,
  meta: {
    topic: string;
    isPublic: boolean;
    aiLesson: string;
    durationSeconds: number;
  }
): Promise<Recording> {
  const form = new FormData();
  form.append("video", file, "recording.webm");
  form.append("topic", meta.topic);
  form.append("isPublic", String(meta.isPublic));
  form.append("aiLesson", meta.aiLesson);
  form.append("durationSeconds", String(meta.durationSeconds));

  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Upload failed");
  }
  return res.json();
}

export async function analyzeRecording(id: string): Promise<VideoAnalysis> {
  return fetchJson<VideoAnalysis>(`${BASE}/analyze/${id}`, { method: "POST" });
}

export async function getUserRecordings(): Promise<Recording[]> {
  return fetchJson<Recording[]>(`${BASE}/recordings`);
}

export async function getGallery(limit = 20, offset = 0): Promise<Recording[]> {
  return fetchJson<Recording[]>(`${BASE}/gallery?limit=${limit}&offset=${offset}`);
}

export async function updateRecordingPrivacy(id: string, isPublic: boolean): Promise<Recording> {
  return fetchJson<Recording>(`${BASE}/recordings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPublic }),
  });
}

export async function deleteRecording(id: string): Promise<void> {
  await fetchJson<{ success: boolean }>(`${BASE}/recordings/${id}`, { method: "DELETE" });
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  topic: string | null;
  updated_at: string;
  created_at: string;
}

export async function getNotes(): Promise<Note[]> {
  return fetchJson<Note[]>(`${BASE}/notes`);
}

export async function createNote(data: { title?: string; content?: string; topic?: string }): Promise<Note> {
  return fetchJson<Note>(`${BASE}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateNote(id: string, data: { title?: string; content?: string }): Promise<Note> {
  return fetchJson<Note>(`${BASE}/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await fetchJson<{ success: boolean }>(`${BASE}/notes/${id}`, { method: "DELETE" });
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Chat {
  id: string;
  topic: string;
  created_at: string;
  message_count?: number;
  messages?: ChatMessage[];
}

export async function sendChatMessageStream(
  chatId: string,
  question: string,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch(`${BASE}/chats/${chatId}/message`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (res.status === 401) {
    window.dispatchEvent(new Event("feynman:logout"));
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");

  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.done) break;
        if (payload.error) throw new Error(payload.error);
        if (payload.chunk) {
          full += payload.chunk;
          onChunk(payload.chunk);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return full;
}

export async function getChats(): Promise<Chat[]> {
  return fetchJson<Chat[]>(`${BASE}/chats`);
}

export async function getChat(id: string): Promise<Chat & { messages: ChatMessage[] }> {
  return fetchJson<Chat & { messages: ChatMessage[] }>(`${BASE}/chats/${id}`);
}

export async function deleteChat(id: string): Promise<void> {
  await fetchJson<{ success: boolean }>(`${BASE}/chats/${id}`, { method: "DELETE" });
}
