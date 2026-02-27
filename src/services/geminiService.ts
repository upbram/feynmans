import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import fs from "fs";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
  },
];

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenerativeAI(key);
}

export class RateLimitError extends Error {
  constructor() {
    super("AI service is temporarily busy. Please wait a moment and try again.");
    this.name = "RateLimitError";
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`Rate limited. Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (status === 429) throw new RateLimitError();
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function teachTopic(topic: string): Promise<string> {
  const model = getClient().getGenerativeModel({ model: MODEL, safetySettings });

  const prompt = `You are a world-class teacher using the Feynman Technique. Your student wants to learn about: "${topic}".

Provide a clear, engaging explanation that:
1. Starts with a relatable analogy or everyday example
2. Breaks the concept into 3-5 key ideas, each explained simply
3. Avoids jargon — if a technical term is necessary, define it immediately
4. Uses concrete examples for each key idea
5. Ends with a brief summary and a challenge: ask the student to explain it back in their own words

Format with markdown. Keep it under 800 words. Be warm and encouraging.`;

  return withRetry(async () => {
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}

export async function chatFollowUpStream(
  topic: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  question: string,
  onChunk: (text: string) => void
): Promise<string> {
  const model = getClient().getGenerativeModel({ model: MODEL, safetySettings });

  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: `I'm learning about "${topic}" using the Feynman Technique. Please be my teacher. Use simple language, analogies, and concrete examples. Keep answers focused and under 400 words.` }],
      },
      ...history,
    ],
  });

  const result = await chat.sendMessageStream(question);
  let full = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    full += text;
    onChunk(text);
  }
  return full;
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
}

export async function analyzeVideo(
  videoPath: string,
  topic: string,
  originalLesson: string | null
): Promise<VideoAnalysis> {
  const model = getClient().getGenerativeModel({ model: MODEL, safetySettings });

  const videoData = fs.readFileSync(videoPath);
  const base64Video = videoData.toString("base64");
  const mimeType = videoPath.endsWith(".mp4") ? "video/mp4" : "video/webm";

  const prompt = `You are an expert evaluator using the Feynman Technique to assess understanding.

The student learned about "${topic}" and recorded a video of themselves explaining it back.
${originalLesson ? `\nThe original AI lesson they studied:\n${originalLesson}\n` : ""}

Watch their video explanation and evaluate it. Return a JSON object (and ONLY the JSON, no markdown fences) with these fields:

{
  "feynmanScore": <0-100 integer — how well they simplified and truly understood the concept>,
  "summary": "<2-3 sentence summary of their explanation attempt>",
  "strengths": ["<what they explained well>", ...],
  "knowledgeGaps": ["<specific concepts they missed or skipped>", ...],
  "misconceptions": ["<anything they got wrong or confused>", ...],
  "jargonUsed": ["<technical terms they used without simplifying>", ...],
  "suggestions": ["<actionable advice to improve their understanding>", ...],
  "nextStep": "<single most important thing they should study or re-explain next>"
}

Be constructive and encouraging. If the video is too short or unclear, still provide your best assessment and note it in suggestions.`;

  const text = await withRetry(async () => {
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Video } },
      { text: prompt },
    ]);
    return result.response.text().trim();
  });

  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    return JSON.parse(cleaned) as VideoAnalysis;
  } catch {
    return {
      feynmanScore: 0,
      summary: "Could not parse AI analysis. The video may have been too short or unclear.",
      strengths: [],
      knowledgeGaps: ["Unable to assess — try recording a longer explanation"],
      misconceptions: [],
      jargonUsed: [],
      suggestions: ["Record at least 30 seconds of explanation"],
      nextStep: "Try explaining the topic again with more detail",
    };
  }
}
