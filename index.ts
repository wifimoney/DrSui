import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

async function main() {
  // Connect to Sui testnet
  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  
  console.log('=== Sponsored Transaction Demo ===\n');
  
  // In a real scenario, these would be actual keypairs
  // For demo purposes, we'll create new ones (in production, use proper key management)
  
  // User's keypair (the one initiating the transaction)
  const userKeypair = new Ed25519Keypair();
  const userAddress = userKeypair.toSuiAddress();
  
  // Sponsor's keypair (the one paying for gas)
  const sponsorKeypair = new Ed25519Keypair();
  const sponsorAddress = sponsorKeypair.toSuiAddress();
  
  console.log('User Address:', userAddress);
  console.log('Sponsor Address:', sponsorAddress);
  console.log('');
  
  // Step 1: User constructs a transaction (without gas payment)
  console.log('Step 1: User constructs transaction...');
  const tx = new Transaction();
  
  // Example: User wants to transfer SUI to another address
  // In this case, let's create a simple transaction that could be anything
  // For demo, we'll transfer 0 SUI (this is just for structure demonstration)
  const recipient = '0x1234567890123456789012345678901234567890123456789012345678901234'; // Example recipient
  
  // Note: In a real transfer, you'd use:
  // tx.transferObjects([coin], recipient);
  // But for this demo, we're just showing the sponsored transaction structure
  
  // Set the sender to the user (this is who the transaction is from)
  tx.setSender(userAddress);
  
  // Set gas budget (optional, but good practice)
  tx.setGasBudget(10000000n);
  
  // IMPORTANT: Don't set gas payment here - that will be done by the sponsor
  console.log('✓ Transaction constructed by user (no gas payment set)');
  console.log('');
  
  // Step 2: Sponsor prepares gas payment (happens before building)
  // IMPORTANT: Gas payment must be set BEFORE building the transaction
  // so both parties sign the same final transaction bytes
  console.log('Step 2: Sponsor prepares gas payment...');
  
  // Get sponsor's gas coins
  const sponsorCoins = await client.getCoins({
    owner: sponsorAddress,
    coinType: '0x2::sui::SUI',
  });
  
  if (sponsorCoins.data.length === 0) {
    console.log('⚠️  Sponsor has no SUI coins. In a real scenario, sponsor needs coins.');
    console.log('   For this demo, showing the structure only.\n');
  } else {
    // Use the first coin as gas payment
    const gasCoin = sponsorCoins.data[0];
    
    // Set gas owner to the sponsor (they're paying for gas)
    tx.setGasOwner(sponsorAddress);
    
    // Set gas payment to sponsor's coins
    tx.setGasPayment([
      {
        objectId: gasCoin.coinObjectId,
        version: gasCoin.version,
        digest: gasCoin.digest,
      },
    ]);
    
    console.log('   Sponsor sets gas owner and payment...');
    console.log('✓ Gas configuration set');
    console.log('');
    
    // Step 3: Build the transaction bytes (both parties sign these same bytes)
    console.log('Step 3: Building final transaction...');
    const transactionBytes = await tx.build({ client });
    console.log('✓ Transaction bytes prepared');
    console.log('');
    
    // Step 4: User signs the transaction
    console.log('Step 4: User signs the transaction...');
    const userSignedTx = await userKeypair.signTransaction(transactionBytes);
    const userSignature = userSignedTx.signature;
    console.log('✓ User signature created');
    console.log('');
    
    // Step 5: Sponsor signs the same transaction bytes
    console.log('Step 5: Sponsor signs the transaction...');
    const sponsorSignedTx = await sponsorKeypair.signTransaction(transactionBytes);
    const sponsorSignature = sponsorSignedTx.signature;
    console.log('✓ Sponsor signature created');
    console.log('');
    
    // Step 6: Execute with both signatures
    console.log('Step 6: Executing transaction with both signatures...');
    try {
      const result = await client.executeTransactionBlock({
        transactionBlock: transactionBytes,
        signature: [userSignature, sponsorSignature],
        options: {
          showEffects: true,
          showEvents: true,
        },
      });
      
      console.log('✓ Transaction executed successfully!');
      console.log('Transaction Digest:', result.digest);
      console.log('');
    } catch (error) {
      console.log('⚠️  Transaction execution failed (expected in demo):', error instanceof Error ? error.message : String(error));
      console.log('   This is expected if accounts have no funds or transaction is invalid.');
      console.log('');
    }
  }
  
  // Alternative: Using Transaction.sign() method (cleaner approach)
  console.log('=== Alternative Approach: Using Transaction.sign() ===\n');
  
  const tx2 = new Transaction();
  tx2.setSender(userAddress);
  tx2.setGasBudget(10000000n);
  
  // Sponsor adds gas configuration FIRST
  const sponsorCoins2 = await client.getCoins({
    owner: sponsorAddress,
    coinType: '0x2::sui::SUI',
  });
  
  if (sponsorCoins2.data.length > 0) {
    const gasCoin2 = sponsorCoins2.data[0];
    
    // Set gas owner and payment BEFORE building
    tx2.setGasOwner(sponsorAddress);
    tx2.setGasPayment([
      {
        objectId: gasCoin2.coinObjectId,
        version: gasCoin2.version,
        digest: gasCoin2.digest,
      },
    ]);
    
    // Build transaction once (both parties sign these bytes)
    const tx2Bytes = await tx2.build({ client });
    
    // User signs
    const userSignatureResult = await userKeypair.signTransaction(tx2Bytes);
    
    // Sponsor signs the SAME bytes
    const sponsorSignatureResult = await sponsorKeypair.signTransaction(tx2Bytes);
    
    // Execute with both signatures
    console.log('Executing with both signatures (alternative approach)...');
    try {
      const result = await client.executeTransactionBlock({
        transactionBlock: tx2Bytes,
        signature: [userSignatureResult.signature, sponsorSignatureResult.signature],
        options: {
          showEffects: true,
        },
      });
      
      console.log('✓ Alternative approach executed!');
      console.log('Transaction Digest:', result.digest);
    } catch (error) {
      console.log('⚠️  Execution failed (expected):', error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log('⚠️  Skipping alternative approach - sponsor has no coins');
  }
  
  console.log('\n=== Summary ===');
  console.log('Sponsored transactions flow:');
  console.log('1. User creates transaction (sets sender, adds operations)');
  console.log('2. Sponsor sets gasOwner and gasPayment BEFORE building');
  console.log('3. Build transaction bytes (both parties sign these SAME bytes)');
  console.log('4. User signs the transaction bytes');
  console.log('5. Sponsor signs the SAME transaction bytes');
  console.log('6. Execute with both signatures in array format');
  console.log('\nKey methods:');
  console.log('- tx.setSender(userAddress) - sets the transaction sender');
  console.log('- tx.setGasOwner(sponsorAddress) - sets who pays for gas');
  console.log('- tx.setGasPayment([gasCoinRefs]) - sets gas payment objects');
  console.log('- keypair.signTransaction(bytes) - signs transaction bytes');
  console.log('- client.executeTransactionBlock({ signature: [userSig, sponsorSig] })');
  console.log('\n⚠️  IMPORTANT: Gas configuration must be set BEFORE building');
  console.log('   Both parties must sign the SAME final transaction bytes!');
}

main().catch(console.error);