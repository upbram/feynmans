import { cn } from "@/lib/utils";

interface Props { credits: number; onClick: () => void; }

export default function CreditsBadge({ credits, onClick }: Props) {
  const isLow = credits <= 3;
  return (
    <button onClick={onClick} className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-all",
      isLow ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
    )}>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
      {credits}
    </button>
  );
}
