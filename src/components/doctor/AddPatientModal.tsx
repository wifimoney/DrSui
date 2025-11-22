import { X, Link as LinkIcon, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useState } from "react";

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPatientModal({ isOpen, onClose }: AddPatientModalProps) {
  const [inviteLink, setInviteLink] = useState("");

  if (!isOpen) return null;

  const handleGenerateLink = () => {
    // Simulate link generation
    const uniqueId = Math.random().toString(36).substring(2, 15);
    setInviteLink(`https://drsui.app/invite/${uniqueId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-[#011829]">Invite New Patient</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-100"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-slate-700 font-medium">Patient Name</Label>
              <Input 
                id="name" 
                placeholder="Jane Doe" 
                className="border-slate-200 focus-visible:ring-[#4DA2FF]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="jane@example.com" 
                className="border-slate-200 focus-visible:ring-[#4DA2FF]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wallet" className="text-slate-700 font-medium">Wallet Address (Optional)</Label>
              <Input 
                id="wallet" 
                placeholder="0x..." 
                className="font-mono text-sm border-slate-200 focus-visible:ring-[#4DA2FF]"
              />
            </div>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-medium">Or</span>
            </div>
          </div>

          {inviteLink ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Secure Invite Link Generated</p>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="bg-white text-xs h-9 font-mono text-slate-600" />
                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => navigator.clipboard.writeText(inviteLink)}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleGenerateLink}
              className="w-full group p-4 border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 hover:border-[#4DA2FF] transition-all flex flex-col items-center gap-2 text-center"
            >
              <div className="p-2 rounded-full bg-slate-100 group-hover:bg-blue-50 transition-colors">
                <LinkIcon className="size-5 text-slate-500 group-hover:text-[#4DA2FF]" />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-[#011829]">
                Generate Secure Invitation Link
              </span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
          >
            Cancel
          </Button>
          <Button 
            className="bg-[#4DA2FF] hover:bg-[#3d8bd9] text-white shadow-md shadow-blue-500/20"
            onClick={onClose}
          >
            Send Invite
          </Button>
        </div>
      </div>
    </div>
  );
}
