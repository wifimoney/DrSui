import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

async function main() {
  // Connect to Sui testnet
  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  
  // Get network info
  const chainId = await client.getChainIdentifier();
  console.log('Connected to Sui!');
  console.log('Chain ID:', chainId);
}

main();