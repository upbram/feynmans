import { useState, useCallback, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AnimatePresence, motion } from "framer-motion";
import SignInScreen from "./components/SignInScreen";
import TopicInput from "./components/TopicInput";
import LessonView from "./components/LessonView";
import VideoRecorder from "./components/VideoRecorder";
import UploadSettings from "./components/UploadSettings";
import AnalysisView from "./components/AnalysisView";
import Dashboard from "./components/Dashboard";
import Feed from "./components/Feed";
import Notes from "./components/Notes";
import CreditsBadge from "./components/CreditsBadge";
import BuyCreditsModal from "./components/BuyCreditsModal";
import {
  getMe,
  exchangeAuthCode,
  signInWithCredential,
  logout,
  learnTopic,
  uploadVideo,
  analyzeRecording,
  type VideoAnalysis,
  type AppUser,
  createNote,
} from "./lib/api";
import { cn } from "./lib/utils";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

type LearningPhase = "topic" | "lesson" | "record" | "upload" | "analyzing" | "result";
type NavView = "learn" | "dashboard" | "feed" | "notes";

function AppInner() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [navView, setNavView] = useState<NavView>("learn");
  const [learningPhase, setLearningPhase] = useState<LearningPhase>("topic");
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState("");
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const u = await getMe(true);
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setAuthLoading(false));
    const handleLogout = () => { setUser(null); setLearningPhase("topic"); setNavView("learn"); };
    window.addEventListener("feynman:logout", handleLogout);
    return () => window.removeEventListener("feynman:logout", handleLogout);
  }, [refreshUser]);

  const handleAuthCode = async (code: string) => {
    setAuthError(null);
    try { const { user: u } = await exchangeAuthCode(code); setUser(u); }
    catch { setAuthError("Sign-in failed. Please try again."); }
  };

  const handleCredential = async (credential: string) => {
    setAuthError(null);
    try { const { user: u } = await signInWithCredential(credential); setUser(u); }
    catch { setAuthError("Sign-in failed. Please try again."); }
  };

  const handleSignOut = async () => {
    await logout().catch(() => {});
    setUser(null);
    setLearningPhase("topic");
    setNavView("learn");
  };

  const handleTopicSubmit = async (t: string) => {
    if (!user || (!user.isAdmin && user.credits < 1)) { setBuyCreditsOpen(true); return; }
    setTopic(t); setLoading(true); setError(null);
    try {
      const { lesson: l, credits, chatId: cId } = await learnTopic(t);
      setLesson(l);
      setChatId(cId);
      setUser((prev) => prev ? { ...prev, credits } : prev);
      setLearningPhase("lesson");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate lesson";
      if (msg.includes("Insufficient credits")) setBuyCreditsOpen(true);
      else setError(msg);
    } finally { setLoading(false); }
  };

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    setRecordedBlob(blob); setRecordedDuration(duration); setLearningPhase("upload");
  };

  const handleUpload = async (isPublic: boolean) => {
    if (!recordedBlob || !user) return;
    if (!user.isAdmin && user.credits < 3) { setBuyCreditsOpen(true); return; }
    setLoading(true); setLearningPhase("analyzing"); setError(null);
    try {
      const recording = await uploadVideo(recordedBlob, { topic, isPublic, aiLesson: lesson, durationSeconds: recordedDuration });
      const result = await analyzeRecording(recording.id);
      if (result.credits !== undefined) setUser((prev) => prev ? { ...prev, credits: result.credits! } : prev);
      setAnalysis(result); setLearningPhase("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload or analysis failed";
      if (msg.includes("Insufficient credits")) setBuyCreditsOpen(true);
      else setError(msg);
      setLearningPhase("upload");
    } finally { setLoading(false); }
  };

  const handleSaveNote = async (title: string, content: string, noteTopic: string) => {
    await createNote({ title, content, topic: noteTopic });
  };

  const resetToTopic = () => {
    setLearningPhase("topic"); setTopic(""); setLesson(""); setChatId("");
    setRecordedBlob(null); setAnalysis(null); setError(null); setNavView("learn");
  };
  const retryRecording = () => { setRecordedBlob(null); setAnalysis(null); setLearningPhase("record"); };

  const hasActiveSession = learningPhase !== "topic";

  const switchNav = (target: NavView) => {
    if (navView === target && target !== "learn") {
      setNavView("learn");
    } else {
      setNavView(target);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-sun-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return <SignInScreen onAuthCode={handleAuthCode} onCredential={handleCredential} error={authError} />;

  return (
    <div className="min-h-screen bg-slate-25 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={resetToTopic} className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-sun-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 tracking-tight group-hover:text-sun-600 transition-colors">
              feynmans.us
            </span>
          </button>

          <nav className="flex items-center gap-1">
            {hasActiveSession && (
              <button
                onClick={() => switchNav("learn")}
                className={cn(
                  "px-3.5 py-2 text-sm rounded-lg transition-all flex items-center gap-1.5",
                  navView === "learn" ? "text-sun-700 bg-sun-50 font-medium" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sun-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sun-500" />
                </span>
                Learning
              </button>
            )}
            <button
              onClick={() => switchNav("feed")}
              className={cn(
                "px-3.5 py-2 text-sm rounded-lg transition-all",
                navView === "feed" ? "text-sun-700 bg-sun-50 font-medium" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Community
            </button>
            <button
              onClick={() => switchNav("dashboard")}
              className={cn(
                "px-3.5 py-2 text-sm rounded-lg transition-all",
                navView === "dashboard" ? "text-sun-700 bg-sun-50 font-medium" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              My Videos
            </button>
            <button
              onClick={() => switchNav("notes")}
              className={cn(
                "px-3.5 py-2 text-sm rounded-lg transition-all",
                navView === "notes" ? "text-sun-700 bg-sun-50 font-medium" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Notes
            </button>
            <CreditsBadge credits={user.credits} onClick={() => setBuyCreditsOpen(true)} />
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-100">
              {user.avatarUrl && (
                <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full ring-2 ring-slate-100" referrerPolicy="no-referrer" />
              )}
              <button onClick={handleSignOut} className="text-slate-400 hover:text-slate-600 text-xs transition-colors">
                Sign out
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 sm:py-10">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {navView === "learn" && (
            <motion.div key="learn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {learningPhase === "topic" && <TopicInput onSubmit={handleTopicSubmit} loading={loading} />}
              {learningPhase === "lesson" && (
                <LessonView topic={topic} lesson={lesson} chatId={chatId} onReady={() => setLearningPhase("record")} onBack={resetToTopic} onSaveNote={handleSaveNote} />
              )}
              {learningPhase === "record" && <VideoRecorder topic={topic} onRecordingComplete={handleRecordingComplete} onBack={() => setLearningPhase("lesson")} />}
              {learningPhase === "upload" && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Ready to submit?</h2>
                    <p className="text-slate-500 text-sm">Choose visibility and let AI analyze <span className="text-sun-600 font-medium">(3 credits)</span></p>
                  </div>
                  <UploadSettings onUpload={handleUpload} uploading={loading} />
                </div>
              )}
              {learningPhase === "analyzing" && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-sun-50 border border-sun-200 flex items-center justify-center mb-6">
                    <svg className="animate-spin h-8 w-8 text-sun-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">Analyzing your explanation...</h2>
                  <p className="text-slate-500 text-sm max-w-xs text-center">AI is watching your video and scoring how simply you explained the concept.</p>
                </div>
              )}
              {learningPhase === "result" && analysis && <AnalysisView analysis={analysis} topic={topic} onTryAgain={retryRecording} onNewTopic={resetToTopic} />}
            </motion.div>
          )}

          {navView === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Dashboard user={user} onBack={() => switchNav("learn")} />
            </motion.div>
          )}
          {navView === "feed" && (
            <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Feed onBack={() => switchNav("learn")} />
            </motion.div>
          )}
          {navView === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Notes onBack={() => switchNav("learn")} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-white border-t border-slate-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400">
          <span>&copy; {new Date().getFullYear()} feynmans.us</span>
          <span className="italic">"If you can't explain it simply, you don't understand it well enough."</span>
        </div>
      </footer>

      <BuyCreditsModal open={buyCreditsOpen} onClose={() => setBuyCreditsOpen(false)} userId={user.id} />
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppInner />
    </GoogleOAuthProvider>
  );
}
