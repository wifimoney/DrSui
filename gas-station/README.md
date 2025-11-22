# Gas Station Service

A Node.js Express server that sponsors gas fees for Sui blockchain transactions, enabling users to interact with your dApp without needing SUI for gas.

## What This Service Does

The Gas Station Service acts as a "sponsor" that pays transaction fees on behalf of users. This provides a better user experience by:

- **Eliminating gas fees for users** - Users don't need to hold SUI to interact with your dApp
- **Seamless onboarding** - New users can start using your app immediately
- **Controlled spending** - Only transactions to your approved package are sponsored
- **Security** - All transactions are validated before sponsorship

### How It Works

1. User creates a transaction in the frontend (without gas payment)
2. Frontend sends transaction bytes to this service
3. Service validates the transaction targets only your package
4. Service sets up gas sponsorship (gasOwner, gasPayment, gasBudget)
5. Service signs the transaction with sponsor's keypair
6. Service returns signed transaction to frontend
7. Frontend combines user signature + sponsor signature and executes

## Setup

### Prerequisites

- Node.js 18+ installed
- A Sui wallet with SUI for sponsoring transactions
- Your deployed Sui Move package ID

### Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Create `.env` file:**

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Or create `.env` manually with:

```env
# The private key of the wallet paying for gas (keep secret!)
SPONSOR_SECRET_KEY=suiprivkey1qzv3k0wms7a5t5u939wt85smtzv8esfv543e3cymlk7yhr6h3vpdcx96q02

# Only transactions to this package will be sponsored (security!)
ALLOWED_PACKAGE_ID=your_drSui_package_id_here

# The Sui network to connect to
SUI_NETWORK=testnet

# Port for the server (3001 to avoid conflict with React on 3000)
PORT=3001
```

3. **Fund your sponsor wallet:**

Make sure the wallet address (derived from `SPONSOR_SECRET_KEY`) has sufficient SUI:
- Recommended: At least 10-50 SUI for hackathon demos
- Minimum: 1 SUI (service will warn if below 1 SUI, critical if below 0.1 SUI)

### Running the Service

**Production mode:**
```bash
npm start
```

**Development mode (with auto-reload):**
```bash
npm run dev
```

The server will start on port 3001 (or the port specified in `.env`).

## Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SPONSOR_SECRET_KEY` | Private key of the wallet paying for gas (bech32 format: `suiprivkey...`) | ✅ Yes |
| `ALLOWED_PACKAGE_ID` | Your Sui Move package ID - only transactions to this package will be sponsored | ✅ Yes |
| `SUI_NETWORK` | Sui network: `testnet`, `devnet`, or `mainnet` | ❌ No (defaults to `testnet`) |
| `PORT` | Server port number | ❌ No (defaults to `3001`) |
| `ADMIN_KEY` | Admin key for accessing `/logs` endpoint | ❌ No (optional) |
| `RATE_LIMIT_DISABLED` | Set to `true` to disable rate limiting (dev only) | ❌ No (defaults to `false`) |

### Getting Your Package ID

After deploying your Move contract, you'll get a package ID. It looks like:
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

Update `ALLOWED_PACKAGE_ID` in your `.env` file with this value.

### Getting Your Sponsor Private Key

1. Create a new Sui wallet (or use an existing one)
2. Export the private key (bech32 format: `suiprivkey...`)
3. Fund it with SUI
4. Add it to `.env` as `SPONSOR_SECRET_KEY`

⚠️ **Security Warning:** Never commit your `.env` file to version control! It contains your private key.

## API Endpoints

### POST `/sponsor`

Sponsor a Sui transaction by setting up gas payment and signing it.

**Request Body:**
```json
{
  "transactionBlockBytes": "base64-encoded-transaction-bytes",
  "sender": "0x1234...user-address"
}
```

**Response:**
```json
{
  "bytes": "base64-encoded-final-transaction-bytes",
  "sponsorSignature": "sponsor-signature",
  "sponsorAddress": "0x5678...sponsor-address",
  "remainingBalance": 9.95
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (missing fields, invalid bytes)
- `403` - Transaction validation failed (unauthorized package)
- `500` - Server error (no gas coins, network error)

### GET `/status`

Get gas station status and basic information.

**Response:**
```json
{
  "sponsorAddress": "0x5678...sponsor-address",
  "allowedPackage": "0x1234...package-id",
  "network": "testnet",
  "balance": {
    "totalBalance": "10000000000",
    "coinObjectCount": 5
  },
  "status": "operational"
}
```

### GET `/balance`

Get detailed balance information and statistics.

**Response:**
```json
{
  "sponsorAddress": "0x5678...sponsor-address",
  "currentBalance": {
    "sui": "10.0000",
    "mist": "10000000000",
    "coinCount": 5
  },
  "statistics": {
    "transactionsToday": 42,
    "totalSuccessfulSponsorships": 150,
    "totalRequests": 152,
    "totalGasSpent": {
      "sui": "0.420000",
      "mist": "420000000"
    },
    "averageGasCostPerTransaction": {
      "sui": "0.010000",
      "mist": "10000000"
    }
  },
  "warnings": {
    "lowBalance": false,
    "criticalBalance": false,
    "estimatedTransactionsRemaining": 1000
  },
  "lastResetDate": "Mon Jan 15 2024"
}
```

### GET `/stats`

Get comprehensive transaction statistics and analytics.

**Response:**
```json
{
  "overview": {
    "totalTransactions": 150,
    "successfulTransactions": 145,
    "failedTransactions": 5,
    "successRate": "96.67%",
    "totalGasSpent": {
      "sui": "1.450000",
      "mist": "1450000000"
    }
  },
  "last24Hours": {
    "transactions": 42,
    "transactionsPerHour": "1.75",
    "successful": 40,
    "failed": 2
  },
  "statusBreakdown": {
    "success": 145,
    "failed": 5,
    "pending": 0
  },
  "mostActiveSenders": [
    {
      "address": "0x1234...5678",
      "fullAddress": "0x1234567890abcdef...",
      "transactions": 15
    }
  ],
  "timeRange": {
    "oldestLog": "2024-01-15T10:00:00.000Z",
    "newestLog": "2024-01-15T14:30:00.000Z",
    "totalLogs": 150
  }
}
```

### GET `/logs`

Get detailed transaction logs (requires admin authentication).

**Headers:**
- `admin-key` or `x-admin-key`: Admin authentication key (must match `ADMIN_KEY` env var)

**Query Parameters:**
- `limit`: Number of logs to return (default: 100, max: 1000)
- `sender`: Filter by sender address

**Response:**
```json
{
  "total": 150,
  "returned": 100,
  "logs": [
    {
      "timestamp": "2024-01-15T14:30:00.000Z",
      "sender": "0x1234...5678",
      "transactionDigest": "0xabc...def",
      "gasCost": "10000000",
      "gasCostSUI": "0.010000",
      "status": "success",
      "ipAddress": "192.168.1.1",
      "error": null
    }
  ],
  "filters": {
    "limit": 100,
    "sender": null
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (invalid or missing admin key)
- `503` - Admin access not configured

### GET `/health`

Simple health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Transaction Logging

The service includes comprehensive transaction logging:

- **In-Memory Logs**: Last 1000 transactions stored in memory
- **File Persistence**: Logs automatically saved to `logs.json` every 5 minutes
- **Detailed Information**: Each log includes timestamp, sender, gas cost, status, IP address
- **Analytics**: `/stats` endpoint provides comprehensive analytics
- **Admin Access**: `/logs` endpoint requires admin key for security

### Log File

Logs are automatically saved to `logs.json` in the gas-station directory:
- Saved every 5 minutes
- Loaded on server startup
- Contains last 1000 transactions
- Automatically excluded from git (in `.gitignore`)

### Admin Key Setup

To access the `/logs` endpoint, set `ADMIN_KEY` in your `.env`:

```env
ADMIN_KEY=your-secret-admin-key-here
```

Then use it in requests:
```bash
curl -H "admin-key: your-secret-admin-key-here" http://localhost:3001/logs
```

## Monitoring

The service includes built-in monitoring features:

- **Balance Monitoring:** Automatically checks balance every 5 minutes
- **Alerts:** Logs warnings when balance is low (< 1 SUI) or critical (< 0.1 SUI)
- **Statistics:** Tracks daily transactions, total sponsorships, and gas usage
- **Request Logging:** Logs all requests with timestamp and sender address

### Balance Alerts

The service will log warnings:
- ⚠️ **WARNING** when balance < 1 SUI
- 🚨 **CRITICAL** when balance < 0.1 SUI

Check the console output or call `/balance` to see current status.

## Security

### Transaction Validation

All transactions are validated before sponsorship:
- Only MoveCall commands targeting `ALLOWED_PACKAGE_ID` are allowed
- Other commands (TransferObject, etc.) are allowed but won't be validated
- Unauthorized packages are rejected with 403 Forbidden

### Best Practices

1. **Keep `.env` secure:** Never commit it to version control
2. **Use separate wallet:** Don't use your main wallet as sponsor
3. **Set gas budget:** Service limits gas budget to 0.01 SUI per transaction
4. **Monitor balance:** Check `/balance` regularly during demos
5. **Restrict CORS:** In production, update CORS settings to only allow your frontend domain

## Troubleshooting

### "Sponsor has no gas coins available"

- Check that your sponsor wallet has SUI
- Verify `SPONSOR_SECRET_KEY` is correct
- Check network (testnet/devnet/mainnet) matches your wallet

### "Transaction validation failed"

- Verify `ALLOWED_PACKAGE_ID` matches your deployed package
- Check that transaction is calling functions from your package
- Package ID format: `0x...::module::function`

### "Failed to reconstruct transaction from bytes"

- Ensure transaction bytes are valid base64
- Check that transaction was built correctly in frontend
- Verify Sui SDK versions match between frontend and backend

## Example Frontend Integration

```javascript
// Create transaction
const tx = new Transaction();
tx.moveCall({
  target: `${PACKAGE_ID}::module::function`,
  arguments: [...]
});

// Build transaction bytes (without gas payment)
const bytes = await tx.build({ client });

// Send to gas station
const response = await fetch('http://localhost:3001/sponsor', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionBlockBytes: toBase64(bytes),
    sender: userAddress
  })
});

const { bytes: finalBytes, sponsorSignature } = await response.json();

// Sign with user's keypair
const userSignature = await userKeypair.signTransaction(fromBase64(finalBytes));

// Execute transaction
await client.executeTransactionBlock({
  transactionBlock: finalBytes,
  signature: [userSignature.signature, sponsorSignature]
});
```

## License

ISC

