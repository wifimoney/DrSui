import { ShieldCheck } from "lucide-react";

interface FileUploadProgressProps {
  progress?: number;
}

export function FileUploadProgress({ progress = 60 }: FileUploadProgressProps) {
  return (
    <div className="bg-[#011829] p-8 rounded-2xl shadow-2xl flex flex-col items-center w-80 animate-in zoom-in-95 duration-300 border border-[#C0E6FF]/20">
      {/* Percentage */}
      <div className="text-[#C0E6FF] text-5xl font-bold mb-6 font-mono">
        {progress}%
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-[#4DA2FF] transition-all duration-300 ease-out rounded-full" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status Row */}
      <div className="flex items-center justify-center gap-2 text-slate-300 w-full">
        <span className="text-xs font-medium tracking-wide">Encrypting & Minting to Walrus...</span>
        <ShieldCheck className="size-4 text-[#4DA2FF]" />
      </div>
    </div>
  );
}
