import React, { useState, useEffect } from 'react';

/**
 * AnalyticsPanel Component
 * 
 * A collapsible dashboard showing usage statistics for the DrSui Medical Scanner.
 * Tracks metrics in localStorage and displays them in a fixed footer panel.
 * 
 * This impresses hackathon judges by demonstrating metrics tracking and analytics.
 * 
 * Features:
 * - Tracks total scans performed
 * - Categorizes scans by result type (normal, possible findings, critical)
 * - Tracks blockchain verifications
 * - Displays visual charts and statistics
 * - Allows resetting statistics
 */

// LocalStorage keys for persistence
const STORAGE_KEYS = {
  TOTAL_SCANS: 'drsui_total_scans',
  NORMAL_SCANS: 'drsui_normal_scans',
  POSSIBLE_SCANS: 'drsui_possible_scans',
  CRITICAL_SCANS: 'drsui_critical_scans',
  VERIFIED_SCANS: 'drsui_verified_scans',
  LAST_RESET_DATE: 'drsui_last_reset_date',
  SCANS_TODAY: 'drsui_scans_today',
  TODAY_DATE: 'drsui_today_date',
};

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Initialize stats from localStorage or return defaults
 */
function initializeStats() {
  const today = getTodayDate();
  const storedToday = localStorage.getItem(STORAGE_KEYS.TODAY_DATE);
  
  // Reset daily counter if it's a new day
  if (storedToday !== today) {
    localStorage.setItem(STORAGE_KEYS.TODAY_DATE, today);
    localStorage.setItem(STORAGE_KEYS.SCANS_TODAY, '0');
  }

  return {
    totalScans: parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_SCANS) || '0', 10),
    normalScans: parseInt(localStorage.getItem(STORAGE_KEYS.NORMAL_SCANS) || '0', 10),
    possibleScans: parseInt(localStorage.getItem(STORAGE_KEYS.POSSIBLE_SCANS) || '0', 10),
    criticalScans: parseInt(localStorage.getItem(STORAGE_KEYS.CRITICAL_SCANS) || '0', 10),
    verifiedScans: parseInt(localStorage.getItem(STORAGE_KEYS.VERIFIED_SCANS) || '0', 10),
    scansToday: parseInt(localStorage.getItem(STORAGE_KEYS.SCANS_TODAY) || '0', 10),
  };
}

/**
 * Record a new scan in analytics
 * 
 * @param {string} severity - Severity level: "NORMAL", "MEDIUM", "HIGH"
 */
export function recordScan(severity) {
  const today = getTodayDate();
  const storedToday = localStorage.getItem(STORAGE_KEYS.TODAY_DATE);
  
  // Reset daily counter if new day
  if (storedToday !== today) {
    localStorage.setItem(STORAGE_KEYS.TODAY_DATE, today);
    localStorage.setItem(STORAGE_KEYS.SCANS_TODAY, '0');
  }

  // Increment total scans
  const totalScans = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_SCANS) || '0', 10) + 1;
  localStorage.setItem(STORAGE_KEYS.TOTAL_SCANS, totalScans.toString());

  // Increment daily scans
  const scansToday = parseInt(localStorage.getItem(STORAGE_KEYS.SCANS_TODAY) || '0', 10) + 1;
  localStorage.setItem(STORAGE_KEYS.SCANS_TODAY, scansToday.toString());

  // Increment severity-specific counters
  const severityUpper = (severity || 'NORMAL').toUpperCase();
  if (severityUpper === 'NORMAL') {
    const normalScans = parseInt(localStorage.getItem(STORAGE_KEYS.NORMAL_SCANS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.NORMAL_SCANS, normalScans.toString());
  } else if (severityUpper === 'MEDIUM') {
    const possibleScans = parseInt(localStorage.getItem(STORAGE_KEYS.POSSIBLE_SCANS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.POSSIBLE_SCANS, possibleScans.toString());
  } else if (severityUpper === 'HIGH') {
    const criticalScans = parseInt(localStorage.getItem(STORAGE_KEYS.CRITICAL_SCANS) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.CRITICAL_SCANS, criticalScans.toString());
  }
}

/**
 * Record a blockchain verification
 */
export function recordVerification() {
  const verifiedScans = parseInt(localStorage.getItem(STORAGE_KEYS.VERIFIED_SCANS) || '0', 10) + 1;
  localStorage.setItem(STORAGE_KEYS.VERIFIED_SCANS, verifiedScans.toString());
}

export function AnalyticsPanel() {
  // State for panel visibility (collapsed/expanded)
  const [isExpanded, setIsExpanded] = useState(false);
  
  // State for statistics
  const [stats, setStats] = useState(initializeStats);

  // Refresh stats periodically (every 5 seconds) to catch updates from other components
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(initializeStats());
    }, 5000);

    // Also refresh on storage events (when localStorage is updated)
    const handleStorageChange = () => {
      setStats(initializeStats());
    };
    window.addEventListener('storage', handleStorageChange);

    // Custom event for same-window updates
    window.addEventListener('drsui_stats_updated', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('drsui_stats_updated', handleStorageChange);
    };
  }, []);

  /**
   * Reset all statistics
   */
  const handleResetStats = () => {
    if (window.confirm('Are you sure you want to reset all analytics? This cannot be undone.')) {
      localStorage.setItem(STORAGE_KEYS.TOTAL_SCANS, '0');
      localStorage.setItem(STORAGE_KEYS.NORMAL_SCANS, '0');
      localStorage.setItem(STORAGE_KEYS.POSSIBLE_SCANS, '0');
      localStorage.setItem(STORAGE_KEYS.CRITICAL_SCANS, '0');
      localStorage.setItem(STORAGE_KEYS.VERIFIED_SCANS, '0');
      localStorage.setItem(STORAGE_KEYS.SCANS_TODAY, '0');
      localStorage.setItem(STORAGE_KEYS.LAST_RESET_DATE, new Date().toISOString());
      setStats(initializeStats());
      
      // Dispatch event to notify other components
      window.dispatchEvent(new Event('drsui_stats_updated'));
    }
  };

  // Calculate percentages for charts
  const totalBySeverity = stats.normalScans + stats.possibleScans + stats.criticalScans;
  const normalPercentage = totalBySeverity > 0 ? (stats.normalScans / totalBySeverity) * 100 : 0;
  const possiblePercentage = totalBySeverity > 0 ? (stats.possibleScans / totalBySeverity) * 100 : 0;
  const criticalPercentage = totalBySeverity > 0 ? (stats.criticalScans / totalBySeverity) * 100 : 0;
  
  // Calculate verification percentage
  const verificationPercentage = stats.totalScans > 0 ? (stats.verifiedScans / stats.totalScans) * 100 : 0;

  // Styles object for consistent styling
  const styles = {
    panel: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ffffff',
      borderTop: '2px solid #0d9488',
      boxShadow: '0 -4px 6px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease',
      zIndex: 1000,
      maxHeight: isExpanded ? '400px' : '60px',
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      backgroundColor: '#f0fdfa',
      cursor: 'pointer',
      borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
    },
    title: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#0d9488',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    content: {
      padding: '24px',
      maxHeight: '336px',
      overflowY: 'auto',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '20px',
      marginBottom: '24px',
    },
    statCard: {
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #e5e7eb',
    },
    statLabel: {
      fontSize: '12px',
      color: '#6b7280',
      textTransform: 'uppercase',
      fontWeight: '600',
      marginBottom: '4px',
    },
    statValue: {
      fontSize: '28px',
      fontWeight: 'bold',
      color: '#0d9488',
    },
    chartContainer: {
      marginBottom: '24px',
    },
    chartTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '12px',
    },
    progressBar: {
      width: '100%',
      height: '8px',
      backgroundColor: '#e5e7eb',
      borderRadius: '4px',
      overflow: 'hidden',
      marginBottom: '8px',
    },
    progressFill: {
      height: '100%',
      transition: 'width 0.3s ease',
      borderRadius: '4px',
    },
    progressLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '4px',
    },
    button: {
      backgroundColor: '#ef4444',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '8px 16px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    },
    buttonHover: {
      backgroundColor: '#dc2626',
      transform: 'translateY(-1px)',
    },
  };

  return (
    <div style={styles.panel}>
      {/* Header - Click to expand/collapse */}
      <div 
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e0f2f1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f0fdfa';
        }}
      >
        <div style={styles.title}>
          <span>📊</span>
          <span>Analytics Dashboard</span>
          {stats.scansToday > 0 && (
            <span style={{
              backgroundColor: '#0d9488',
              color: 'white',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '12px',
              fontWeight: '600',
            }}>
              {stats.scansToday} today
            </span>
          )}
        </div>
        <span style={{ fontSize: '20px', color: '#0d9488' }}>
          {isExpanded ? '▼' : '▲'}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={styles.content}>
          {/* Key Metrics Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Total Scans</div>
              <div style={styles.statValue}>{stats.totalScans}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Scans Today</div>
              <div style={styles.statValue}>{stats.scansToday}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Verified On-Chain</div>
              <div style={styles.statValue}>{stats.verifiedScans}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {verificationPercentage.toFixed(1)}% of total
              </div>
            </div>
          </div>

          {/* Result Distribution Chart */}
          <div style={styles.chartContainer}>
            <div style={styles.chartTitle}>Result Distribution</div>
            
            {/* Normal Results */}
            <div>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${normalPercentage}%`,
                    backgroundColor: '#10b981', // Green
                  }}
                />
              </div>
              <div style={styles.progressLabel}>
                <span>✅ Normal: {stats.normalScans}</span>
                <span>{normalPercentage.toFixed(1)}%</span>
              </div>
            </div>

            {/* Possible Findings */}
            <div>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${possiblePercentage}%`,
                    backgroundColor: '#f59e0b', // Yellow
                  }}
                />
              </div>
              <div style={styles.progressLabel}>
                <span>⚠️ Possible Findings: {stats.possibleScans}</span>
                <span>{possiblePercentage.toFixed(1)}%</span>
              </div>
            </div>

            {/* Critical Findings */}
            <div>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${criticalPercentage}%`,
                    backgroundColor: '#ef4444', // Red
                  }}
                />
              </div>
              <div style={styles.progressLabel}>
                <span>🚨 Critical: {stats.criticalScans}</span>
                <span>{criticalPercentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Blockchain Verification Stats */}
          <div style={{
            backgroundColor: '#f0fdfa',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            border: '1px solid #0d9488',
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0d9488', marginBottom: '8px' }}>
              🔗 Blockchain Verifications
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: `${Math.min(verificationPercentage, 100)}%`,
                height: '24px',
                backgroundColor: '#0d9488',
                borderRadius: '12px',
                transition: 'width 0.3s ease',
              }} />
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', minWidth: '80px' }}>
                {stats.verifiedScans} / {stats.totalScans}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
              {stats.verifiedScans} scans have been verified on the Sui blockchain
            </div>
          </div>

          {/* Reset Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleResetStats}
              style={styles.button}
              onMouseEnter={(e) => {
                Object.assign(e.target.style, styles.buttonHover);
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#ef4444';
                e.target.style.transform = 'none';
              }}
            >
              🗑️ Reset Stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

