import { useState } from "react";
import { motion } from "framer-motion";

interface Props { onUpload: (isPublic: boolean) => void; uploading: boolean; }

export default function UploadSettings({ onUpload, uploading }: Props) {
  const [isPublic, setIsPublic] = useState(false);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900 mb-5">Before we analyze</h3>

      <div className="flex items-center justify-between mb-5 p-3.5 bg-slate-50 rounded-xl">
        <div>
          <p className="text-slate-900 text-sm font-medium">Visibility</p>
          <p className="text-slate-400 text-xs mt-0.5">{isPublic ? "Shared in the community" : "Only visible to you"}</p>
        </div>
        <button onClick={() => setIsPublic(!isPublic)} className={`relative w-12 h-7 rounded-full transition-colors ${isPublic ? "bg-sun-500" : "bg-slate-200"}`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${isPublic ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => onUpload(isPublic)} disabled={uploading}
        className="w-full py-3.5 bg-sun-500 hover:bg-sun-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {uploading ? (<><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Analyzing...</>) : "Upload & Analyze"}
      </motion.button>
    </motion.div>
  );
}
