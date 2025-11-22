import { Activity } from "lucide-react";

export function DoctorPortalSkeleton() {
  return (
    <div className="flex h-full min-h-[600px] relative bg-white animate-pulse">
      {/* Left Sidebar Skeleton */}
      <aside className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        {/* Profile Section */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-full bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-3 bg-slate-200 rounded w-16" />
            </div>
          </div>
          <div className="space-y-2 p-3 rounded-lg border border-slate-100 bg-white">
            <div className="flex justify-between">
              <div className="h-3 bg-slate-200 rounded w-12" />
              <div className="h-3 bg-slate-200 rounded w-20" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-3 bg-slate-200 rounded w-24" />
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Active Link (Simulated) */}
          <div className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-[#4DA2FF]/10 border border-[#4DA2FF]/20">
            <div className="size-5 bg-[#4DA2FF]/40 rounded" />
            <div className="h-4 bg-[#4DA2FF]/40 rounded w-24" />
          </div>
          {/* Inactive Links */}
          {[1, 2].map((i) => (
            <div key={i} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg">
              <div className="size-5 bg-slate-200 rounded" />
              <div className="h-4 bg-slate-200 rounded w-20" />
            </div>
          ))}
        </nav>

        {/* Audit Trail Skeleton */}
        <div className="p-4 mt-auto space-y-3">
          <div className="h-4 bg-slate-200 rounded w-32 mb-2" />
          {[1, 2, 3].map((i) => (
             <div key={i} className="flex gap-2">
               <div className="size-2 rounded-full bg-slate-300 mt-1" />
               <div className="space-y-1 flex-1">
                 <div className="h-3 bg-slate-200 rounded w-full" />
                 <div className="h-2 bg-slate-100 rounded w-12" />
               </div>
             </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Left Column - List Skeleton */}
        <div className="w-96 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <div className="h-6 bg-slate-200 rounded w-40 mb-2" />
            <div className="h-4 bg-slate-200 rounded w-24" />
          </div>

          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`p-6 ${i === 1 ? 'bg-slate-50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-full bg-slate-200 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-slate-200 rounded w-32" />
                      <div className="size-3 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-3 bg-slate-200 rounded w-24" />
                    <div className="h-3 bg-slate-200 rounded w-16" />
                  </div>
                </div>
                <div className={`h-9 w-full mt-4 rounded ${i === 1 ? 'bg-[#4DA2FF]/20' : 'bg-slate-100'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Detail Skeleton */}
        <div className="flex-1 bg-white p-8 overflow-y-auto">
          <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="h-8 bg-slate-200 rounded w-64" />
              <div className="h-8 bg-slate-100 rounded-full w-32" />
            </div>

            {/* X-Ray Placeholder */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg mb-6 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-50" />
              <Activity className="size-16 text-[#C0E6FF] animate-pulse relative z-10" />
              
              {/* Tools Row Skeleton */}
              <div className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t border-slate-200 px-4 flex items-center gap-4">
                <div className="size-6 bg-slate-200 rounded" />
                <div className="size-6 bg-slate-200 rounded" />
                <div className="size-6 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Metadata Section */}
            <div className="border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="h-6 bg-slate-200 rounded w-40 mb-6" />
              <div className="grid grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-20" />
                    <div className="h-4 bg-slate-100 rounded w-32" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
