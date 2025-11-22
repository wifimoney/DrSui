import { Clock } from "lucide-react";

export function AuditTrailWidget() {
  return (
    <div className="bg-[#030F1C] p-5 rounded-xl border border-[#011829] w-full mt-4 shadow-lg">
      <h3 className="text-white font-medium text-xs uppercase tracking-wider mb-4 flex items-center gap-2 opacity-80">
        <Clock className="size-3 text-[#4DA2FF]" />
        Immutable Chain History
      </h3>
      
      <div className="relative pl-1">
        {/* Vertical Line */}
        <div className="absolute left-[4px] top-2 bottom-2 w-px bg-slate-800/50" />
        
        <div className="space-y-5 relative">
            {/* Item 1 */}
            <div className="flex gap-3 items-center relative">
                <div className="z-10 relative flex items-center justify-center">
                    <div className="size-2 rounded-full bg-slate-600 ring-4 ring-[#030F1C]" />
                </div>
                <p className="text-slate-500 text-xs font-medium">
                    10:00 AM - Record Minted
                </p>
            </div>

            {/* Item 2 */}
            <div className="flex gap-3 items-center relative">
                <div className="z-10 relative flex items-center justify-center">
                     <div className="size-2 rounded-full bg-[#C0E6FF] ring-4 ring-[#030F1C] shadow-[0_0_8px_rgba(192,230,255,0.4)]" />
                </div>
                <p className="text-[#C0E6FF] text-xs font-medium">
                    10:05 AM - Access Key Shared
                </p>
            </div>

            {/* Item 3 */}
            <div className="flex gap-3 items-center relative">
                <div className="z-10 relative flex items-center justify-center">
                    <div className="size-2 rounded-full bg-[#4DA2FF] ring-4 ring-[#030F1C] shadow-[0_0_8px_rgba(77,162,255,0.4)]" />
                </div>
                <p className="text-[#4DA2FF] text-xs font-medium">
                    10:07 AM - AI Analysis Complete
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
