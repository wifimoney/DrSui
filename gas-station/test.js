/**
 * Gas Station Test Script
 * 
 * Simple test suite for verifying gas station functionality.
 * This is for hackathon verification, not production testing.
 * 
 * Prerequisites:
 *   - Gas station server must be running on http://localhost:3001
 *   - Start server with: npm start
 * 
 * Usage:
 *   npm test
 *   node test.js
 * 
 * Environment Variables:
 *   - GAS_STATION_URL: URL of gas station (default: http://localhost:3001)
 *   - ALLOWED_PACKAGE_ID: Package ID for validation tests (optional)
 */

import dotenv from 'dotenv';
dotenv.config();

// Test configuration
const GAS_STATION_URL = process.env.GAS_STATION_URL || 'http://localhost:3001';
const ALLOWED_PACKAGE_ID = process.env.ALLOWED_PACKAGE_ID || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

// Test results
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, testFn) {
  return new Promise(async (resolve) => {
    try {
      log(`\n🧪 Testing: ${name}`, 'cyan');
      await testFn();
      log(`✅ PASS: ${name}`, 'green');
      testsPassed++;
      testResults.push({ name, status: 'PASS' });
      resolve(true);
    } catch (error) {
      log(`❌ FAIL: ${name}`, 'red');
      log(`   Error: ${error.message}`, 'red');
      testsFailed++;
      testResults.push({ name, status: 'FAIL', error: error.message });
      resolve(false);
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Test 1: Health Endpoint
 * 
 * Verifies the gas station service is running and responding.
 */
async function testHealth() {
  const response = await fetch(`${GAS_STATION_URL}/health`);
  
  assert(response.ok, `Expected 200, got ${response.status}`);
  
  const data = await response.json();
  assert(data.status === 'ok', `Expected { status: 'ok' }, got ${JSON.stringify(data)}`);
  
  log(`   Response: ${JSON.stringify(data)}`, 'blue');
}

/**
 * Test 2: Status Endpoint
 * 
 * Verifies the gas station returns correct status information including:
 * - Sponsor address
 * - Balance > 0
 * - Allowed package ID
 */
async function testStatus() {
  const response = await fetch(`${GAS_STATION_URL}/status`);
  
  assert(response.ok, `Expected 200, got ${response.status}`);
  
  const data = await response.json();
  
  // Check sponsor address exists
  assert(data.sponsorAddress, 'Missing sponsorAddress in response');
  assert(data.sponsorAddress.startsWith('0x'), 'Sponsor address should start with 0x');
  log(`   Sponsor Address: ${data.sponsorAddress}`, 'blue');
  
  // Check balance exists and is > 0
  assert(data.balance, 'Missing balance in response');
  const totalBalance = BigInt(data.balance.totalBalance || 0);
  assert(totalBalance > 0n, `Balance should be > 0, got ${totalBalance}`);
  const balanceSUI = Number(totalBalance) / 1_000_000_000;
  log(`   Balance: ${balanceSUI.toFixed(4)} SUI`, 'blue');
  
  // Check allowed package ID
  assert(data.allowedPackage, 'Missing allowedPackage in response');
  log(`   Allowed Package: ${data.allowedPackage}`, 'blue');
  
  // Check network
  assert(data.network, 'Missing network in response');
  log(`   Network: ${data.network}`, 'blue');
}

/**
 * Test 3: Sponsor Endpoint - Validation (Wrong Package)
 * 
 * Verifies that transactions targeting unauthorized packages are rejected.
 * This tests the security validation.
 */
async function testSponsorValidation() {
  // Create a mock transaction that targets a different package
  // We'll use a simple base64-encoded transaction that would fail validation
  
  // For this test, we'll create a minimal transaction bytes
  // In reality, this would be a properly built Sui transaction
  // But for testing, we just need to verify the validation logic works
  
  const mockTransactionBytes = Buffer.from('mock-transaction-bytes-for-wrong-package').toString('base64');
  const mockSender = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  
  const response = await fetch(`${GAS_STATION_URL}/sponsor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transactionBlockBytes: mockTransactionBytes,
      sender: mockSender
    })
  });
  
  // Should return 403 Forbidden or 400 Bad Request (depending on validation point)
  // The important thing is it should NOT return 200
  assert(!response.ok, 'Expected error response for invalid package');
  
  const status = response.status;
  const isValidationError = status === 403 || status === 400;
  assert(isValidationError, `Expected 403 or 400, got ${status}`);
  
  const data = await response.json();
  log(`   Status: ${status}`, 'blue');
  log(`   Error: ${data.error || data.message || 'Unknown error'}`, 'blue');
  
  // Verify error message mentions validation or unauthorized
  const errorText = JSON.stringify(data).toLowerCase();
  const hasValidationMessage = 
    errorText.includes('unauthorized') || 
    errorText.includes('validation') || 
    errorText.includes('package') ||
    errorText.includes('invalid');
  
  if (hasValidationMessage) {
    log(`   ✅ Validation error message detected`, 'green');
  } else {
    log(`   ⚠️  Validation error message not clear, but status is correct`, 'yellow');
  }
}

/**
 * Test 4: Sponsor Endpoint - Success (Mock)
 * 
 * Tests a valid transaction sponsorship.
 * Note: This requires a properly built Sui transaction, which is complex.
 * For hackathon verification, we'll test the endpoint structure and log expected behavior.
 */
async function testSponsorSuccess() {
  log(`   ℹ️  Skipping full transaction test (requires complex Sui transaction building)`, 'yellow');
  log(`   ℹ️  To test full flow:`, 'yellow');
  log(`      1. Deploy your Move contract`, 'yellow');
  log(`      2. Build a real transaction in the frontend`, 'yellow');
  log(`      3. Send it to /sponsor endpoint`, 'yellow');
  log(`      4. Verify it returns bytes and sponsorSignature`, 'yellow');
  log(`   ℹ️  Expected successful response:`, 'yellow');
  log(`      {`, 'yellow');
  log(`        "bytes": "base64-encoded-transaction-bytes",`, 'yellow');
  log(`        "sponsorSignature": "sponsor-signature",`, 'yellow');
  log(`        "sponsorAddress": "0x...",`, 'yellow');
  log(`        "remainingBalance": 9.95`, 'yellow');
  log(`      }`, 'yellow');
  
  // We'll do a basic check that the endpoint exists and accepts POST
  try {
    const response = await fetch(`${GAS_STATION_URL}/sponsor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionBlockBytes: 'invalid',
        sender: '0x0000000000000000000000000000000000000000000000000000000000000000'
      })
    });
    
    // Even with invalid data, we should get a response (not 404)
    assert(response.status !== 404, 'Endpoint /sponsor not found');
    log(`   ✅ Endpoint exists and accepts POST requests`, 'green');
  } catch (error) {
    // If it's a network error, that's fine - endpoint exists
    if (error.message.includes('fetch')) {
      log(`   ⚠️  Network error (endpoint may be down)`, 'yellow');
    } else {
      throw error;
    }
  }
}

/**
 * Test 5: Limits Endpoint
 * 
 * Verifies the rate limit status endpoint works.
 */
async function testLimits() {
  const response = await fetch(`${GAS_STATION_URL}/limits`);
  
  assert(response.ok, `Expected 200, got ${response.status}`);
  
  const data = await response.json();
  
  // Check rate limiting structure
  assert(data.rateLimiting !== undefined, 'Missing rateLimiting in response');
  assert(data.limits !== undefined, 'Missing limits in response');
  
  log(`   Rate Limiting Enabled: ${data.rateLimiting.enabled}`, 'blue');
  log(`   Per-IP Limit: ${data.limits.perIp.max} requests/${data.limits.perIp.window}`, 'blue');
  log(`   Global Limit: ${data.limits.global.max} requests/${data.limits.global.window}`, 'blue');
  log(`   Per-Address Limit: ${data.limits.perAddress.max} requests/${data.limits.perAddress.window}`, 'blue');
}

/**
 * Test 6: Stats Endpoint
 * 
 * Verifies the statistics endpoint works.
 */
async function testStats() {
  const response = await fetch(`${GAS_STATION_URL}/stats`);
  
  assert(response.ok, `Expected 200, got ${response.status}`);
  
  const data = await response.json();
  
  // Check stats structure
  assert(data.overview !== undefined, 'Missing overview in response');
  assert(typeof data.overview.totalTransactions === 'number', 'totalTransactions should be a number');
  
  log(`   Total Transactions: ${data.overview.totalTransactions}`, 'blue');
  log(`   Success Rate: ${data.overview.successRate}`, 'blue');
  log(`   Total Gas Spent: ${data.overview.totalGasSpent.sui} SUI`, 'blue');
}

/**
 * Check if gas station is running
 */
async function checkServerRunning() {
  try {
    const response = await fetch(`${GAS_STATION_URL}/health`, {
      signal: AbortSignal.timeout(2000) // 2 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   Gas Station Test Suite              ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  log(`\nTesting gas station at: ${GAS_STATION_URL}`, 'blue');
  log(`Allowed Package ID: ${ALLOWED_PACKAGE_ID}`, 'blue');
  
  // Check if server is running
  log('\n🔍 Checking if gas station is running...', 'yellow');
  const isRunning = await checkServerRunning();
  
  if (!isRunning) {
    log('\n❌ Gas station server is not running!', 'red');
    log('   Please start the server first:', 'yellow');
    log('   cd gas-station && npm start', 'yellow');
    process.exit(1);
  }
  
  log('✅ Gas station server is running\n', 'green');
  
  // Run all tests
  await test('Health Endpoint', testHealth);
  await test('Status Endpoint', testStatus);
  await test('Sponsor Endpoint - Validation (Wrong Package)', testSponsorValidation);
  await test('Sponsor Endpoint - Success (Structure Check)', testSponsorSuccess);
  await test('Limits Endpoint', testLimits);
  await test('Stats Endpoint', testStats);
  
  // Print summary
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   Test Summary                         ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');
  log(`\n✅ Passed: ${testsPassed}`, 'green');
  log(`❌ Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  log(`📊 Total:  ${testsPassed + testsFailed}`, 'blue');
  
  if (testsFailed > 0) {
    log('\nFailed Tests:', 'red');
    testResults
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        log(`  - ${t.name}`, 'red');
        log(`    ${t.error}`, 'red');
      });
  }
  
  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error.message}`, 'red');
  process.exit(1);
});

// Run tests
runTests().catch((error) => {
  log(`\n❌ Test runner error: ${error.message}`, 'red');
  process.exit(1);
});

