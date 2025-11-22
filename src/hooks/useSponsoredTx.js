/**
 * useSponsoredTx - React Hook for Gasless Transactions
 * 
 * This hook enables users to execute Sui transactions without paying gas fees.
 * The gas fees are paid by a "sponsor" (gas station service) instead.
 * 
 * How Gasless Transactions Work (The "Sandwich" Flow):
 * 
 * 1. Frontend builds the transaction (without gas payment)
 *    - User creates a Transaction object with their desired operations
 *    - Transaction is built into bytes (but not yet signed or executed)
 * 
 * 2. Backend sponsors the transaction (adds gas payment)
 *    - Frontend sends transaction bytes to gas station service
 *    - Gas station validates the transaction (ensures it's for our package)
 *    - Gas station sets up gas sponsorship (gasOwner, gasPayment, gasBudget)
 *    - Gas station signs the transaction with sponsor's keypair
 *    - Gas station returns signed transaction bytes + sponsor signature
 * 
 * 3. User signs the transaction (proves they authorized it)
 *    - Frontend receives the sponsored transaction bytes
 *    - User signs the transaction with their wallet
 *    - This creates the user's signature
 * 
 * 4. Execute with both signatures (user + sponsor)
 *    - Both signatures are required for execution
 *    - User signature proves the user authorized the transaction
 *    - Sponsor signature proves the sponsor authorized paying for gas
 *    - Transaction is executed on the Sui blockchain
 * 
 * Why This Flow?
 * - User doesn't need SUI to pay gas (better UX)
 * - Sponsor only pays for approved transactions (security)
 * - Both parties must sign (prevents abuse)
 * - Transaction is validated before sponsorship (cost control)
 */

import { useState, useCallback } from 'react';
import { useSuiClient, useCurrentAccount, useSignTransaction } from '@mysten/dapp-kit';
import { toBase64, fromBase64 } from '@mysten/sui/utils';

// Gas station URL - can be configured via environment variable
// Supports both Vite (import.meta.env.VITE_*) and Create React App (process.env.REACT_APP_*)
// Defaults to localhost for development
const GAS_STATION_URL = 
  process.env.REACT_APP_GAS_STATION_URL || 
  import.meta.env.VITE_GAS_STATION_URL || 
  'http://localhost:3001';

/**
 * useSponsoredTx - Hook for executing gasless transactions
 * 
 * This hook provides a simple interface for executing transactions where
 * gas fees are paid by a sponsor (gas station service) instead of the user.
 * 
 * @returns {Object} Hook return value
 * @returns {Function} executeSponsoredTransaction - Function to execute a sponsored transaction
 * @returns {boolean} loading - Whether a transaction is currently being processed
 * @returns {string|null} error - Error message if transaction failed
 * @returns {string|null} txDigest - Transaction digest of the last successful transaction
 * 
 * @example
 * ```javascript
 * const { executeSponsoredTransaction, loading, error, txDigest } = useSponsoredTx();
 * 
 * const handleMint = async () => {
 *   const tx = new Transaction();
 *   tx.moveCall({
 *     target: `${PACKAGE_ID}::module::function`,
 *     arguments: [...]
 *   });
 *   
 *   try {
 *     const result = await executeSponsoredTransaction(tx);
 *     console.log('Transaction successful:', result.digest);
 *   } catch (err) {
 *     console.error('Transaction failed:', err);
 *   }
 * };
 * ```
 */
export function useSponsoredTx() {
  // Get Sui client for executing transactions
  const client = useSuiClient();
  
  // Get current user account (wallet address)
  const account = useCurrentAccount();
  
  // Get signTransaction function from dapp-kit
  // This will prompt the user to sign with their wallet
  const { mutateAsync: signTransaction } = useSignTransaction();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txDigest, setTxDigest] = useState(null);
  
  /**
   * executeSponsoredTransaction - Execute a transaction with gas sponsorship
   * 
   * This function handles the complete flow of a sponsored transaction:
   * 1. Build transaction bytes
   * 2. Get sponsor signature from gas station
   * 3. User signs the transaction
   * 4. Execute with both signatures
   * 
   * @param {Transaction} transaction - The Sui Transaction object to execute
   * @returns {Promise<Object>} Transaction execution result
   * @throws {Error} If any step fails
   * 
   * @example
   * ```javascript
   * const tx = new Transaction();
   * tx.moveCall({
   *   target: '0x123::module::function',
   *   arguments: [arg1, arg2]
   * });
   * 
   * const result = await executeSponsoredTransaction(tx);
   * ```
   */
  const executeSponsoredTransaction = useCallback(async (transaction) => {
    // Validate account is connected
    if (!account) {
      const errorMsg = 'No wallet connected. Please connect your wallet first.';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // ===== STEP 1: Build Transaction Bytes =====
      // 
      // We build the transaction into bytes without gas payment.
      // The transaction contains the user's desired operations (MoveCall, TransferObject, etc.)
      // but doesn't specify who will pay for gas yet.
      //
      // `onlyTransactionKind: true` means we only build the transaction operations,
      // not the full transaction block (which includes gas payment).
      console.log('Step 1: Building transaction bytes...');
      
      const transactionBytes = await transaction.build({ 
        client, 
        onlyTransactionKind: true 
      });
      
      // Convert bytes to base64 for transmission over HTTP
      const base64Bytes = toBase64(transactionBytes);
      
      console.log('Step 1: ✅ Built transaction bytes', {
        bytesLength: transactionBytes.length,
        base64Length: base64Bytes.length
      });
      
      // ===== STEP 2: Get Sponsor Signature =====
      //
      // We send the transaction bytes to the gas station service.
      // The gas station will:
      // - Validate the transaction (ensure it targets our package)
      // - Set up gas sponsorship (gasOwner, gasPayment, gasBudget)
      // - Sign the transaction with sponsor's keypair
      // - Return the final transaction bytes + sponsor signature
      //
      // This is where the "sponsorship" happens - the gas station adds
      // its gas payment and signature to authorize paying for gas.
      console.log('Step 2: Requesting sponsor signature from gas station...');
      
      const sponsorResponse = await fetch(`${GAS_STATION_URL}/sponsor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionBlockBytes: base64Bytes,
          sender: account.address
        })
      });
      
      // Check if request was successful
      if (!sponsorResponse.ok) {
        const errorData = await sponsorResponse.json().catch(() => ({}));
        const errorMsg = errorData.error || `Gas station error: ${sponsorResponse.status}`;
        throw new Error(errorMsg);
      }
      
      const sponsorData = await sponsorResponse.json();
      const { bytes: sponsoredBytes, sponsorSignature } = sponsorData;
      
      console.log('Step 2: ✅ Got sponsor signature', {
        sponsorAddress: sponsorData.sponsorAddress,
        remainingBalance: sponsorData.remainingBalance
      });
      
      // ===== STEP 3: User Signs the Transaction =====
      //
      // Now we have the sponsored transaction bytes (with gas payment set up).
      // The user needs to sign this transaction to prove they authorized it.
      //
      // This step will trigger a wallet popup asking the user to approve the transaction.
      // The user's signature proves they authorized the operations in the transaction.
      console.log('Step 3: Requesting user signature...');
      
      // Decode the sponsored bytes back to Uint8Array for signing
      const sponsoredBytesArray = fromBase64(sponsoredBytes);
      
      // Sign the transaction with user's wallet
      // This will prompt the user to approve the transaction
      const userSignature = await signTransaction({
        transaction: sponsoredBytesArray
      });
      
      console.log('Step 3: ✅ User signed transaction');
      
      // ===== STEP 4: Execute with Both Signatures =====
      //
      // Now we have both signatures:
      // - User signature: Proves the user authorized the transaction
      // - Sponsor signature: Proves the sponsor authorized paying for gas
      //
      // Both signatures are required for execution. This is a security feature:
      // - User can't execute without sponsor (can't bypass gas payment)
      // - Sponsor can't execute without user (can't execute unauthorized transactions)
      //
      // We execute the transaction on the Sui blockchain with both signatures.
      console.log('Step 4: Executing transaction with both signatures...');
      
      const result = await client.executeTransactionBlock({
        transactionBlock: sponsoredBytesArray,
        signature: [
          userSignature.signature,  // User's signature
          sponsorSignature           // Sponsor's signature
        ],
        options: {
          showEffects: true,
          showEvents: true,
          showInput: false,
          showObjectChanges: true
        }
      });
      
      // Extract transaction digest from result
      const digest = result.digest;
      setTxDigest(digest);
      
      console.log('Step 4: ✅ Transaction executed successfully', {
        digest,
        effects: result.effects?.status
      });
      
      return result;
      
    } catch (err) {
      // Handle errors at any step
      const errorMessage = err.message || 'Failed to execute sponsored transaction';
      setError(errorMessage);
      
      console.error('❌ Sponsored transaction failed:', {
        error: errorMessage,
        step: err.step || 'unknown'
      });
      
      // Re-throw so caller can handle the error
      throw err;
      
    } finally {
      // Always set loading to false when done
      setLoading(false);
    }
  }, [client, account, signTransaction]);
  
  // Return hook interface
  return {
    executeSponsoredTransaction,
    loading,
    error,
    txDigest
  };
}

