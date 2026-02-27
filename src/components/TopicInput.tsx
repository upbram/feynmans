import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onSubmit: (topic: string) => void;
  loading: boolean;
}

const SUGGESTIONS = [
  "Quantum Entanglement",
  "How a Turbocharger Works",
  "The French Revolution",
  "Machine Learning Basics",
  "Photosynthesis",
  "Blockchain Technology",
];

export default function TopicInput({ onSubmit, loading }: Props) {
  const [topic, setTopic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !loading) onSubmit(topic.trim());
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">
          What will you{" "}
          <span className="font-display italic text-sun-600">master</span> today?
        </h1>
        <p className="text-slate-500 text-lg max-w-sm mx-auto">
          Learn a concept from AI, then record yourself teaching it back.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-8">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. How does gravity work?"
          disabled={loading}
          className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 text-lg placeholder:text-slate-300 focus:outline-none focus:border-sun-400 focus:ring-2 focus:ring-sun-100 transition-all disabled:opacity-50 shadow-sm"
        />
        <button
          type="submit"
          disabled={!topic.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-sun-500 hover:bg-sun-600 text-white font-medium rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Learning...
            </span>
          ) : "Begin"}
        </button>
      </form>

      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s, i) => (
          <motion.button
            key={s}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            onClick={() => { setTopic(s); onSubmit(s); }}
            disabled={loading}
            className="px-3.5 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-sun-700 hover:border-sun-300 hover:bg-sun-50 transition-all disabled:opacity-50 shadow-sm"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
