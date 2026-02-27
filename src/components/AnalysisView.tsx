import { motion } from "framer-motion";
import type { VideoAnalysis } from "@/lib/api";
import { cn, getScoreColor, getScoreBg } from "@/lib/utils";

interface Props { analysis: VideoAnalysis; topic: string; onTryAgain: () => void; onNewTopic: () => void; }

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const filled = (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100" />
        <motion.circle cx="60" cy="60" r="54" fill="none" strokeWidth="6" strokeLinecap="round" className={getScoreColor(score)} stroke="currentColor"
          strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference - filled }} transition={{ duration: 1.5, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className={cn("text-4xl font-bold", getScoreColor(score))} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{score}</motion.span>
        <span className="text-slate-400 text-xs font-mono">/ 100</span>
      </div>
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-5">
      <h4 className={cn("text-xs tracking-wider uppercase font-semibold mb-2", color)}>{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="text-sm text-slate-600 flex gap-2">
            <span className="text-slate-300 mt-0.5 shrink-0">&#8226;</span>{item}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalysisView({ analysis, topic, onTryAgain, onNewTopic }: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-slate-900">
          <span className="text-slate-400">Analysis:</span>{" "}
          <span className="font-display italic text-sun-600">{topic}</span>
        </h2>
        <span className="px-3 py-1 text-xs font-medium tracking-wider uppercase bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full">Step 3 — Feedback</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className={cn("md:col-span-1 border rounded-2xl p-6 flex flex-col items-center justify-center", getScoreBg(analysis.feynmanScore))}>
          <p className="text-slate-500 text-xs tracking-wider uppercase mb-4 font-medium">Feynman Score</p>
          <ScoreRing score={analysis.feynmanScore} />
          <p className="text-slate-500 text-xs mt-4 text-center">
            {analysis.feynmanScore >= 80 ? "Excellent — you truly grasp this." : analysis.feynmanScore >= 60 ? "Solid — a few gaps remain." : "Keep going — mastery takes practice."}
          </p>
        </div>

        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <p className="text-slate-600 text-sm mb-5 leading-relaxed">{analysis.summary}</p>
          <Section title="Strengths" items={analysis.strengths} color="text-emerald-600" />
          <Section title="Knowledge Gaps" items={analysis.knowledgeGaps} color="text-amber-600" />
          <Section title="Misconceptions" items={analysis.misconceptions} color="text-red-500" />
          <Section title="Jargon Used" items={analysis.jargonUsed} color="text-slate-500" />
          <Section title="Suggestions" items={analysis.suggestions} color="text-sun-600" />
          <div className="mt-5 p-4 bg-sun-50 border border-sun-200 rounded-xl">
            <p className="text-xs tracking-wider uppercase font-semibold text-sun-700 mb-1">Next Step</p>
            <p className="text-sm text-slate-600">{analysis.nextStep}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={onTryAgain} className="flex-1 py-3.5 bg-sun-500 hover:bg-sun-600 text-white font-semibold rounded-xl transition-colors">Record Again</motion.button>
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={onNewTopic} className="flex-1 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors shadow-sm">New Topic</motion.button>
      </div>
    </motion.div>
  );
}
