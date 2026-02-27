import { motion, AnimatePresence } from "framer-motion";

interface Props { open: boolean; onClose: () => void; userId: string; }

const PACKAGES = [
  { credits: 20, price: "$1.00", label: "Starter", stripe_link_env: "VITE_STRIPE_LINK_20" },
  { credits: 60, price: "$2.50", label: "Popular", badge: "Best Value", stripe_link_env: "VITE_STRIPE_LINK_60" },
  { credits: 150, price: "$5.00", label: "Power", stripe_link_env: "VITE_STRIPE_LINK_150" },
];

export default function BuyCreditsModal({ open, onClose, userId }: Props) {
  const handleBuy = (pkg: typeof PACKAGES[number]) => {
    const baseUrl = import.meta.env[pkg.stripe_link_env];
    if (baseUrl) window.open(`${baseUrl}?client_reference_id=${userId}`, "_blank");
    else alert("Payment links not configured yet.");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white border border-slate-200 rounded-2xl p-8 max-w-lg w-full shadow-xl">
            <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Credits</h3>
            <p className="text-slate-500 text-sm mb-6">1 credit per lesson &middot; 3 credits per analysis</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {PACKAGES.map((pkg) => (
                <button key={pkg.credits} onClick={() => handleBuy(pkg)} className="relative bg-slate-50 border border-slate-200 hover:border-sun-400 hover:bg-sun-50 rounded-xl p-4 text-center transition-all">
                  {pkg.badge && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-sun-500 text-white text-[10px] font-semibold rounded-full whitespace-nowrap">{pkg.badge}</span>}
                  <p className="text-2xl font-bold text-slate-900 mb-1">{pkg.credits}</p>
                  <p className="text-slate-400 text-xs mb-2">credits</p>
                  <p className="text-sun-600 font-semibold">{pkg.price}</p>
                </button>
              ))}
            </div>
            <p className="text-slate-400 text-xs text-center">Secure payment via Stripe.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
