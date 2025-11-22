import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { X } from "lucide-react";

interface PermissionSwitchProps {
  doctorName?: string;
  specialty?: string;
  isShared?: boolean;
  onToggle?: (checked: boolean) => void;
  onRevoke?: () => void;
}

export function PermissionSwitch({
  doctorName = "Dr. Smith",
  specialty = "Radiologist",
  isShared = true,
  onToggle,
  onRevoke
}: PermissionSwitchProps) {
  return (
    <div className="bg-[#011829] rounded-2xl p-4 w-full max-w-sm shadow-lg border border-[#4DA2FF]/20">
      {/* Header Row with Doctor Info and Toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-white font-medium text-sm">{doctorName}</span>
          <span className="text-[#4DA2FF] text-xs">{specialty}</span>
        </div>
        <Switch 
          checked={isShared}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-[#C0E6FF] data-[state=unchecked]:bg-slate-700 border-2 border-transparent"
        />
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#4DA2FF]/10 border border-[#4DA2FF]/20">
          <div className="size-1.5 rounded-full bg-[#4DA2FF] animate-pulse" />
          <span className="text-[#4DA2FF] text-[10px] font-medium tracking-wide uppercase">
            Status: Key Shared via Atoma
          </span>
        </div>
      </div>

      {/* Revoke Access Button */}
      <Button 
        variant="ghost" 
        size="sm"
        className="w-full h-8 text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        onClick={onRevoke}
      >
        <X className="size-3" />
        Revoke Access
      </Button>
    </div>
  );
}
