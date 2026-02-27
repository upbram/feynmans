import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { getNotes, createNote, updateNote, deleteNote, type Note } from "../lib/api";

interface Props {
  onBack: () => void;
}

export default function Notes({ onBack }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getNotes().then((d) => { setNotes(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selected?.id]);

  const autoSave = useCallback((note: Note, content: string, title: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await updateNote(note.id, { title, content });
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSelected(updated);
      } catch { /* silent */ }
      finally { setSaving(false); }
    }, 800);
  }, []);

  const handleCreate = async () => {
    try {
      const note = await createNote({ title: "Untitled" });
      setNotes((prev) => [note, ...prev]);
      setSelected(note);
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch { /* silent */ }
  };

  const handleTitleChange = (title: string) => {
    if (!selected) return;
    const updated = { ...selected, title };
    setSelected(updated);
    autoSave(selected, selected.content, title);
  };

  const handleContentChange = (content: string) => {
    if (!selected) return;
    const updated = { ...selected, content };
    setSelected(updated);
    autoSave(selected, content, selected.title);
  };

  const filtered = search
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase()) ||
        (n.topic && n.topic.toLowerCase().includes(search.toLowerCase()))
      )
    : notes;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const wordCount = selected ? selected.content.split(/\s+/).filter(Boolean).length : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-sun-500 hover:bg-sun-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Note
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 min-h-[60vh]">
        {/* Sidebar list */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-100 rounded-lg text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sun-500/20 focus:border-sun-300 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[55vh]">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-slate-400 text-sm">{search ? "No matching notes" : "No notes yet"}</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filtered.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setSelected(note)}
                    className={`group px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      selected?.id === note.id ? "bg-sun-50 border border-sun-200" : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${selected?.id === note.id ? "text-sun-700" : "text-slate-900"}`}>
                          {note.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {note.content || "Empty note"}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all p-0.5 shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-300">{formatDate(note.updated_at)}</span>
                      {note.topic && (
                        <span className="px-1.5 py-0.5 bg-sun-50 text-sun-600 text-[10px] font-medium rounded">
                          {note.topic}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={selected.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full text-lg font-semibold text-slate-900 placeholder:text-slate-300 bg-transparent outline-none"
                    placeholder="Note title..."
                  />
                  {selected.topic && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-sun-50 text-sun-600 text-[11px] font-medium rounded-md">
                      {selected.topic}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0 ml-4">
                  {saving && <span className="animate-pulse">Saving...</span>}
                  <span>{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={selected.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full h-full min-h-[40vh] resize-none text-sm text-slate-700 leading-relaxed bg-transparent outline-none placeholder:text-slate-300 font-mono"
                  placeholder="Start writing...&#10;&#10;Tips:&#10;• Summarize concepts in your own words&#10;• Write questions you want to revisit&#10;• Draft explanation outlines before recording"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm mb-1">Select a note to edit</p>
              <p className="text-slate-400 text-xs">Or create a new one to get started</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
