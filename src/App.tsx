import React from 'react';
import { SuiClientProvider, WalletProvider, ConnectButton } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UploadView } from './components/UploadView';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import ErrorBoundary from './ErrorBoundary';
import '@mysten/dapp-kit/dist/index.css';

// Create a QueryClient instance for React Query
const queryClient = new QueryClient();

// Define networks object with testnet URL using getFullnodeUrl
const networks = {
  testnet: {
    url: getFullnodeUrl('testnet'),
  },
};

function App() {
  const content = (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header with app title and ConnectButton */}
      <header className="bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-600 shadow-lg border-b-2 border-teal-800/20">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span className="text-4xl">🏥</span>
              <span className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
                DrSui Medical Scanner
              </span>
            </h1>
            <ConnectButton 
              className="!bg-white !text-teal-700 hover:!bg-teal-50 !border-0 !shadow-lg !font-semibold !px-6 !py-2.5 !rounded-lg transition-all hover:!shadow-xl hover:!scale-105" 
            />
          </div>
        </div>
      </header>

      {/* Main content with UploadView */}
      <main className="max-w-7xl mx-auto px-6 py-8" style={{ paddingBottom: '100px' }}>
        <UploadView />
      </main>
      
      {/* Analytics Panel - Fixed footer */}
      <AnalyticsPanel />
    </div>
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* @ts-expect-error - TypeScript doesn't recognize JSX children prop implicitly */}
        <SuiClientProvider networks={networks} defaultNetwork="testnet">
          {/* @ts-expect-error - TypeScript doesn't recognize JSX children prop implicitly */}
          <WalletProvider autoConnect>
            {content}
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
