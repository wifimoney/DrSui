/**
 * Gas Station Server - Sponsors Sui Transactions
 * 
 * This server acts as a "gas station" that pays for user transactions on the Sui blockchain.
 * 
 * What is "Sponsoring"?
 * - Users can submit transactions without paying gas fees
 * - The sponsor (this server) pays the gas fees on behalf of users
 * - This enables a better user experience (no need to hold SUI for gas)
 * - The sponsor validates transactions to ensure only approved operations are sponsored
 * 
 * Security Model:
 * - Only transactions targeting ALLOWED_PACKAGE_ID are sponsored
 * - This prevents abuse (users can't use our gas for arbitrary transactions)
 * - Transactions are validated before signing to ensure they match our package
 * - The sponsor's private key is kept secure in environment variables
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toBase64 } from '@mysten/sui/utils';

// Load environment variables
dotenv.config();

// Load environment variables
const SPONSOR_SECRET_KEY = process.env.SPONSOR_SECRET_KEY;
const ALLOWED_PACKAGE_ID = process.env.ALLOWED_PACKAGE_ID;
const SUI_NETWORK = process.env.SUI_NETWORK || 'testnet';
const PORT = process.env.PORT || 3001;

// Validate required environment variables
if (!SPONSOR_SECRET_KEY) {
  console.error('❌ SPONSOR_SECRET_KEY is required in .env file');
  process.exit(1);
}

if (!ALLOWED_PACKAGE_ID || ALLOWED_PACKAGE_ID === 'your_drSui_package_id_here') {
  console.warn('⚠️  ALLOWED_PACKAGE_ID not set or using placeholder. Update .env with your package ID!');
}

// Initialize Express app
const app = express();

// Middleware
// CORS: Allow all origins for development (restrict in production!)
app.use(cors({
  origin: '*', // In production, specify allowed origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON request bodies
app.use(express.json());

/**
 * Request Logging Middleware
 * 
 * Logs all incoming requests with timestamp, endpoint, and sender address.
 * Tracks total requests and successful sponsorships for monitoring.
 * 
 * This helps monitor gas usage during hackathon demos by showing:
 * - How many requests are coming in
 * - Which addresses are using the service
 * - Request patterns and timing
 */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const endpoint = req.path;
  const method = req.method;
  
  // Extract sender from request body for POST requests
  const sender = req.body?.sender || 'N/A';
  
  // Log the request
  console.log(`[${timestamp}] ${method} ${endpoint} | Sender: ${sender}`);
  
  // Track statistics
  stats.totalRequests++;
  
  // Store request in history (keep last 100)
  stats.requestHistory.push({
    timestamp,
    method,
    endpoint,
    sender
  });
  
  if (stats.requestHistory.length > 100) {
    stats.requestHistory.shift(); // Remove oldest
  }
  
  next();
});

// Initialize Sui client
const client = new SuiClient({
  url: getFullnodeUrl(SUI_NETWORK)
});

// Initialize sponsor keypair
// Handle both bech32 format (suiprivkey...) and hex format
let sponsorKeypair;
try {
  // Try to create keypair from the secret key
  // Ed25519Keypair.fromSecretKey() can handle bech32 format
  sponsorKeypair = Ed25519Keypair.fromSecretKey(SPONSOR_SECRET_KEY);
} catch (error) {
  console.error('❌ Failed to create keypair from SPONSOR_SECRET_KEY:', error.message);
  process.exit(1);
}

const sponsorAddress = sponsorKeypair.toSuiAddress();

// Statistics tracking for monitoring
const stats = {
  totalRequests: 0,
  successfulSponsorships: 0,
  transactionsToday: 0,
  totalGasSpent: 0n, // In MIST
  lastResetDate: new Date().toDateString(),
  requestHistory: [] // Store last 100 requests for analysis
};

// Reset daily counter if it's a new day
function resetDailyStatsIfNeeded() {
  const today = new Date().toDateString();
  if (stats.lastResetDate !== today) {
    console.log('📅 New day detected, resetting daily transaction counter');
    stats.transactionsToday = 0;
    stats.lastResetDate = today;
  }
}

/**
 * Check Sponsor Balance
 * 
 * Monitors the sponsor wallet balance and logs warnings if it gets low.
 * This is critical for hackathon demos - you need to know when to refill!
 * 
 * @returns {Promise<number>} Balance in SUI (not MIST)
 */
async function checkSponsorBalance() {
  try {
    const balance = await client.getBalance({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI'
    });

    // Convert MIST to SUI (1 SUI = 1,000,000,000 MIST)
    const balanceInSUI = Number(balance.totalBalance) / 1_000_000_000;

    // Log warnings based on balance thresholds
    if (balanceInSUI < 0.1) {
      console.error('🚨 CRITICAL: Sponsor balance is below 0.1 SUI!');
      console.error(`   Current balance: ${balanceInSUI.toFixed(4)} SUI`);
      console.error('   ⚠️  Refill immediately or gas station will stop working!');
    } else if (balanceInSUI < 1) {
      console.warn('⚠️  WARNING: Sponsor balance is below 1 SUI');
      console.warn(`   Current balance: ${balanceInSUI.toFixed(4)} SUI`);
      console.warn('   Consider refilling soon to avoid interruptions');
    } else {
      console.log(`💰 Sponsor balance: ${balanceInSUI.toFixed(4)} SUI (${balance.coinObjectCount} coins)`);
    }

    return balanceInSUI;
  } catch (error) {
    console.error('❌ Failed to check sponsor balance:', error.message);
    return 0;
  }
}

console.log('🚀 Gas Station Server Starting...');
console.log(`📍 Sponsor Address: ${sponsorAddress}`);
console.log(`📦 Allowed Package: ${ALLOWED_PACKAGE_ID}`);
console.log(`🌐 Network: ${SUI_NETWORK}`);
console.log(`🔌 Port: ${PORT}`);

/**
 * Validate Transaction Middleware
 * 
 * This function ensures that the transaction only calls functions from our allowed package.
 * 
 * Why validate?
 * - Prevents abuse: Users could submit transactions to any package and drain our gas
 * - Security: We only sponsor transactions for our Dr. Sui package
 * - Cost control: Limits gas spending to approved operations only
 * 
 * How it works:
 * - Extracts all MoveCall commands from the transaction
 * - Checks if each MoveCall's target starts with ALLOWED_PACKAGE_ID
 * - Throws an error if any MoveCall targets a different package
 * 
 * @param {Object} txData - The transaction data to validate
 * @returns {boolean} - True if all MoveCalls are valid
 * @throws {Error} - If any MoveCall targets an unauthorized package
 */
function validateTransaction(txData) {
  if (!txData || !txData.transactions) {
    throw new Error('Invalid transaction data: missing transactions array');
  }

  const transactions = txData.transactions;
  console.log(`🔍 Validating transaction with ${transactions.length} command(s)...`);

  // Loop through each command in the transaction
  for (let i = 0; i < transactions.length; i++) {
    const command = transactions[i];
    
    // Only validate MoveCall commands (other commands like TransferObject are fine)
    if (command.kind === 'MoveCall') {
      const target = command.target;
      console.log(`  📋 Command ${i + 1}: MoveCall to ${target}`);
      
      // Check if the target starts with our allowed package ID
      // Package IDs in Sui are like: 0x1234567890abcdef...::module::function
      if (!target.startsWith(ALLOWED_PACKAGE_ID)) {
        const errorMsg = `❌ Unauthorized package: ${target} does not start with ${ALLOWED_PACKAGE_ID}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`  ✅ Command ${i + 1} validated: ${target}`);
    } else {
      console.log(`  ℹ️  Command ${i + 1}: ${command.kind} (skipping validation)`);
    }
  }

  console.log('✅ All transaction commands validated successfully');
  return true;
}

/**
 * POST /sponsor - Sponsor a Sui transaction
 * 
 * This endpoint accepts a transaction from the frontend, sets up gas sponsorship,
 * validates it, signs it, and returns it for execution.
 * 
 * Flow of bytes:
 * 1. Frontend creates a transaction (without gas payment)
 * 2. Frontend builds transaction bytes and sends base64-encoded bytes to this endpoint
 * 3. This server decodes the bytes and reconstructs the Transaction object
 * 4. Server sets up gas sponsorship (gasOwner, gasPayment, gasBudget)
 * 5. Server validates the transaction targets only our package
 * 6. Server builds final transaction bytes and signs with sponsor keypair
 * 7. Server returns signed transaction bytes and signature to frontend
 * 8. Frontend can now execute the transaction (user signs + sponsor signature)
 * 
 * Why this is secure:
 * - Transaction is validated before signing (can't sponsor unauthorized operations)
 * - Only our package ID is allowed (prevents abuse)
 * - Sponsor signature is separate from user signature (both required for execution)
 * - Gas budget is limited (0.01 SUI max) to prevent excessive spending
 * 
 * Request body:
 * {
 *   transactionBlockBytes: string (base64-encoded transaction bytes),
 *   sender: string (user's Sui address)
 * }
 * 
 * Response:
 * {
 *   bytes: string (base64-encoded final transaction bytes),
 *   sponsorSignature: string (sponsor's signature),
 *   sponsorAddress: string (sponsor's address for verification)
 * }
 */
app.post('/sponsor', async (req, res) => {
  try {
    const { transactionBlockBytes, sender } = req.body;

    // Validate inputs
    if (!transactionBlockBytes) {
      return res.status(400).json({
        error: 'Missing transactionBlockBytes in request body'
      });
    }

    if (!sender) {
      return res.status(400).json({
        error: 'Missing sender address in request body'
      });
    }

    console.log(`\n📥 Received sponsorship request from: ${sender}`);

    // Decode the base64 transaction bytes
    let transactionBytes;
    try {
      transactionBytes = fromBase64(transactionBlockBytes);
      console.log(`📦 Decoded transaction bytes (${transactionBytes.length} bytes)`);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid base64 transaction bytes',
        details: error.message
      });
    }

    // Reconstruct Transaction from bytes
    // Transaction.from() parses the bytes and recreates the transaction object
    let tx;
    try {
      tx = Transaction.from(transactionBytes);
      console.log('✅ Transaction reconstructed successfully');
    } catch (error) {
      return res.status(400).json({
        error: 'Failed to reconstruct transaction from bytes',
        details: error.message
      });
    }

    // ===== SPONSORSHIP LOGIC =====
    
    // a. Get sponsor's gas coins
    console.log('💰 Fetching sponsor gas coins...');
    const gasCoins = await client.getCoins({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI' // SUI coin type
    });

    if (!gasCoins.data || gasCoins.data.length === 0) {
      return res.status(500).json({
        error: 'Sponsor has no gas coins available',
        sponsorAddress: sponsorAddress
      });
    }

    // b. Select a coin with sufficient balance (at least 0.1 SUI = 100000000 MIST)
    // MIST is the smallest unit of SUI (1 SUI = 1,000,000,000 MIST)
    const MIN_GAS_BALANCE = 100000000n; // 0.1 SUI
    const gasCoin = gasCoins.data.find(coin => {
      const balance = BigInt(coin.balance);
      return balance >= MIN_GAS_BALANCE;
    });

    if (!gasCoin) {
      return res.status(500).json({
        error: 'No sponsor gas coin with sufficient balance (need at least 0.1 SUI)',
        availableCoins: gasCoins.data.length,
        sponsorAddress: sponsorAddress
      });
    }

    console.log(`✅ Selected gas coin: ${gasCoin.coinObjectId} (balance: ${gasCoin.balance} MIST)`);

    // c. Set transaction sender to the user's address
    tx.setSender(sender);
    console.log(`👤 Set sender to: ${sender}`);

    // d. Set gasOwner to sponsor's address
    // This tells Sui that the sponsor will pay for gas, not the sender
    tx.setGasOwner(sponsorAddress);
    console.log(`💳 Set gas owner to sponsor: ${sponsorAddress}`);

    // e. Set gas budget (maximum gas to spend)
    // 0.01 SUI = 10,000,000 MIST is a reasonable budget for most transactions
    const GAS_BUDGET = 10000000n; // 0.01 SUI
    tx.setGasBudget(GAS_BUDGET);
    console.log(`⛽ Set gas budget to: ${GAS_BUDGET} MIST (0.01 SUI)`);

    // f. Set gas payment (the coin that will be used to pay for gas)
    // We need to provide the coin's object ID, version, and digest
    tx.setGasPayment([{
      objectId: gasCoin.coinObjectId,
      version: gasCoin.version,
      digest: gasCoin.digest
    }]);
    console.log(`💸 Set gas payment coin: ${gasCoin.coinObjectId}`);

    // ===== SECURITY CHECK =====
    
    // Build the transaction to inspect it
    // This doesn't execute it, just prepares it for validation
    console.log('🔒 Building transaction for validation...');
    const txData = tx.getData();
    
    // Validate the transaction
    try {
      validateTransaction(txData);
    } catch (validationError) {
      console.error('🚫 Transaction validation failed:', validationError.message);
      return res.status(403).json({
        error: 'Transaction validation failed',
        details: validationError.message,
        message: 'This transaction targets an unauthorized package. Only transactions to the allowed package will be sponsored.'
      });
    }

    // ===== SIGN THE TRANSACTION =====
    
    // Build final transaction bytes
    // This creates the final byte representation that will be executed
    console.log('📝 Building final transaction bytes...');
    const finalBytes = await tx.build({ client });
    console.log(`✅ Built final transaction bytes (${finalBytes.length} bytes)`);

    // Sign with sponsor keypair
    // This creates a signature that proves the sponsor authorized paying for this transaction
    console.log('✍️  Signing transaction with sponsor keypair...');
    const signature = await sponsorKeypair.signTransaction(finalBytes);
    console.log('✅ Transaction signed successfully');

    // Track successful sponsorship
    stats.successfulSponsorships++;
    resetDailyStatsIfNeeded();
    stats.transactionsToday++;
    
    // Estimate gas cost (we set budget to 0.01 SUI, actual may be less)
    const estimatedGasCost = 10000000n; // 0.01 SUI in MIST
    stats.totalGasSpent += estimatedGasCost;

    // Check balance after sponsorship
    const remainingBalance = await checkSponsorBalance();

    // Return the signed transaction data
    // Frontend will combine this with the user's signature and execute
    const response = {
      bytes: toBase64(finalBytes),
      sponsorSignature: signature.signature,
      sponsorAddress: sponsorAddress,
      remainingBalance: remainingBalance // Current sponsor balance after transaction
    };

    console.log(`✅ Sponsorship complete! Returning signed transaction to ${sender}`);
    console.log(`📊 Stats: ${stats.transactionsToday} transactions today, ${stats.successfulSponsorships} total sponsorships\n`);

    res.json(response);

  } catch (error) {
    console.error('❌ Error in /sponsor endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /status - Get gas station status
 * 
 * Returns information about the gas station, including:
 * - Sponsor address (so users know who's paying)
 * - Allowed package ID
 * - Network
 * - Sponsor's current SUI balance
 * 
 * This endpoint is public and can be called by anyone to verify the gas station is operational.
 */
app.get('/status', async (req, res) => {
  try {
    // Fetch sponsor's SUI balance
    const balance = await client.getBalance({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI'
    });

    res.json({
      sponsorAddress: sponsorAddress,
      allowedPackage: ALLOWED_PACKAGE_ID,
      network: SUI_NETWORK,
      balance: {
        totalBalance: balance.totalBalance,
        coinObjectCount: balance.coinObjectCount
      },
      status: 'operational'
    });
  } catch (error) {
    console.error('❌ Error in /status endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch status',
      details: error.message
    });
  }
});

/**
 * GET /balance - Get detailed balance and statistics
 * 
 * Returns comprehensive information about the gas station:
 * - Current sponsor balance
 * - Number of sponsored transactions today
 * - Total successful sponsorships
 * - Average gas cost per transaction
 * - Total requests received
 * 
 * This endpoint is useful for monitoring gas usage during hackathon demos.
 */
app.get('/balance', async (req, res) => {
  try {
    // Fetch current balance
    const balance = await client.getBalance({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI'
    });

    const balanceInSUI = Number(balance.totalBalance) / 1_000_000_000;
    const totalGasSpentInSUI = Number(stats.totalGasSpent) / 1_000_000_000;
    
    // Calculate average gas cost per transaction
    const avgGasCost = stats.successfulSponsorships > 0
      ? totalGasSpentInSUI / stats.successfulSponsorships
      : 0;

    res.json({
      sponsorAddress: sponsorAddress,
      currentBalance: {
        sui: balanceInSUI.toFixed(4),
        mist: balance.totalBalance,
        coinCount: balance.coinObjectCount
      },
      statistics: {
        transactionsToday: stats.transactionsToday,
        totalSuccessfulSponsorships: stats.successfulSponsorships,
        totalRequests: stats.totalRequests,
        totalGasSpent: {
          sui: totalGasSpentInSUI.toFixed(6),
          mist: stats.totalGasSpent.toString()
        },
        averageGasCostPerTransaction: {
          sui: avgGasCost.toFixed(6),
          mist: stats.successfulSponsorships > 0 
            ? (Number(stats.totalGasSpent) / stats.successfulSponsorships).toFixed(0)
            : '0'
        }
      },
      warnings: {
        lowBalance: balanceInSUI < 1,
        criticalBalance: balanceInSUI < 0.1,
        estimatedTransactionsRemaining: balanceInSUI > 0 
          ? Math.floor(balanceInSUI / (avgGasCost || 0.01))
          : 0
      },
      lastResetDate: stats.lastResetDate
    });
  } catch (error) {
    console.error('❌ Error in /balance endpoint:', error);
    res.status(500).json({
      error: 'Failed to fetch balance information',
      details: error.message
    });
  }
});

/**
 * GET /health - Health check endpoint
 * 
 * Simple endpoint to check if the server is running.
 * Useful for monitoring and load balancers.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware (catches errors not handled by routes)
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🎉 Gas Station Server running on port ${PORT}`);
  console.log(`📍 Sponsor Address: ${sponsorAddress}`);
  console.log(`📦 Allowed Package: ${ALLOWED_PACKAGE_ID}`);
  console.log(`🌐 Network: ${SUI_NETWORK}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   POST /sponsor - Sponsor a transaction`);
  console.log(`   GET  /status  - Get gas station status`);
  console.log(`   GET  /balance - Get detailed balance and statistics`);
  console.log(`   GET  /health  - Health check`);
  
  // Check balance on startup
  console.log(`\n💰 Checking initial sponsor balance...`);
  await checkSponsorBalance();
  
  // Set up periodic balance checking (every 5 minutes)
  // This helps monitor gas usage during hackathon demos
  setInterval(async () => {
    console.log('\n⏰ Periodic balance check (every 5 minutes)...');
    await checkSponsorBalance();
    resetDailyStatsIfNeeded();
  }, 5 * 60 * 1000); // 5 minutes in milliseconds
  
  console.log(`\n✨ Ready to sponsor transactions!`);
  console.log(`📊 Balance monitoring active (checks every 5 minutes)\n`);
});

