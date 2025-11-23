import React, { useState, useEffect } from 'react';

/**
 * GasStationStatus Component
 * 
 * Displays the current status of the gas station service, including:
 * - Online/offline status
 * - Sponsor wallet balance
 * - Sponsor address
 * - Network information
 * 
 * Automatically refreshes status every 30 seconds and notifies parent
 * component when status changes.
 * 
 * @param {Object} props
 * @param {string} props.gasStationUrl - URL of the gas station service
 * @param {Function} props.onStatusChange - Callback when status changes (receives status string)
 */
export function GasStationStatus({ 
  gasStationUrl = import.meta.env.VITE_GAS_STATION_URL || 
                  import.meta.env.VITE_GAS_STATION_URL || 
                  'http://localhost:3001',
  onStatusChange 
}) {
  // Status states: 'checking' | 'online' | 'offline' | 'low-balance'
  const [status, setStatus] = useState('checking');
  const [balance, setBalance] = useState(0);
  const [sponsorAddress, setSponsorAddress] = useState('');
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [statusData, setStatusData] = useState(null);

  /**
   * Fetch gas station status from the API
   * Called on mount and every 30 seconds
   */
  const fetchStatus = async () => {
    try {
      setError(null);
      
      const response = await fetch(`${gasStationUrl}/status`);
      
      if (!response.ok) {
        throw new Error(`Gas station returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract balance in SUI (convert from MIST)
      const balanceInSUI = Number(data.balance?.totalBalance || 0) / 1_000_000_000;
      
      // Determine status based on balance and response
      let newStatus;
      if (balanceInSUI < 0.5) {
        newStatus = 'low-balance';
      } else {
        newStatus = 'online';
      }
      
      // Update state
      setStatus(newStatus);
      setBalance(balanceInSUI);
      setSponsorAddress(data.sponsorAddress || '');
      setStatusData(data);
      
      // Notify parent component of status change
      if (onStatusChange) {
        onStatusChange(newStatus);
      }
      
    } catch (err) {
      console.error('Failed to fetch gas station status:', err);
      setStatus('offline');
      setError(err.message || 'Failed to connect to gas station');
      setStatusData(null);
      
      // Notify parent component
      if (onStatusChange) {
        onStatusChange('offline');
      }
    }
  };

  // Fetch status on mount and set up interval
  useEffect(() => {
    // Initial fetch
    fetchStatus();
    
    // Set up interval to fetch every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [gasStationUrl]); // Re-run if URL changes

  /**
   * Copy sponsor address to clipboard
   */
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(sponsorAddress);
      // You could add a toast notification here
      console.log('Address copied to clipboard');
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  /**
   * Truncate address for display
   */
  const truncateAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Status configuration
  const statusConfig = {
    'checking': {
      color: '#64748b',
      dotColor: '#94a3b8',
      label: 'Checking gas station...',
      bgColor: '#f1f5f9'
    },
    'online': {
      color: '#059669',
      dotColor: '#10b981',
      label: 'Gas Station Online',
      bgColor: '#d1fae5'
    },
    'low-balance': {
      color: '#d97706',
      dotColor: '#f59e0b',
      label: 'Gas Station Low Balance',
      bgColor: '#fef3c7'
    },
    'offline': {
      color: '#dc2626',
      dotColor: '#ef4444',
      label: 'Gas Station Offline',
      bgColor: '#fee2e2'
    }
  };

  const config = statusConfig[status] || statusConfig.checking;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Main Status Badge */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          backgroundColor: config.bgColor,
          border: `2px solid ${config.color}`,
          borderRadius: '8px',
          padding: '12px 16px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          minWidth: '200px',
          maxWidth: '300px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        }}
      >
        {/* Status Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: expanded ? '8px' : '0'
        }}>
          {/* Status Dot */}
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: config.dotColor,
            display: 'inline-block',
            boxShadow: `0 0 8px ${config.dotColor}80`
          }}></span>
          
          {/* Status Label */}
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: config.color,
            flex: 1
          }}>
            {config.label}
          </span>
          
          {/* Expand/Collapse Icon */}
          <span style={{
            fontSize: '12px',
            color: config.color,
            opacity: 0.7
          }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>

        {/* Balance Display (always visible when online/low-balance) */}
        {(status === 'online' || status === 'low-balance') && balance > 0 && (
          <div style={{
            fontSize: '13px',
            color: config.color,
            marginTop: '4px',
            fontWeight: '500'
          }}>
            Balance: {balance.toFixed(4)} SUI
          </div>
        )}

        {/* Low Balance Warning */}
        {status === 'low-balance' && (
          <div style={{
            fontSize: '12px',
            color: '#92400e',
            marginTop: '4px',
            padding: '4px 8px',
            backgroundColor: '#fef3c7',
            borderRadius: '4px'
          }}>
            ⚠️ Balance below 0.5 SUI - refill soon!
          </div>
        )}

        {/* Error Message */}
        {error && status === 'offline' && (
          <div style={{
            fontSize: '12px',
            color: '#991b1b',
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
            {error}
          </div>
        )}

        {/* Expanded Details */}
        {expanded && statusData && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: `1px solid ${config.color}40`
          }}>
            {/* Sponsor Address */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Sponsor Address
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <code style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: config.color,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  flex: 1
                }}>
                  {truncateAddress(sponsorAddress)}
                </code>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyAddress();
                  }}
                  style={{
                    backgroundColor: config.color,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Full Balance */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Full Balance
              </div>
              <div style={{
                fontSize: '13px',
                color: config.color,
                fontWeight: '600'
              }}>
                {balance.toFixed(6)} SUI
                {statusData.balance && (
                  <span style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginLeft: '8px'
                  }}>
                    ({statusData.balance.coinObjectCount} coins)
                  </span>
                )}
              </div>
            </div>

            {/* Network */}
            {statusData.network && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Network
                </div>
                <div style={{
                  fontSize: '13px',
                  color: config.color,
                  fontWeight: '500'
                }}>
                  {statusData.network}
                </div>
              </div>
            )}

            {/* Allowed Package */}
            {statusData.allowedPackage && (
              <div>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Allowed Package
                </div>
                <code style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: config.color,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  display: 'block',
                  wordBreak: 'break-all'
                }}>
                  {truncateAddress(statusData.allowedPackage)}
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

