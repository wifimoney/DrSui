import { Button } from "../ui/button";
import { X } from "lucide-react";

interface PermissionSwitchProps {
  onRevoke?: () => void;
}

export function PermissionSwitch({
  onRevoke
}: PermissionSwitchProps) {
  return (
    <Button 
      variant="destructive"
      size="sm"
      className="!bg-red-500 hover:!bg-red-600 !text-white font-medium flex items-center justify-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-red-500/50 min-w-[120px]"
      onClick={onRevoke}
    >
      <X className="size-3.5 !text-white" />
      <span className="!text-white font-medium">Revoke Access</span>
    </Button>
  );
}
