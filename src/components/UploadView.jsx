import React, { useState, useEffect } from 'react';
import { 
  useSignAndExecuteTransaction, 
  useSuiClient, 
  useCurrentAccount 
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { recordScan, recordVerification } from './AnalyticsPanel';

/**
 * React Environment Variables
 * 
 * In React apps, environment variables MUST start with REACT_APP_ prefix
 * to be exposed to the client-side code. This is a security feature.
 * 
 * Note: If using Vite (as this project likely does), use VITE_ prefix instead:
 * - Vite: process.env.VITE_BACKEND_URL
 * - Create React App: process.env.REACT_APP_BACKEND_URL
 * 
 * Environment variables are loaded from:
 * 1. .env file in the project root
 * 2. .env.local (overrides .env, typically gitignored)
 * 3. System environment variables
 * 
 * After adding/changing .env variables, restart the dev server!
 */

// Get backend URL from environment variable
// Defaults to localhost:8000 if not set
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Get package ID from environment variable
// This should be set to your deployed Move contract package ID
const PACKAGE_ID = process.env.REACT_APP_PACKAGE_ID || process.env.VITE_PACKAGE_ID || 'YOUR_PACKAGE_ID_HERE';

// Get Sui network from environment variable (optional)
const SUI_NETWORK = process.env.REACT_APP_SUI_NETWORK || process.env.VITE_SUI_NETWORK || 'testnet';

/**
 * UploadView Component
 * 
 * Main interface for uploading medical images, analyzing them with AI,
 * and minting on-chain proof of diagnosis on Sui blockchain.
 * 
 * Features:
 * 1. File upload (DICOM medical images)
 * 2. AI analysis via backend API
 * 3. On-chain proof minting as Sui NFTs
 * 4. Transaction verification with Suiscan links
 */
export function UploadView() {
  // ========== State Management ==========
  // File state: stores the selected file object
  const [file, setFile] = useState(null);
  
  // Loading state: indicates if API call or blockchain transaction is in progress
  const [loading, setLoading] = useState(false);
  
  // AI Result state: stores the analysis results from the backend
  const [aiResult, setAiResult] = useState(null);
  
  // Transaction Hash: stores the Sui transaction digest after successful minting
  const [txHash, setTxHash] = useState(null);
  
  // TEE toggle: for demo purposes (visual only, shows Atoma Secure badge)
  const [useTEE, setUseTEE] = useState(false);
  
  // Error state: stores error messages to display to user
  const [error, setError] = useState(null);

  // ========== Wallet Hooks ==========
  // Get current connected wallet account (null if not connected)
  const account = useCurrentAccount();
  
  // Get Sui client instance for making blockchain calls
  const client = useSuiClient();
  
  // Get transaction execution hook for signing and submitting transactions
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  // ========== Environment Variable Validation ==========
  /**
   * useEffect to check if PACKAGE_ID is still the placeholder value
   * This warns developers in the console if they haven't set up their environment variables
   */
  useEffect(() => {
    if (PACKAGE_ID === 'YOUR_PACKAGE_ID_HERE') {
      console.warn(
        '⚠️ WARNING: PACKAGE_ID is still set to placeholder value!\n' +
        'Please set REACT_APP_PACKAGE_ID (or VITE_PACKAGE_ID) in your .env file.\n' +
        'You will not be able to mint on-chain proofs until this is configured.'
      );
    }
  }, []);

  // ========== File Selection Handler ==========
  /**
   * handleFileChange
   * Called when user selects a file from the file input or drops a file
   * Updates the file state and clears any previous results/errors
   */
  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || event.dataTransfer?.files?.[0];
    
    if (selectedFile) {
      setFile(selectedFile);
      // Clear previous results when new file is selected
      setAiResult(null);
      setTxHash(null);
      setError(null);
    }
  };

  // ========== AI Analysis Handler ==========
  /**
   * handleAnalyze
   * Sends the uploaded file to the backend API for AI analysis
   * The backend processes the DICOM file and returns findings
   */
  const handleAnalyze = async () => {
    // Validation: Check if file is selected
    if (!file) {
      setError('Please select a file first');
      return;
    }

    // Set loading state to show spinner/loading indicator
    setLoading(true);
    setError(null);

    try {
      // Create FormData to send file to backend
      // FormData is used for multipart/form-data file uploads
      const formData = new FormData();
      formData.append('file', file);

      // POST request to backend analysis endpoint
      // Uses BACKEND_URL from environment variable (process.env.REACT_APP_BACKEND_URL)
      // The backend will process the DICOM file and return AI analysis results
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });

      // Check if request was successful
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Analysis failed' }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      // Parse JSON response from backend
      const result = await response.json();
      
      // Store AI analysis results in state
      // Result should contain: findings, severity, confidence, hash, etc.
      setAiResult(result);
      
      // Record scan in analytics
      const severity = result.severity || (result.critical_alert ? 'HIGH' : 'NORMAL');
      recordScan(severity);
      
      // Dispatch event to update analytics panel
      window.dispatchEvent(new Event('drsui_stats_updated'));
      
    } catch (err) {
      // Handle errors gracefully with user-friendly messages
      console.error('Analysis error:', err);
      setError(
        err.message || 
        'Failed to analyze image. Please check that the backend server is running on port 8000.'
      );
    } finally {
      // Always set loading to false when done (success or error)
      setLoading(false);
    }
  };

  // ========== Blockchain Minting Handler ==========
  /**
   * handleMintProof
   * Creates and submits a Sui transaction to mint a Diagnosis NFT on-chain
   * This creates immutable proof that the AI diagnosis was made
   */
  const handleMintProof = async () => {
    // Validation: Check if analysis result exists
    if (!aiResult) {
      setError('Please analyze an image first');
      return;
    }

    // Validation: Check if wallet is connected
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Extract hash from AI result
      // The hash is the SHA256 hash of the AI report for verification
      const hashString = aiResult.hash || aiResult.report_hash || '';
      
      if (!hashString) {
        throw new Error('Hash not found in AI result');
      }

      // Convert hash string to byte array (vector<u8>)
      // TextEncoder encodes strings to UTF-8 bytes, but we need hex bytes
      // If hash is hex string, we need to parse it properly
      let hashBytes;
      if (typeof hashString === 'string' && hashString.startsWith('0x')) {
        // Hex string: convert to bytes
        hashBytes = Array.from(
          hashString.slice(2).match(/.{1,2}/g) || [],
          byte => parseInt(byte, 16)
        );
      } else {
        // Assume it's a hex string or already bytes
        hashBytes = new TextEncoder().encode(hashString);
      }

      // Determine severity from AI result
      // Critical alert means high severity, otherwise use severity field
      const severity = aiResult.critical_alert 
        ? 'HIGH' 
        : (aiResult.severity || 'NORMAL').toUpperCase();

      // Get current timestamp (Unix epoch time in seconds)
      const timestamp = Math.floor(Date.now() / 1000);

      // Get AI model name from result
      const aiModel = aiResult.ai_model || aiResult.model || 'llama-3.2-vision';

      // Build Sui Move transaction
      // Transaction is like a blueprint for what we want to do on-chain
      const tx = new Transaction();
      
      // Call the mint_diagnosis function from our Move contract
      tx.moveCall({
        target: `${PACKAGE_ID}::record::mint_diagnosis`,
        arguments: [
          account.address,        // patient: address (current wallet)
          hashBytes,              // report_hash: vector<u8>
          aiModel,                // ai_model: String
          severity,               // severity: String
          timestamp,              // timestamp: u64
        ],
      });

      // Sign and execute the transaction
      // This will prompt user to approve in wallet and submit to Sui network
      const result = await signAndExecute(
        {
          transaction: tx,
          chain: 'testnet',
        },
        {
          // Success callback: called when transaction is confirmed
          onSuccess: (result) => {
            // Store transaction digest (hash) for verification
            setTxHash(result.digest);
            console.log('Transaction successful:', result.digest);
            
            // Record blockchain verification in analytics
            recordVerification();
            
            // Dispatch event to update analytics panel
            window.dispatchEvent(new Event('drsui_stats_updated'));
          },
          // Error callback: called if transaction fails
          onError: (error) => {
            console.error('Transaction error:', error);
            setError(`Transaction failed: ${error.message || 'Unknown error'}`);
          },
        }
      );

      // Also set txHash directly from result (if callback doesn't fire)
      if (result?.digest) {
        setTxHash(result.digest);
        
        // Record blockchain verification in analytics
        recordVerification();
        
        // Dispatch event to update analytics panel
        window.dispatchEvent(new Event('drsui_stats_updated'));
      }

    } catch (err) {
      // Handle errors during transaction creation/execution
      console.error('Mint error:', err);
      setError(
        err.message || 
        'Failed to mint proof. Please check that PACKAGE_ID is set correctly.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ========== Styling Object ==========
  // Inline styles for consistent, professional medical look
  const styles = {
    container: {
      maxWidth: '900px',
      margin: '0 auto',
    },
    card: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '32px',
      marginBottom: '24px',
    },
    title: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#0d9488', // Teal primary color
      marginBottom: '8px',
    },
    description: {
      fontSize: '16px',
      color: '#64748b',
      marginBottom: '24px',
    },
    dropzone: {
      border: '2px dashed #14b8a6', // Cyan border
      borderRadius: '8px',
      padding: '48px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      backgroundColor: '#f0fdfa', // Light teal background
    },
    dropzoneHover: {
      borderColor: '#0d9488',
      backgroundColor: '#ccfbf1',
    },
    button: {
      backgroundColor: '#0d9488',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    buttonDisabled: {
      backgroundColor: '#94a3b8',
      cursor: 'not-allowed',
      opacity: 0.6,
    },
    buttonHover: {
      backgroundColor: '#0f766e',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(13, 148, 136, 0.3)',
    },
    resultsCard: {
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginTop: '24px',
    },
    findingsList: {
      listStyle: 'none',
      padding: 0,
      margin: '16px 0',
    },
    findingItem: {
      padding: '8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    criticalAlert: {
      backgroundColor: '#fee2e2',
      border: '2px solid #ef4444',
      borderRadius: '8px',
      padding: '16px',
      margin: '16px 0',
      color: '#991b1b',
    },
    hashDisplay: {
      fontFamily: 'monospace',
      fontSize: '14px',
      backgroundColor: '#f1f5f9',
      padding: '8px 12px',
      borderRadius: '4px',
      wordBreak: 'break-all',
      marginTop: '8px',
    },
    badge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '16px',
      fontSize: '12px',
      fontWeight: '600',
      marginLeft: '8px',
    },
    successBox: {
      backgroundColor: '#d1fae5',
      border: '2px solid #10b981',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
    },
    errorBox: {
      backgroundColor: '#fee2e2',
      border: '2px solid #ef4444',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '16px',
      color: '#991b1b',
    },
    loadingSpinner: {
      display: 'inline-block',
      width: '20px',
      height: '20px',
      border: '3px solid #f3f4f6',
      borderTop: '3px solid #0d9488',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
  };

  // ========== Render Component ==========
  return (
    <div style={styles.container}>
      {/* Title and Description Section */}
      <div style={styles.card}>
        <h2 style={styles.title}>📋 Upload Medical Image for Analysis</h2>
        <p style={styles.description}>
          Upload a DICOM medical image (X-ray, CT scan, etc.) to get AI-powered analysis 
          and create an immutable on-chain proof of diagnosis.
        </p>

        {/* TEE Toggle Checkbox (Visual Demo) */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useTEE}
              onChange={(e) => setUseTEE(e.target.checked)}
              style={{ marginRight: '8px', cursor: 'pointer' }}
            />
            <span>Enable Secure Processing</span>
          </label>
          {useTEE && (
            <span style={{ ...styles.badge, backgroundColor: '#14b8a6', color: 'white' }}>
              🔒 Atoma Secure
            </span>
          )}
        </div>

        {/* File Upload Dropzone */}
        <div
          style={styles.dropzone}
          onDrop={(e) => {
            e.preventDefault();
            handleFileChange(e);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = '#0d9488';
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.borderColor = '#14b8a6';
          }}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".dcm,.dicom"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {file ? (
            <div>
              <p style={{ fontSize: '18px', fontWeight: '600', color: '#0d9488' }}>
                ✅ {file.name}
              </p>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
                Click to select a different file or drag and drop
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '18px', fontWeight: '600', color: '#0d9488' }}>
                📁 Click to select or drag and drop DICOM file
              </p>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>
                Supported formats: .dcm, .dicom
              </p>
            </div>
          )}
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !file}
          style={{
            ...styles.button,
            ...((loading || !file) && styles.buttonDisabled),
            marginTop: '16px',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            if (!loading && file) {
              Object.assign(e.target.style, styles.buttonHover);
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'none';
            e.target.style.boxShadow = 'none';
          }}
        >
          {loading ? (
            <>
              <span style={styles.loadingSpinner}></span>
              <span style={{ marginLeft: '8px' }}>Analyzing...</span>
            </>
          ) : (
            '🤖 Analyze with AI'
          )}
        </button>
      </div>

      {/* AI Analysis Results Card */}
      {aiResult && (
        <div style={styles.resultsCard}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d9488', marginBottom: '16px' }}>
            📊 Analysis Results
          </h3>

          {/* Status and Modality */}
          {(aiResult.status || aiResult.modality) && (
            <div style={{ marginBottom: '16px' }}>
              {aiResult.status && (
                <p style={{ fontSize: '14px', color: '#64748b' }}>
                  <strong>Status:</strong> {aiResult.status}
                </p>
              )}
              {aiResult.modality && (
                <p style={{ fontSize: '14px', color: '#64748b' }}>
                  <strong>Modality:</strong> {aiResult.modality}
                </p>
              )}
            </div>
          )}

          {/* Necessary Findings (Green Checkmarks) */}
          {aiResult.findings?.necessary && aiResult.findings.necessary.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#059669', marginBottom: '8px' }}>
                ✅ Necessary Findings:
              </h4>
              <ul style={styles.findingsList}>
                {aiResult.findings.necessary.map((finding, index) => (
                  <li key={index} style={styles.findingItem}>
                    <span style={{ color: '#10b981', fontSize: '18px' }}>✓</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Possible Findings (Yellow Warning Icons) */}
          {aiResult.findings?.possible && aiResult.findings.possible.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#d97706', marginBottom: '8px' }}>
                ⚠️ Possible Findings:
              </h4>
              <ul style={styles.findingsList}>
                {aiResult.findings.possible.map((finding, index) => (
                  <li key={index} style={styles.findingItem}>
                    <span style={{ color: '#f59e0b', fontSize: '18px' }}>⚠</span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Critical Alert Box (Red) */}
          {aiResult.critical_alert && (
            <div style={styles.criticalAlert}>
              <h4 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                🚨 CRITICAL ALERT
              </h4>
              <p>{aiResult.critical_alert_message || 'Critical findings detected. Please consult with a healthcare provider immediately.'}</p>
            </div>
          )}

          {/* Recommendation */}
          {aiResult.recommendation && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#0d9488', marginBottom: '8px' }}>
                💡 Recommendation:
              </h4>
              <p style={{ color: '#475569' }}>{aiResult.recommendation}</p>
            </div>
          )}

          {/* Hash Display */}
          {(aiResult.hash || aiResult.report_hash) && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                Report Hash:
              </p>
              <div style={styles.hashDisplay}>
                {aiResult.hash || aiResult.report_hash}
              </div>
            </div>
          )}

          {/* Badges */}
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...styles.badge, backgroundColor: '#3b82f6', color: 'white' }}>
              🔐 Stored on Walrus
            </span>
            <span style={{ ...styles.badge, backgroundColor: '#14b8a6', color: 'white' }}>
              ⚡ Powered by Atoma
            </span>
          </div>

          {/* Verify on Sui Blockchain Button */}
          <button
            onClick={handleMintProof}
            disabled={loading || !account || PACKAGE_ID === "YOUR_PACKAGE_ID_HERE"}
            style={{
              ...styles.button,
              ...((loading || !account || PACKAGE_ID === "YOUR_PACKAGE_ID_HERE") && styles.buttonDisabled),
              marginTop: '16px',
              width: '100%',
            }}
          >
            {loading ? (
              <>
                <span style={styles.loadingSpinner}></span>
                <span style={{ marginLeft: '8px' }}>Minting...</span>
              </>
            ) : !account ? (
              '🔗 Connect Wallet to Verify'
            ) : (
              '✅ Verify on Sui Blockchain'
            )}
          </button>

          {/* Success Box with Transaction Hash */}
          {txHash && (
            <div style={styles.successBox}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#065f46', marginBottom: '8px' }}>
                ✅ Successfully Minted on Sui!
              </h4>
              <p style={{ fontSize: '14px', color: '#065f46', marginBottom: '8px' }}>
                Transaction Hash:
              </p>
              <div style={styles.hashDisplay}>
                {txHash}
              </div>
              <a
                href={`https://suiscan.xyz/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '8px',
                  color: '#059669',
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
              >
                🔍 View on Suiscan →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={styles.errorBox}>
          <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            ❌ Error
          </h4>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

