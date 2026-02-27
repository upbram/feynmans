import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { sendChatMessageStream, type ChatMessage } from "../lib/api";

interface Props {
  topic: string;
  lesson: string;
  chatId: string;
  onReady: () => void;
  onBack: () => void;
  onSaveNote: (title: string, content: string, topic: string) => Promise<void>;
}

export default function LessonView({ topic, lesson, chatId, onReady, onBack, onSaveNote }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "initial", role: "assistant", content: lesson, created_at: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const handleAsk = async () => {
    const q = input.trim();
    if (!q || asking) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: q, created_at: new Date().toISOString() };
    const streamMsgId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAsking(true);

    const streamMsg: ChatMessage = { id: streamMsgId, role: "assistant", content: "", created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, streamMsg]);

    try {
      await sendChatMessageStream(chatId, q, (chunk) => {
        setMessages((prev) =>
          prev.map((m) => m.id === streamMsgId ? { ...m, content: m.content + chunk } : m)
        );
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === streamMsgId
          ? { ...m, content: m.content || "Sorry, I couldn't process that. Please try again." }
          : m
        )
      );
    } finally {
      setAsking(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleSave = async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    try {
      await onSaveNote(topic, noteContent, topic);
      setSaved(true);
      setNoteContent("");
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          New topic
        </button>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-xs font-medium tracking-wider uppercase bg-sun-50 border border-sun-200 text-sun-700 rounded-full">
            Step 1 — Study
          </span>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onReady}
            className="px-5 py-2 bg-sun-500 hover:bg-sun-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Ready to explain
          </motion.button>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        <span className="text-slate-400">Learning:</span>{" "}
        <span className="font-display italic text-sun-600">{topic}</span>
      </h2>
      <p className="text-slate-400 text-sm mb-5">Ask follow-up questions below. Take notes on the right.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        {/* Chat column */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: 480 }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user"
                  ? "bg-sun-500 text-white rounded-2xl rounded-br-md px-4 py-3"
                  : "bg-slate-50 text-slate-800 rounded-2xl rounded-bl-md px-5 py-4"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="bg-slate-50 rounded-2xl rounded-bl-md px-5 py-4">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up question..."
                rows={1}
                className="flex-1 resize-none text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sun-500/20 focus:border-sun-300 transition-all placeholder:text-slate-400"
                style={{ maxHeight: 120 }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={handleAsk}
                disabled={asking || !input.trim()}
                className="shrink-0 w-10 h-10 flex items-center justify-center bg-sun-500 hover:bg-sun-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-slate-300 mt-1.5 ml-1">Press Enter to send, Shift+Enter for new line</p>
          </div>
        </div>

        {/* Notepad column */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col sticky top-24" style={{ height: "calc(100vh - 280px)", minHeight: 480 }}>
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <svg className="w-4 h-4 text-sun-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <span className="text-sm font-semibold text-slate-900">Scratchpad</span>
            <span className="text-[11px] text-slate-400 ml-auto">
              {noteContent.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>

          <div className="flex-1 p-4 overflow-hidden">
            <textarea
              value={noteContent}
              onChange={(e) => { setNoteContent(e.target.value); setSaved(false); }}
              className="w-full h-full resize-none text-sm text-slate-700 leading-relaxed bg-transparent outline-none placeholder:text-slate-300"
              placeholder={"Jot down notes as you learn...\n\n• Key concepts to remember\n• Things to clarify later\n• Your explanation outline"}
            />
          </div>

          <div className="px-4 pb-4 flex items-center gap-2">
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-emerald-600 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Saved to Notes
              </motion.span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !noteContent.trim()}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-sun-500 hover:bg-sun-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {saving ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              )}
              Save to Notes
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
