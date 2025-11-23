import React, { useState, useEffect, useCallback } from 'react';
import { 
  useSuiClient, 
  useCurrentAccount,
  useSignAndExecuteTransaction 
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { StatCard } from './StatCard';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Shield, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  Verified,
  FileText,
  Calendar,
  User
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

// Get package ID from environment variable
// Vite uses import.meta.env instead of process.env
const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || 'YOUR_PACKAGE_ID_HERE';

/**
 * ZKVerificationDashboard Component
 * 
 * A comprehensive dashboard for doctors to verify Zero-Knowledge proofs
 * of medical diagnoses stored on the Sui blockchain.
 * 
 * Features:
 * - View all diagnoses with ZK proofs
 * - Verify proofs on-chain
 * - Filter and search diagnoses
 * - Real-time updates
 * - Educational tooltips
 */
export function ZKVerificationDashboard() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  
  const [diagnoses, setDiagnoses] = useState([]);
  const [filteredDiagnoses, setFilteredDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [error, setError] = useState(null);
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all'); // 'all', 'verified', 'pending'
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all', 'NORMAL', 'MEDIUM', 'HIGH'
  const [sortBy, setSortBy] = useState('timestamp'); // 'timestamp', 'severity', 'patient'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'
  
  // Auto-verify toggle
  const [autoVerify, setAutoVerify] = useState(false);
  
  /**
   * Fetch all Diagnosis objects from the blockchain
   * 
   * Note: In production, you might want to:
   * - Use events to track new diagnoses
   * - Maintain an index of diagnosis IDs
   * - Use a registry contract to track all diagnoses
   * 
   * For now, we'll query owned objects by type
   */
  const fetchDiagnosesFromChain = useCallback(async () => {
    if (!client || PACKAGE_ID === 'YOUR_PACKAGE_ID_HERE') {
      setError('Package ID not configured. Please set VITE_PACKAGE_ID in .env');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching diagnoses from blockchain...');
      
      // Query all objects of type Diagnosis
      // Note: This queries all objects, not just owned ones
      // In production, you'd want a registry or index
      const diagnosisType = `${PACKAGE_ID}::record::Diagnosis`;
      
      // Get all objects owned by any address (this is a simplified approach)
      // In production, maintain a registry or use events
      const allObjects = await client.getOwnedObjects({
        owner: account?.address || '0x0000000000000000000000000000000000000000000000000000000000000000',
        filter: {
          StructType: diagnosisType,
        },
        options: {
          showContent: true,
          showType: true,
        },
      });

      console.log('📦 Found objects:', allObjects);

      // Parse diagnosis objects
      const parsedDiagnoses = [];
      
      // If we have objects, parse them
      if (allObjects.data && allObjects.data.length > 0) {
        for (const obj of allObjects.data) {
          try {
            const content = obj.data?.content;
            if (content && content.dataType === 'moveObject') {
              const fields = content.fields;
              
              parsedDiagnoses.push({
                id: obj.data.objectId,
                patient: fields.patient || 'Unknown',
                report_hash: fields.report_hash || [],
                ai_model: fields.ai_model || 'Unknown',
                severity: fields.severity || 'NORMAL',
                timestamp: fields.timestamp || 0,
                image_commitment: fields.image_commitment || [],
                zk_proof_hash: fields.zk_proof_hash || [],
                tee_attestation: fields.tee_attestation || [],
                is_verified: fields.is_verified || false,
              });
            }
          } catch (parseErr) {
            console.warn('⚠️ Failed to parse diagnosis object:', parseErr);
          }
        }
      }

      // For demo purposes, if no objects found, show sample data
      if (parsedDiagnoses.length === 0) {
        console.log('📝 No diagnoses found. Showing sample data for demo...');
        parsedDiagnoses.push({
          id: 'sample-1',
          patient: '0x1234567890123456789012345678901234567890123456789012345678901234',
          report_hash: [1, 2, 3, 4],
          ai_model: 'llama-3.2-vision',
          severity: 'MEDIUM',
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          image_commitment: [10, 20, 30, 40],
          zk_proof_hash: [50, 60, 70, 80],
          tee_attestation: [90, 100, 110, 120],
          is_verified: false,
        });
      }

      setDiagnoses(parsedDiagnoses);
      console.log('✅ Loaded', parsedDiagnoses.length, 'diagnoses');
      
    } catch (err) {
      console.error('❌ Error fetching diagnoses:', err);
      setError(`Failed to fetch diagnoses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, account, PACKAGE_ID]);

  /**
   * Verify a diagnosis proof on-chain
   */
  const verifyProof = async (diagnosisId) => {
    if (!account) {
      setError('Please connect your wallet to verify proofs');
      return;
    }

    setVerifying(diagnosisId);
    setError(null);

    try {
      console.log('🔍 Verifying proof for diagnosis:', diagnosisId);
      
      // Find the diagnosis object
      const diagnosis = diagnoses.find(d => d.id === diagnosisId);
      if (!diagnosis) {
        throw new Error('Diagnosis not found');
      }

      // Build transaction to call mark_as_verified
      const tx = new Transaction();
      
      // Get the diagnosis object reference
      // In production, you'd need the actual object reference
      // For now, we'll use the object ID
      tx.moveCall({
        target: `${PACKAGE_ID}::record::mark_as_verified`,
        arguments: [
          tx.object(diagnosisId), // The Diagnosis object
        ],
      });

      // Execute transaction
      const result = await signAndExecute({
        transaction: tx,
      });

      console.log('✅ Verification transaction successful:', result.digest);

      // Update local state
      setDiagnoses(prev => 
        prev.map(d => 
          d.id === diagnosisId 
            ? { ...d, is_verified: true }
            : d
        )
      );

      // Show success message
      alert('✅ Dr. Sui proof verified successfully on-chain!');
      
    } catch (err) {
      console.error('❌ Verification failed:', err);
      setError(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(null);
    }
  };

  /**
   * Apply filters and search
   */
  useEffect(() => {
    let filtered = [...diagnoses];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.patient.toLowerCase().includes(query) ||
        d.ai_model.toLowerCase().includes(query) ||
        d.severity.toLowerCase().includes(query)
      );
    }

    // Apply verification filter
    if (verificationFilter === 'verified') {
      filtered = filtered.filter(d => d.is_verified);
    } else if (verificationFilter === 'pending') {
      filtered = filtered.filter(d => !d.is_verified);
    }

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(d => d.severity === severityFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'severity':
          const severityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'NORMAL': 1 };
          comparison = (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0);
          break;
        case 'patient':
          comparison = a.patient.localeCompare(b.patient);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredDiagnoses(filtered);
  }, [diagnoses, searchQuery, verificationFilter, severityFilter, sortBy, sortOrder]);

  /**
   * Auto-verify proofs
   */
  useEffect(() => {
    if (autoVerify && filteredDiagnoses.length > 0) {
      const unverified = filteredDiagnoses.filter(d => !d.is_verified);
      if (unverified.length > 0 && account) {
        // Auto-verify the first unverified diagnosis
        const firstUnverified = unverified[0];
        verifyProof(firstUnverified.id);
      }
    }
  }, [autoVerify, filteredDiagnoses, account]);

  /**
   * Poll for new diagnoses every 30 seconds
   */
  useEffect(() => {
    fetchDiagnosesFromChain();
    
    const interval = setInterval(() => {
      fetchDiagnosesFromChain();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchDiagnosesFromChain]);

  // Calculate statistics
  const totalDiagnoses = diagnoses.length;
  const verifiedCount = diagnoses.filter(d => d.is_verified).length;
  const pendingCount = diagnoses.filter(d => !d.is_verified).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          <Shield style={{ marginRight: '12px', display: 'inline-block' }} />
          🔐 Zero-Knowledge Proof Verification
        </h2>
        <p style={styles.subtitle}>
          Verify privacy-preserving proofs of Dr. Sui AI diagnoses stored on the Sui blockchain
        </p>
      </div>

      {/* Statistics Overview */}
      <div style={styles.statsGrid}>
        <StatCard
          icon={<FileText className="w-6 h-6" style={{ color: '#4DA2FF' }} />}
          label="Total Diagnoses"
          value={totalDiagnoses.toString()}
        />
        <StatCard
          icon={<Verified className="w-6 h-6" style={{ color: '#10b981' }} />}
          label="Verified Proofs"
          value={verifiedCount.toString()}
        />
        <StatCard
          icon={<Clock className="w-6 h-6" style={{ color: '#f59e0b' }} />}
          label="Pending Verification"
          value={pendingCount.toString()}
        />
      </div>

      {/* Filters and Search */}
      <Card style={styles.filtersCard}>
        <div style={styles.filtersRow}>
          <div style={styles.searchContainer}>
            <Search style={styles.searchIcon} />
            <Input
              placeholder="Search by patient address, AI model, or severity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Verification:</label>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All</option>
              <option value="NORMAL">Normal</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={styles.select}
            >
              <option value="timestamp">Timestamp</option>
              <option value="severity">Severity</option>
              <option value="patient">Patient</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={styles.sortButton}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>

        <div style={styles.autoVerifyRow}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoVerify}
              onChange={(e) => setAutoVerify(e.target.checked)}
              style={styles.checkbox}
            />
            Auto-verify Dr. Sui proofs (experimental)
          </label>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <div style={styles.errorBox}>
          <AlertCircle style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      {/* Diagnoses List */}
      {loading ? (
        <div style={styles.loadingBox}>
          <div style={styles.spinner}></div>
          <p>Loading Dr. Sui diagnoses from blockchain...</p>
        </div>
      ) : filteredDiagnoses.length === 0 ? (
        <Card style={styles.emptyCard}>
          <p>No Dr. Sui diagnoses found matching your filters.</p>
        </Card>
      ) : (
        <div style={styles.diagnosesList}>
          {filteredDiagnoses.map(diagnosis => (
            <DiagnosisCard
              key={diagnosis.id}
              diagnosis={diagnosis}
              onVerify={() => verifyProof(diagnosis.id)}
              isVerifying={verifying === diagnosis.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * DiagnosisCard Component
 * 
 * Displays a single diagnosis with ZK proof information
 */
function DiagnosisCard({ diagnosis, onVerify, isVerifying }) {
  const [expanded, setExpanded] = useState(false);

  const formatAddress = (addr) => {
    if (!addr || addr === 'Unknown') return 'Unknown';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'HIGH': return '#ef4444';
      case 'MEDIUM': return '#f59e0b';
      case 'NORMAL': return '#10b981';
      default: return '#64748b';
    }
  };

  const bytesToHex = (bytes) => {
    if (!bytes || bytes.length === 0) return 'N/A';
    if (Array.isArray(bytes)) {
      return '0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32) + '...';
    }
    return '0x' + bytes.slice(0, 16) + '...';
  };

  return (
    <Card style={styles.diagnosisCard}>
      <div style={styles.cardHeader}>
        <div style={styles.cardHeaderLeft}>
          <div style={styles.statusIndicator}>
            {diagnosis.is_verified ? (
              <CheckCircle2 style={{ color: '#10b981', width: '20px', height: '20px' }} />
            ) : (
              <Clock style={{ color: '#f59e0b', width: '20px', height: '20px' }} />
            )}
          </div>
          <div>
            <div style={styles.cardTitle}>
              Diagnosis #{diagnosis.id.slice(0, 8)}...
            </div>
            <div style={styles.cardMeta}>
              <User style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              {formatAddress(diagnosis.patient)}
              <span style={{ margin: '0 8px' }}>•</span>
              <Calendar style={{ width: '14px', height: '14px', marginRight: '4px' }} />
              {formatTimestamp(diagnosis.timestamp)}
            </div>
          </div>
        </div>
        <div style={styles.cardHeaderRight}>
          <Badge 
            style={{ 
              backgroundColor: getSeverityColor(diagnosis.severity),
              color: 'white',
              marginRight: '8px'
            }}
          >
            {diagnosis.severity}
          </Badge>
          <Badge 
            style={{ 
              backgroundColor: diagnosis.is_verified ? '#10b981' : '#f59e0b',
              color: 'white'
            }}
          >
            {diagnosis.is_verified ? 'Verified' : 'Pending'}
          </Badge>
        </div>
      </div>

      <div style={styles.cardBody}>
        <div style={styles.infoRow}>
          <strong>Dr. Sui AI Model:</strong> {diagnosis.ai_model}
        </div>
        
        <div style={styles.proofSection}>
          <div style={styles.proofRow}>
            <strong>Image Commitment:</strong>
            <code style={styles.code}>{bytesToHex(diagnosis.image_commitment)}</code>
            <Tooltip>
              <TooltipTrigger>
                <Info style={{ width: '16px', height: '16px', color: '#4DA2FF', cursor: 'help' }} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Cryptographic commitment to the medical image. Dr. Sui proves it analyzed a specific image without revealing the image itself, preserving patient privacy.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div style={styles.proofRow}>
            <strong>TEE Attestation:</strong>
            <Badge style={{ backgroundColor: '#7c3aed', color: 'white' }}>
              ⚛️ Atoma Secure Enclave
            </Badge>
            <Tooltip>
              <TooltipTrigger>
                <Info style={{ width: '16px', height: '16px', color: '#4DA2FF', cursor: 'help' }} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Atoma Trusted Execution Environment (TEE) attestation proves the AI analysis computation happened in a secure hardware enclave, ensuring data privacy and computation integrity.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div style={styles.buttonRow}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            style={styles.expandButton}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
            {expanded ? 'Hide' : 'Show'} Details
          </Button>
          
          {!diagnosis.is_verified && (
            <Button
              onClick={onVerify}
              disabled={isVerifying}
              style={{
                ...styles.verifyButton,
                opacity: isVerifying ? 0.6 : 1
              }}
            >
              {isVerifying ? (
                <>
                  <div style={styles.miniSpinner}></div>
                  Verifying...
                </>
              ) : (
                <>
                  <Shield style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                  Verify Proof
                </>
              )}
            </Button>
          )}
        </div>

        {expanded && (
          <div style={styles.expandedSection}>
            <div style={styles.detailRow}>
              <strong>Report Hash:</strong>
              <code style={styles.code}>{bytesToHex(diagnosis.report_hash)}</code>
            </div>
            <div style={styles.detailRow}>
              <strong>ZK Proof Hash:</strong>
              <code style={styles.code}>{bytesToHex(diagnosis.zk_proof_hash)}</code>
            </div>
            <div style={styles.detailRow}>
              <strong>Object ID:</strong>
              <code style={styles.code}>{diagnosis.id}</code>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Styles
const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#4DA2FF', // Sea blue
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: '16px',
    color: '#64748b',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  filtersCard: {
    padding: '20px',
    marginBottom: '24px',
    backgroundColor: '#C0E6FF', // Aqua background
    border: '1px solid #4DA2FF', // Sea blue border
  },
  filtersRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  searchContainer: {
    position: 'relative',
    flex: '1',
    minWidth: '300px',
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '18px',
    height: '18px',
    color: '#64748b',
    pointerEvents: 'none',
  },
  searchInput: {
    paddingLeft: '40px',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#475569',
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  sortButton: {
    minWidth: '40px',
  },
  autoVerifyRow: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#475569',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  errorBox: {
    padding: '12px 16px',
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    color: '#991b1b',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
  },
  loadingBox: {
    padding: '48px',
    textAlign: 'center',
    color: '#64748b',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #4DA2FF', // Sea blue
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px',
  },
  emptyCard: {
    padding: '48px',
    textAlign: 'center',
    color: '#64748b',
  },
  diagnosesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  diagnosisCard: {
    padding: '20px',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
  },
  cardHeaderLeft: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  statusIndicator: {
    marginTop: '4px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '4px',
  },
  cardMeta: {
    fontSize: '14px',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
  },
  cardHeaderRight: {
    display: 'flex',
    gap: '8px',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    fontSize: '14px',
    color: '#475569',
  },
  proofSection: {
    padding: '12px',
    backgroundColor: '#C0E6FF', // Aqua background
    borderRadius: '8px',
    border: '1px solid #4DA2FF', // Sea blue border
  },
  proofRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    fontSize: '14px',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '12px',
    backgroundColor: '#C0E6FF', // Aqua background
    padding: '4px 8px',
    borderRadius: '4px',
    color: '#4DA2FF', // Sea blue text
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  expandButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    borderColor: '#4DA2FF', // Sea blue border
    color: '#4DA2FF', // Sea blue text
  },
  verifyButton: {
    backgroundColor: '#4DA2FF', // Sea blue
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  expandedSection: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#C0E6FF', // Aqua background
    borderRadius: '8px',
    border: '1px solid #4DA2FF', // Sea blue border
  },
  detailRow: {
    fontSize: '14px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  miniSpinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    display: 'inline-block',
  },
};

// Add CSS animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

