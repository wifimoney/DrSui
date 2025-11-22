import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

// Get backend URL from environment variable
// Vite uses import.meta.env (available at build time)
// Note: In Vite, process.env is not available in browser, must use import.meta.env
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

interface AnalysisResult {
  id: number;
  timestamp: string;
  patientId: string;
  fileName: string;
  result: {
    status?: string;
    modality?: string;
    findings?: {
      necessary?: string[];
      possible?: string[];
    };
    severity?: string;
    confidence?: number;
    recommendation?: string;
    critical_alert?: boolean;
    hash?: string;
    ai_model?: string;
  };
}

/**
 * DoctorDashboard Component
 * 
 * Displays all uploaded patient images and their analysis results.
 * Auto-refreshes every 30 seconds to check for new analyses.
 */
export function DoctorDashboard() {
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /**
   * Fetch analyses from backend API
   * Falls back to localStorage if backend is unavailable
   */
  const fetchAnalyses = async () => {
    try {
      console.log('🔄 Fetching analyses from backend...');
      const response = await fetch(`${BACKEND_URL}/analyses`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Retrieved ${data.returned} analyses from backend`);
        setAnalyses(data.analyses || []);
        setError(null);
      } else {
        throw new Error(`Backend returned status ${response.status}`);
      }
    } catch (err) {
      console.warn('⚠️ Backend unavailable, using localStorage:', err);
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('drsui_analyses');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log(`✅ Retrieved ${parsed.length} analyses from localStorage`);
          setAnalyses(parsed);
        } else {
          setAnalyses([]);
        }
        setError('Backend unavailable - showing cached data');
      } catch (storageErr) {
        console.error('❌ Failed to read localStorage:', storageErr);
        setAnalyses([]);
        setError('Cannot load analyses - check backend connection');
      }
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  /**
   * Initial fetch and setup auto-refresh
   */
  useEffect(() => {
    fetchAnalyses();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalyses, 30000);
    
    // Listen for new analysis events from UploadView
    const handleNewAnalysis = (event: CustomEvent) => {
      console.log('📢 New analysis event received:', event.detail);
      fetchAnalyses(); // Refresh immediately when new analysis is added
    };
    
    window.addEventListener('drsui_new_analysis', handleNewAnalysis as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('drsui_new_analysis', handleNewAnalysis as EventListener);
    };
  }, []);

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } catch {
      return timestamp;
    }
  };

  /**
   * Get severity badge color
   */
  const getSeverityColor = (severity?: string) => {
    const sev = (severity || 'NORMAL').toUpperCase();
    if (sev === 'HIGH') return 'bg-red-500';
    if (sev === 'MEDIUM') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  /**
   * Truncate patient ID for display
   */
  const truncateAddress = (address: string) => {
    if (address === 'Anonymous' || address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Recent Analyses</h2>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          <p className="mt-2 text-gray-600">Loading analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-teal-600">Recent Analyses</h2>
        <div className="flex items-center gap-4">
          {error && (
            <span className="text-sm text-yellow-600">⚠️ {error}</span>
          )}
          <button
            onClick={fetchAnalyses}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
          >
            🔄 Refresh
          </button>
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {analyses.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No analyses yet. Patient uploads will appear here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map((analysis) => (
            <Card key={analysis.id} className="p-4 hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {analysis.fileName || 'Unknown File'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {truncateAddress(analysis.patientId)} • {formatTimestamp(analysis.timestamp)}
                  </p>
                </div>
                {analysis.result.severity && (
                  <Badge className={getSeverityColor(analysis.result.severity)}>
                    {analysis.result.severity}
                  </Badge>
                )}
              </div>

              {analysis.result.status && (
                <p className="text-sm mb-2">
                  <strong>Status:</strong> {analysis.result.status}
                </p>
              )}

              {analysis.result.modality && (
                <p className="text-sm mb-2 text-gray-600">
                  <strong>Modality:</strong> {analysis.result.modality}
                </p>
              )}

              {analysis.result.findings?.necessary && analysis.result.findings.necessary.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-green-600 mb-1">Necessary Findings:</p>
                  <ul className="text-xs text-gray-700 list-disc list-inside">
                    {analysis.result.findings.necessary.slice(0, 2).map((finding, idx) => (
                      <li key={idx} className="truncate">{finding}</li>
                    ))}
                    {analysis.result.findings.necessary.length > 2 && (
                      <li className="text-gray-500">+{analysis.result.findings.necessary.length - 2} more</li>
                    )}
                  </ul>
                </div>
              )}

              {analysis.result.findings?.possible && analysis.result.findings.possible.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-yellow-600 mb-1">Possible Findings:</p>
                  <ul className="text-xs text-gray-700 list-disc list-inside">
                    {analysis.result.findings.possible.slice(0, 2).map((finding, idx) => (
                      <li key={idx} className="truncate">{finding}</li>
                    ))}
                    {analysis.result.findings.possible.length > 2 && (
                      <li className="text-gray-500">+{analysis.result.findings.possible.length - 2} more</li>
                    )}
                  </ul>
                </div>
              )}

              {analysis.result.critical_alert && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                  🚨 Critical Alert
                </div>
              )}

              {analysis.result.confidence && (
                <p className="text-xs text-gray-500 mt-2">
                  Confidence: {analysis.result.confidence}%
                </p>
              )}

              {analysis.result.hash && (
                <p className="text-xs font-mono text-gray-400 mt-2 truncate" title={analysis.result.hash}>
                  Hash: {analysis.result.hash.slice(0, 16)}...
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

