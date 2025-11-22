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
import { toast } from 'sonner';
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';

export function WalletButton() {
  const [copied, setCopied] = useState(false);
  const account = useCurrentAccount();
  const disconnect = useDisconnectWallet();
  if (!account) {
    return (
      <ConnectModal
      trigger={
        <Button 
        variant="default"
        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow px-6 gap-2"
        >
            <Wallet className="h-4 w-4" />
            CONNECT
          </Button>
        }
      />
    );
  }
  else {
    const formatAddress = (address: string) => {
      if (!address) return '';
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };
    const handleCopyAddress = async () => {
      try {
        await navigator.clipboard.writeText(account?.address);
        setCopied(true);
        toast.success('Address copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Failed to copy address');
      }
    };
      return (
      <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button 
            className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>{formatAddress(account.address)}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" sideOffset={5}>
          <DropdownMenuLabel>My Wallet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => {
              handleCopyAddress();
            }} 
            className="gap-2 cursor-pointer"
            >
            {copied ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Address
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onSelect={() => {
              disconnect.mutate();
            }}
            className="gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </>
    );
  }
}
