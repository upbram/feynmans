import { useGoogleLogin } from "@react-oauth/google";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface Props {
  onAuthCode: (code: string) => void;
  onCredential: (credential: string) => void;
  error: string | null;
}

const steps = [
  {
    num: "1",
    title: "Study",
    desc: "Choose a concept and let AI break it down for you. Absorb the core ideas before you teach.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    num: "2",
    title: "Teach",
    desc: "Record yourself explaining the concept. Use plain language and avoid jargon at all costs.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    num: "3",
    title: "Refine",
    desc: "AI identifies gaps in your explanation. Go back and study the parts you struggled with.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    num: "4",
    title: "Simplify",
    desc: "Review your notes and simplify further until the essence of the concept is crystal clear.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
];

export default function SignInScreen({ onAuthCode, onCredential, error }: Props) {
  const oneTapInitialized = useRef(false);

  const login = useGoogleLogin({
    flow: "auth-code",
    ux_mode: "popup",
    select_account: true,
    onSuccess: (response) => {
      if (response.code) onAuthCode(response.code);
    },
    onError: () => {},
  });

  useEffect(() => {
    if (oneTapInitialized.current) return;
    oneTapInitialized.current = true;

    const timer = setTimeout(() => {
      try {
        const google = (window as any).google;
        if (!google?.accounts?.id) return;
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            if (response?.credential) onCredential(response.credential);
          },
          auto_select: false,
        });
        google.accounts.id.prompt();
      } catch { /* One Tap unavailable */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [onCredential]);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Nav */}
      <nav className="border-b border-slate-100 px-6 lg:px-10 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sun-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 tracking-tight">feynmans.us</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-slate-500">
            <a href="#methodology" className="hover:text-slate-900 transition-colors">Methodology</a>
            <a href="#" className="hover:text-slate-900 transition-colors">AI Feedback</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#" className="hover:text-slate-900 transition-colors">About</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => login()}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
            >
              Log in
            </button>
            <button
              onClick={() => login()}
              className="px-5 py-2.5 bg-sun-500 hover:bg-sun-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-10 pt-16 sm:pt-24 pb-20 sm:pb-28">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sun-50 border border-sun-200 text-sun-700 text-sm font-medium mb-8"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347" />
              </svg>
              THE ULTIMATE LEARNING FRAMEWORK
            </motion.div>

            <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-[1.1] mb-6">
              Learn Like a{" "}
              <br />
              <span className="font-display italic text-sun-600">Nobel Laureate.</span>
            </h1>

            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
              Master any subject using the 4-step Feynman Technique:{" "}
              <strong className="text-slate-700">Study, Teach, Refine, and Simplify.</strong>{" "}
              True understanding begins where complexity ends.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => login()}
                className="flex items-center gap-2 px-6 py-3 bg-sun-500 hover:bg-sun-600 text-white font-medium rounded-lg transition-colors"
              >
                Start Your Learning Journey
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </motion.button>
              <a
                href="#methodology"
                className="px-6 py-3 border border-slate-200 hover:border-slate-300 text-slate-700 font-medium rounded-lg transition-colors"
              >
                How it works
              </a>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm mt-4"
              >
                {error}
              </motion.p>
            )}
          </motion.div>

          {/* Decorative wave */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="hidden lg:flex items-center justify-center"
          >
            <svg viewBox="0 0 400 300" className="w-full max-w-md text-slate-400">
              <path
                d="M 20 150 Q 100 50 200 150 Q 300 250 380 150"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="200" cy="150" r="8" fill="currentColor" opacity="0.5" />
              <circle cx="330" cy="110" r="6" fill="currentColor" opacity="0.3" />
            </svg>
          </motion.div>
        </div>
      </section>

      {/* Methodology */}
      <section id="methodology" className="bg-slate-50 px-6 lg:px-10 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="font-display text-4xl text-slate-900 mb-4">The Methodology</h2>
            <p className="text-slate-500 text-lg mb-12 max-w-lg">
              The Feynman Technique is a four-step mental model designed to help you
              learn anything by explaining it simply.
            </p>
          </motion.div>

          <div className="w-full h-px bg-slate-200 mb-12" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-sun-50 flex items-center justify-center text-sun-600 mb-5">
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {step.num}. {step.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 lg:px-10 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-4xl text-slate-900 mb-4">Simple Pricing</h2>
            <p className="text-slate-500 text-lg mb-12 max-w-lg">
              Start free with 5 credits. Buy more when you need them — no subscriptions, no hidden fees.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl">
            {[
              { credits: 5, price: "Free", label: "Starter", desc: "Sign up and get started instantly", highlight: false },
              { credits: 60, price: "$2.50", label: "Popular", desc: "Best value for regular learners", highlight: true },
              { credits: 150, price: "$5.00", label: "Power", desc: "For deep-dive learning sessions", highlight: false },
            ].map((plan, i) => (
              <motion.div
                key={plan.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl p-6 border transition-all ${
                  plan.highlight
                    ? "bg-sun-500 border-sun-500 text-white shadow-lg shadow-sun-500/20 scale-[1.02]"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                {plan.highlight && (
                  <span className="inline-block px-2.5 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full mb-4">
                    Best Value
                  </span>
                )}
                <p className={`text-sm font-medium mb-1 ${plan.highlight ? "text-white/80" : "text-slate-500"}`}>
                  {plan.label}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-3xl font-bold ${plan.highlight ? "text-white" : "text-slate-900"}`}>
                    {plan.price}
                  </span>
                </div>
                <p className={`text-sm mb-4 ${plan.highlight ? "text-white/70" : "text-slate-400"}`}>
                  {plan.credits} credits
                </p>
                <p className={`text-sm leading-relaxed mb-5 ${plan.highlight ? "text-white/80" : "text-slate-500"}`}>
                  {plan.desc}
                </p>
                <button
                  onClick={() => login()}
                  className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    plan.highlight
                      ? "bg-white text-sun-600 hover:bg-white/90"
                      : "bg-sun-500 text-white hover:bg-sun-600"
                  }`}
                >
                  {plan.price === "Free" ? "Get Started Free" : "Buy Credits"}
                </button>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-400">
            <span>1 credit = 1 AI lesson</span>
            <span>3 credits = 1 video analysis</span>
            <span>Credits never expire</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 px-6 lg:px-10 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400">
          <span>&copy; {new Date().getFullYear()} feynmans.us</span>
          <span className="italic">
            "If you can't explain it simply, you don't understand it well enough."
          </span>
        </div>
      </footer>
    </div>
  );
}
