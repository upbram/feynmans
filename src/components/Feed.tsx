import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getGallery, type Recording } from "@/lib/api";
import { formatDate, getScoreColor, cn } from "@/lib/utils";

interface Props { onBack: () => void; }
type SortBy = "recent" | "top";

export default function Feed({ onBack }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [hasMore, setHasMore] = useState(true);

  const fetchRecordings = useCallback(async (offset = 0) => {
    try { const data = await getGallery(20, offset); if (offset === 0) setRecordings(data); else setRecordings((prev) => [...prev, ...data]); if (data.length < 20) setHasMore(false); }
    catch (err) { console.error("Failed:", err); }
  }, []);

  useEffect(() => { fetchRecordings().finally(() => setLoading(false)); }, [fetchRecordings]);
  const loadMore = async () => { setLoadingMore(true); await fetchRecordings(recordings.length); setLoadingMore(false); };

  const filtered = recordings
    .filter((r) => search === "" || r.topic.toLowerCase().includes(search.toLowerCase()) || r.display_name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => { if (sortBy === "top") return (b.feynman_score ?? 0) - (a.feynman_score ?? 0); return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-3xl mx-auto">
      <div className="mb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>Back
        </button>
        <h2 className="text-3xl font-bold text-slate-900">Community</h2>
        <p className="text-slate-400 text-sm mt-1">Watch how others teach what they've learned</p>
      </div>

      <div className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topics or people..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-300 focus:outline-none focus:border-sun-400 transition-colors shadow-sm" />
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1">
          <button onClick={() => setSortBy("recent")} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-all", sortBy === "recent" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>Recent</button>
          <button onClick={() => setSortBy("top")} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-all", sortBy === "top" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>Top</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><svg className="animate-spin h-8 w-8 text-sun-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 text-lg mb-1">{search ? "No results found" : "No public recordings yet"}</p>
          <p className="text-slate-300 text-sm">{search ? "Try a different search" : "Be the first to share!"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filtered.map((rec, i) => (
              <motion.div key={rec.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors shadow-sm">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sun-400 to-red-400 flex items-center justify-center text-white text-xs font-bold">
                      {(rec.display_name || "A").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-slate-900 text-sm font-medium">{rec.display_name || "Apprentice"}</p>
                      <p className="text-slate-400 text-xs">{formatDate(rec.created_at)}</p>
                    </div>
                  </div>
                  {rec.feynman_score !== null && (
                    <div className={cn("px-2.5 py-1 rounded-lg border text-sm font-bold", getScoreColor(rec.feynman_score),
                      rec.feynman_score >= 80 ? "bg-emerald-50 border-emerald-200" : rec.feynman_score >= 60 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
                    )}>{rec.feynman_score}</div>
                  )}
                </div>
                <div className="px-5 pb-3"><h3 className="text-slate-900 font-semibold text-lg">{rec.topic}</h3></div>

                {playingId === rec.id ? (
                  <video src={`/uploads/${rec.filename}`} controls autoPlay className="w-full aspect-video object-cover bg-black" />
                ) : (
                  <button onClick={() => setPlayingId(rec.id)} className="w-full aspect-video bg-slate-100 flex items-center justify-center group relative">
                    <div className="w-16 h-16 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center group-hover:bg-white group-hover:scale-110 transition-all shadow-lg">
                      <svg className="w-7 h-7 text-slate-700 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                    {rec.duration_seconds && <span className="absolute bottom-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded-md font-mono">{Math.floor(rec.duration_seconds / 60)}:{(rec.duration_seconds % 60).toString().padStart(2, "0")}</span>}
                  </button>
                )}
                <div className="px-5 py-3 text-slate-400 text-xs tracking-wider uppercase">Feynman Technique</div>
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && !search && (
            <div className="flex justify-center pt-4">
              <button onClick={loadMore} disabled={loadingMore} className="px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 text-sm rounded-xl transition-all disabled:opacity-50 shadow-sm">
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
