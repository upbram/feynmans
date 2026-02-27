import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDuration } from "@/lib/utils";

interface Props {
  topic: string;
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onBack: () => void;
}

type RecordingState = "idle" | "recording" | "preview";

export default function VideoRecorder({ topic, onRecordingComplete, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(null);
    } catch { setCameraError("Camera access denied. Please allow camera and microphone access."); }
  }, []);

  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; }, []);

  useEffect(() => { startCamera(); return () => { stopCamera(); if (intervalRef.current) clearInterval(intervalRef.current); }; }, [startCamera, stopCamera]);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => { const blob = new Blob(chunksRef.current, { type: "video/webm" }); setRecordedBlob(blob); setState("preview"); if (previewRef.current) previewRef.current.src = URL.createObjectURL(blob); };
    mr.start(1000); mediaRecorderRef.current = mr; setState("recording"); setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); if (intervalRef.current) clearInterval(intervalRef.current); };
  const retake = () => { setRecordedBlob(null); setState("idle"); setElapsed(0); startCamera(); };
  const submit = () => { if (recordedBlob) onRecordingComplete(recordedBlob, elapsed); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => { stopCamera(); onBack(); }} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back to lesson
        </button>
        <span className="px-3 py-1 text-xs font-medium tracking-wider uppercase bg-red-50 border border-red-200 text-red-600 rounded-full">Step 2 — Teach</span>
      </div>

      <h2 className="text-3xl font-bold text-slate-900 mb-1">
        <span className="text-slate-400">Explain:</span>{" "}
        <span className="font-display italic text-sun-600">{topic}</span>
      </h2>
      <p className="text-slate-400 text-sm mb-8">Teach as if to a curious ten-year-old. Simplicity reveals mastery.</p>

      {cameraError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <p className="text-red-600 mb-4">{cameraError}</p>
          <button onClick={startCamera} className="px-5 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">Try Again</button>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 mb-6 shadow-sm">
          <video ref={videoRef} autoPlay muted playsInline className={cn("w-full aspect-video object-cover", state === "preview" && "hidden")} />
          <video ref={previewRef} controls playsInline className={cn("w-full aspect-video object-cover", state !== "preview" && "hidden")} />
          <AnimatePresence>
            {state === "recording" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute top-4 left-4 flex items-center gap-2.5 px-3.5 py-2 bg-black/60 backdrop-blur-sm rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-mono text-sm tracking-wider">{formatDuration(elapsed)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex gap-3">
        {state === "idle" && !cameraError && (
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={startRecording} className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-white/90" /> Start Recording
          </motion.button>
        )}
        {state === "recording" && (
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={stopRecording} className="flex-1 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5 shadow-sm">
            <span className="w-3 h-3 rounded-sm bg-red-500" /> Stop Recording
          </motion.button>
        )}
        {state === "preview" && (
          <>
            <button onClick={retake} className="flex-1 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors shadow-sm">Retake</button>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={submit} className="flex-1 py-3.5 bg-sun-500 hover:bg-sun-600 text-white font-semibold rounded-xl transition-colors">Submit for Analysis</motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}
