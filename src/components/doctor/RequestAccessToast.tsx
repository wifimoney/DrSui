import { User, X, Check } from "lucide-react";

interface RequestAccessToastProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function RequestAccessToast({ onAccept, onDecline }: RequestAccessToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50 w-96 animate-in slide-in-from-top-5 fade-in duration-500">
      <div className="bg-[#011829]/90 backdrop-blur-md border border-[#C0E6FF] rounded-xl p-4 shadow-[0_0_15px_rgba(192,230,255,0.2)] flex gap-4 items-start">
        {/* Avatar */}
        <div className="size-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0 ring-2 ring-[#C0E6FF]/30">
          <User className="size-5 text-[#C0E6FF]" />
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex justify-between items-start">
            <h4 className="text-[#C0E6FF] font-semibold text-sm leading-none mt-1">
              Patient Request
            </h4>
            <span className="text-[10px] text-[#4DA2FF] font-mono bg-[#4DA2FF]/10 px-1.5 py-0.5 rounded border border-[#4DA2FF]/20">
              5m left
            </span>
          </div>
          
          <p className="text-slate-300 text-sm leading-snug">
            <span className="font-medium text-white">John Doe</span> wants to share a record.
          </p>
          
          <p className="text-xs text-slate-500 font-medium pt-1">
            Expires in 5 mins
          </p>

          <div className="flex gap-2 mt-3">
            <button 
              onClick={onDecline}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            >
              Decline
            </button>
            <button 
              onClick={onAccept}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-white bg-[#4DA2FF] hover:bg-[#3d8bd9] shadow-[0_0_10px_rgba(77,162,255,0.3)] transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="size-3.5" />
              Accept Key
            </button>
          </div>
        </div>
        
        <button 
          onClick={onDecline}
          className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
        >
            <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
