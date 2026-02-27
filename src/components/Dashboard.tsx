import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getUserRecordings, updateRecordingPrivacy, deleteRecording, type Recording, type AppUser } from "@/lib/api";
import { formatDate, formatDuration, getScoreColor, getScoreBg, cn } from "@/lib/utils";

interface Props { user: AppUser; onBack: () => void; }
type Tab = "all" | "private" | "public";

export default function Dashboard({ user, onBack }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { getUserRecordings().then(setRecordings).catch(console.error).finally(() => setLoading(false)); }, []);

  const filtered = recordings.filter((r) => { if (tab === "private") return !r.is_public; if (tab === "public") return r.is_public; return true; });
  const stats = {
    total: recordings.length,
    publicCount: recordings.filter((r) => r.is_public).length,
    privateCount: recordings.filter((r) => !r.is_public).length,
    avgScore: recordings.filter((r) => r.feynman_score !== null).length > 0
      ? Math.round(recordings.filter((r) => r.feynman_score !== null).reduce((sum, r) => sum + r.feynman_score!, 0) / recordings.filter((r) => r.feynman_score !== null).length)
      : null,
    bestScore: recordings.reduce((max, r) => r.feynman_score !== null && r.feynman_score > max ? r.feynman_score : max, 0),
  };

  const handleTogglePrivacy = async (rec: Recording) => {
    try { const updated = await updateRecordingPrivacy(rec.id, !rec.is_public); setRecordings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, is_public: updated.is_public } : r))); }
    catch (err) { console.error("Failed:", err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recording?")) return;
    try { await deleteRecording(id); setRecordings((prev) => prev.filter((r) => r.id !== id)); }
    catch (err) { console.error("Failed:", err); }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "private", label: "Private", count: stats.privateCount },
    { key: "public", label: "Public", count: stats.publicCount },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl mx-auto">
      <div className="mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>Back
        </button>
        <h2 className="text-3xl font-bold text-slate-900">My Recordings</h2>
        <p className="text-slate-400 text-sm mt-1">{user.displayName}'s learning journey</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total", value: stats.total, color: "text-slate-900" },
          { label: "Avg Score", value: stats.avgScore ?? "—", color: stats.avgScore ? getScoreColor(stats.avgScore) : "text-slate-300" },
          { label: "Best Score", value: stats.bestScore > 0 ? stats.bestScore : "—", color: stats.bestScore > 0 ? getScoreColor(stats.bestScore) : "text-slate-300" },
          { label: "Credits", value: user.credits, color: "text-sun-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-slate-400 text-xs tracking-wider uppercase mb-1">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-all", tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
            {t.label} <span className="ml-1 text-xs font-mono">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><svg className="animate-spin h-8 w-8 text-sun-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg mb-1">No recordings yet</p>
          <p className="text-slate-300 text-sm">Start learning a topic and record your explanation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((rec, i) => (
              <motion.div key={rec.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm">
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}>
                  <button onClick={(e) => { e.stopPropagation(); setPlayingId(playingId === rec.id ? null : rec.id); }}
                    className="w-20 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-sun-500 transition-colors ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-900 font-medium truncate">{rec.topic}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-slate-400 text-xs">{formatDate(rec.created_at)}</span>
                      {rec.duration_seconds && <span className="text-slate-300 text-xs font-mono">{formatDuration(rec.duration_seconds)}</span>}
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", rec.is_public ? "bg-sun-50 text-sun-700" : "bg-slate-50 text-slate-400")}>{rec.is_public ? "Public" : "Private"}</span>
                    </div>
                  </div>
                  {rec.feynman_score !== null ? (
                    <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center shrink-0", getScoreBg(rec.feynman_score))}>
                      <span className={cn("text-lg font-bold", getScoreColor(rec.feynman_score))}>{rec.feynman_score}</span>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0"><span className="text-slate-300 text-xs">—</span></div>
                  )}
                  <svg className={cn("w-4 h-4 text-slate-300 transition-transform shrink-0", expandedId === rec.id && "rotate-180")} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                {playingId === rec.id && <div className="px-4 pb-3"><video src={`/uploads/${rec.filename}`} controls autoPlay className="w-full rounded-xl aspect-video object-cover bg-black" /></div>}

                {expandedId === rec.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t border-slate-100 px-4 py-3">
                    {rec.analysis && (
                      <div className="mb-4">
                        <p className="text-slate-600 text-sm mb-3">{(rec.analysis as any).summary}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {(rec.analysis as any).strengths?.length > 0 && <div><p className="text-emerald-600 text-xs font-semibold uppercase mb-1">Strengths</p>{(rec.analysis as any).strengths.map((s: string, i: number) => <p key={i} className="text-slate-500 text-xs">&#8226; {s}</p>)}</div>}
                          {(rec.analysis as any).knowledgeGaps?.length > 0 && <div><p className="text-amber-600 text-xs font-semibold uppercase mb-1">Gaps</p>{(rec.analysis as any).knowledgeGaps.map((g: string, i: number) => <p key={i} className="text-slate-500 text-xs">&#8226; {g}</p>)}</div>}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleTogglePrivacy(rec)} className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors">Make {rec.is_public ? "Private" : "Public"}</button>
                      <button onClick={() => handleDelete(rec.id)} className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">Delete</button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
