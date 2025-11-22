import { Pen, ZoomIn, Eraser, Save, Activity } from "lucide-react";

export function GhostAnnotationOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Live Editing Tag */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto z-30">
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </div>
        <span className="text-white/90 text-xs font-medium tracking-wide">Dr. Smith is annotating...</span>
      </div>

      {/* Selection Box - Positioned absolutely to simulate a selection on the X-ray */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-48 h-32 border-2 border-dashed border-[#4DA2FF] rounded-lg shadow-[0_0_15px_rgba(77,162,255,0.3)] z-20">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4DA2FF] px-3 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-wider shadow-md whitespace-nowrap">
          Fracture Detected
        </div>
        {/* Corner indicators */}
        <div className="absolute -top-1 -left-1 size-2 border-t-2 border-l-2 border-[#4DA2FF] bg-transparent" />
        <div className="absolute -top-1 -right-1 size-2 border-t-2 border-r-2 border-[#4DA2FF] bg-transparent" />
        <div className="absolute -bottom-1 -left-1 size-2 border-b-2 border-l-2 border-[#4DA2FF] bg-transparent" />
        <div className="absolute -bottom-1 -right-1 size-2 border-b-2 border-r-2 border-[#4DA2FF] bg-transparent" />
      </div>

      {/* Floating Toolbar Strip - Vertical */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto z-30">
        <button className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-[#4DA2FF] transition-colors group relative">
          <Pen className="size-5" />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Pen Tool</span>
        </button>
        <button className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-[#4DA2FF] transition-colors group relative">
          <ZoomIn className="size-5" />
           <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Zoom</span>
        </button>
        <button className="p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-red-400 transition-colors group relative">
          <Eraser className="size-5" />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Eraser</span>
        </button>
        
        <div className="w-full h-px bg-white/10 my-1" />
        
        <button className="p-3 rounded-full bg-[#4DA2FF]/20 hover:bg-[#4DA2FF]/40 text-[#4DA2FF] hover:text-white transition-colors group relative">
          <Save className="size-5" />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black/80 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Save to Chain</span>
        </button>
      </div>
    </div>
  );
}
