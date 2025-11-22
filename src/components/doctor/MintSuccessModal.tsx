import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";

interface MintSuccessModalProps {
  onViewRecord: () => void;
}

export function MintSuccessModal({ onViewRecord }: MintSuccessModalProps) {
  return (
    <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-[0_0_30px_rgba(77,162,255,0.25)] border-2 border-[#4DA2FF] flex flex-col items-center text-center max-w-sm w-full animate-in fade-in zoom-in-95 duration-500">
      {/* Animated Icon */}
      <div className="mb-6 relative">
        <div className="absolute inset-0 bg-teal-100 rounded-full animate-ping opacity-20" />
        <div className="bg-teal-50 p-4 rounded-full relative z-10">
          <CheckCircle2 className="size-16 text-teal-500 animate-in spin-in-90 duration-700" />
        </div>
      </div>

      {/* Text Content */}
      <h3 className="text-2xl font-bold text-[#011829] mb-2">
        Securely Minted
      </h3>
      <p className="text-slate-500 text-sm mb-8 leading-relaxed">
        Your X-Ray is now a verified Sui Object.
      </p>

      {/* Action */}
      <Button 
        onClick={onViewRecord}
        className="w-full bg-[#011829] hover:bg-[#022c4a] text-white font-medium h-12 rounded-lg shadow-lg shadow-[#011829]/10 transition-all hover:shadow-[#011829]/20 hover:-translate-y-0.5"
      >
        View Record
      </Button>
    </div>
  );
}
