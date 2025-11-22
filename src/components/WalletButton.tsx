import { useState } from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Wallet, LogOut, Copy, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';

export function WalletButton() {
  const [copied, setCopied] = useState(false);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  const disconnect = useDisconnectWallet();
  const account = useCurrentAccount();

  // Debug logging for wallet connection
  console.log('WalletButton - account:', account);
  console.log('WalletButton - account.address:', account?.address);

  if (!account) {
    return (
      <ConnectModal
      trigger={
        <Button 
          className="bg-gradient-to-r from-[#00E0FF] to-[#C04BFF] hover:opacity-90 text-[#0D0E10] h-[36px] px-4 rounded-lg gap-2"
        >
          <Wallet className="h-4 w-4" />
          <span className="text-[14px] tracking-[-0.1504px]">CONNECT</span>
        </Button>
      }
      />
    );
  }
  const handleCopyAddress = async () => {
    try {
      if (!account?.address) return;
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy address');
    }
  };
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button 
          className="inline-flex items-center justify-center gap-2 px-4 h-[36px] rounded-lg border border-[#E8E9EB]/20 bg-[#1E1F24]/80 hover:bg-[#1E1F24] text-[#E8E9EB] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#00E0FF]"
        >
          <div className="h-2 w-2 rounded-full bg-[#00FFA3]" />
          <span className="text-[14px] tracking-[-0.1504px]">{formatAddress(account.address)}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-[#1E1F24] border-[#E8E9EB]/20" sideOffset={5}>
        <DropdownMenuLabel className="text-[#E8E9EB]">My Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#E8E9EB]/10" />
        <DropdownMenuItem 
          onSelect={(e) => {
            e.preventDefault();
            handleCopyAddress();
          }} 
          className="gap-2 cursor-pointer text-[#E8E9EB] focus:bg-[#0D0E10] focus:text-[#E8E9EB]"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-[#00FFA3]" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Address
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[#E8E9EB]/10" />
        <DropdownMenuItem 
          onSelect={(e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            disconnect.mutateAsync();

          }}
          className="gap-2 text-[#FF3366] focus:text-[#FF3366] focus:bg-[#0D0E10] cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
