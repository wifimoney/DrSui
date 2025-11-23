import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Upload, FileImage, Loader2, CheckCircle2, XCircle, AlertTriangle, Download, Save, RotateCcw, Shield, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentAccount } from '@mysten/dapp-kit';

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
    image_commitment?: string;
    zk_proof?: any;
    tee_attestation?: any;
  };
}

interface DiagnosticAnalysisResult {
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
  image_commitment?: string;
  zk_proof?: any;
  tee_attestation?: any;
}

/**
 * DoctorDashboard Component
 * 
 * Displays all uploaded patient images and their analysis results.
 * Auto-refreshes every 30 seconds to check for new analyses.
 */
export function DoctorDashboard() {
  // Existing state for Recent Analyses view
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Diagnostic Tool state
  const [diagnosticMode, setDiagnosticMode] = useState<'recent' | 'diagnostic'>('recent');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DiagnosticAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [proofVerified, setProofVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const account = useCurrentAccount();

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
   * Truncate patient ID for display
   */
  const truncateAddress = (address: string) => {
    if (address === 'Anonymous' || address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Handle file selection for diagnostic tool
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setAnalysisResult(null);
      setAnalysisError(null);
      setProofVerified(false);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Handle drag and drop
   */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadedFile(file);
      setAnalysisResult(null);
      setAnalysisError(null);
      setProofVerified(false);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  /**
   * Handle diagnostic upload and analysis
   */
  const handleDiagnosticUpload = async () => {
    if (!uploadedFile) {
      setAnalysisError('Please select a file first');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setProofVerified(false);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      console.log('🔬 Starting diagnostic analysis...');
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Analysis failed' }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Diagnostic analysis complete:', result);
      setAnalysisResult(result);
      toast.success('Analysis complete!', {
        description: `Status: ${result.status || 'Unknown'}`,
      });
    } catch (err) {
      console.error('❌ Diagnostic analysis error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze image';
      setAnalysisError(errorMessage);
      toast.error('Analysis failed', {
        description: errorMessage,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Verify ZK proof
   */
  const handleVerifyProof = async () => {
    if (!analysisResult?.zk_proof) {
      setAnalysisError('No ZK proof available to verify');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/verify-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisResult.zk_proof),
      });

      const result = await response.json();
      const isValid = result.is_valid || result.valid || false;
      setProofVerified(isValid);

      if (isValid) {
        toast.success('Proof verified!', {
          description: 'ZK proof is cryptographically valid',
        });
      } else {
        toast.error('Proof verification failed', {
          description: 'The proof may be invalid or tampered with',
        });
      }
    } catch (err) {
      console.error('❌ Verification error:', err);
      setAnalysisError('Failed to verify proof');
      toast.error('Verification failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Save diagnostic report
   */
  const handleSaveReport = () => {
    if (!analysisResult || !uploadedFile) {
      toast.error('No analysis to save');
      return;
    }

    try {
      const analyses = JSON.parse(localStorage.getItem('drsui_analyses') || '[]');
      const newAnalysis: AnalysisResult = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        patientId: account?.address || 'Doctor',
        fileName: uploadedFile.name,
        result: analysisResult,
      };
      analyses.unshift(newAnalysis);
      const recentAnalyses = analyses.slice(0, 50);
      localStorage.setItem('drsui_analyses', JSON.stringify(recentAnalyses));
      
      // Dispatch event to update Recent Analyses view
      window.dispatchEvent(new CustomEvent('drsui_new_analysis', { detail: newAnalysis }));
      
      toast.success('Report saved!', {
        description: 'Diagnostic report has been saved to Recent Analyses',
      });
    } catch (err) {
      console.error('❌ Failed to save report:', err);
      toast.error('Failed to save report', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  /**
   * Export report as JSON
   */
  const handleExportReport = () => {
    if (!analysisResult || !uploadedFile) {
      toast.error('No analysis to export');
      return;
    }

    try {
      const exportData = {
        fileName: uploadedFile.name,
        timestamp: new Date().toISOString(),
        analysis: analysisResult,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagnostic-report-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Report exported!', {
        description: 'Diagnostic report downloaded as JSON',
      });
    } catch (err) {
      console.error('❌ Failed to export report:', err);
      toast.error('Failed to export report');
    }
  };

  /**
   * Clear diagnostic tool
   */
  const handleClear = () => {
    setUploadedFile(null);
    setImagePreview(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setProofVerified(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Get severity badge color
   */
  const getSeverityColor = (severity?: string) => {
    const sev = (severity || 'NORMAL').toUpperCase();
    if (sev === 'HIGH') return 'bg-red-500 text-white';
    if (sev === 'MEDIUM') return 'bg-yellow-500 text-white';
    return 'bg-green-500 text-white';
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-500 text-white';
    const stat = status.toUpperCase();
    if (stat.includes('NORMAL')) return 'bg-green-500 text-white';
    if (stat.includes('ABNORMAL')) return 'bg-red-500 text-white';
    if (stat.includes('UNREADABLE')) return 'bg-gray-500 text-white';
    return 'bg-blue-500 text-white';
  };

  // Render Recent Analyses view
  const renderRecentAnalyses = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#4DA2FF]"></div>
          <p className="mt-2 text-gray-600">Loading analyses...</p>
        </div>
      );
    }

    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#4DA2FF]">Recent Analyses</h2>
          <div className="flex items-center gap-4">
            {error && (
              <span className="text-sm text-yellow-600">⚠️ {error}</span>
            )}
            <Button
              onClick={fetchAnalyses}
              className="bg-[#4DA2FF] hover:bg-[#3d8feb] text-white"
            >
              🔄 Refresh
            </Button>
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
      </>
    );
  };

  // Render Diagnostic Tool view
  const renderDiagnosticTool = () => {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#4DA2FF]">Diagnostic Tool</h2>
          {analysisResult && (
            <div className="flex gap-2">
              <Button
                onClick={handleSaveReport}
                className="bg-[#4DA2FF] hover:bg-[#3d8feb] text-white"
                size="sm"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Report
              </Button>
              <Button
                onClick={handleExportReport}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* File Upload Section */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-[#4DA2FF]">Upload Medical Image</h3>
          
          {!uploadedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-[#C0E6FF] rounded-lg p-12 text-center hover:border-[#4DA2FF] transition-colors cursor-pointer bg-[#C0E6FF]/10"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-[#4DA2FF]" />
              <p className="text-gray-700 mb-2 font-medium">Drag and drop an image here, or click to select</p>
              <p className="text-sm text-gray-500">Supports DICOM (.dcm), PNG, JPG, JPEG</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dcm,.dicom,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#C0E6FF]/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileImage className="w-8 h-8 text-[#4DA2FF]" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setUploadedFile(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  variant="outline"
                  size="sm"
                >
                  Remove
                </Button>
              </div>

              {imagePreview && (
                <div className="border rounded-lg overflow-hidden bg-black">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                </div>
              )}

              {!analysisResult && (
                <Button
                  onClick={handleDiagnosticUpload}
                  disabled={isAnalyzing}
                  className="w-full bg-[#4DA2FF] hover:bg-[#3d8feb] text-white"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FileImage className="w-4 h-4 mr-2" />
                      Analyze Image
                    </>
                  )}
                </Button>
              )}

              {analysisError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <XCircle className="w-5 h-5" />
                    <p className="font-medium">Analysis Error</p>
                  </div>
                  <p className="text-sm text-red-600 mt-1">{analysisError}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Analysis Results Section */}
        {analysisResult && (
          <div className="space-y-4">
            {/* Status and Modality */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#4DA2FF]">Analysis Results</h3>
                <div className="flex gap-2">
                  {analysisResult.status && (
                    <Badge className={getStatusColor(analysisResult.status)}>
                      {analysisResult.status}
                    </Badge>
                  )}
                  {analysisResult.severity && (
                    <Badge className={getSeverityColor(analysisResult.severity)}>
                      {analysisResult.severity}
                    </Badge>
                  )}
                </div>
              </div>

              {analysisResult.modality && (
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Modality:</strong> {analysisResult.modality}
                </p>
              )}

              {/* Findings */}
              <div className="space-y-4 mb-4">
                {analysisResult.findings?.necessary && analysisResult.findings.necessary.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Necessary Findings (Definitive)
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-6">
                      {analysisResult.findings.necessary.map((finding, idx) => (
                        <li key={idx} className="list-disc">{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysisResult.findings?.possible && analysisResult.findings.possible.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-yellow-600 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Possible Findings (Uncertain)
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1 ml-6">
                      {analysisResult.findings.possible.map((finding, idx) => (
                        <li key={idx} className="list-disc">{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Confidence and Recommendation */}
              <div className="space-y-3">
                {analysisResult.confidence !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">Confidence</span>
                      <span className="text-gray-600">{analysisResult.confidence}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#4DA2FF] h-2 rounded-full transition-all"
                        style={{ width: `${analysisResult.confidence}%` }}
                      />
                    </div>
                  </div>
                )}

                {analysisResult.recommendation && (
                  <div className="p-4 bg-[#C0E6FF]/20 rounded-lg">
                    <p className="text-sm font-medium text-[#4DA2FF] mb-1">Recommendation</p>
                    <p className="text-sm text-gray-700">{analysisResult.recommendation}</p>
                  </div>
                )}

                {analysisResult.critical_alert && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="w-5 h-5" />
                      <p className="font-semibold">Critical Alert</p>
                    </div>
                    <p className="text-sm text-red-600 mt-1">This case requires immediate attention.</p>
                  </div>
                )}
              </div>

              {/* AI Model Info */}
              {analysisResult.ai_model && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    <strong>AI Model:</strong> {analysisResult.ai_model}
                  </p>
                </div>
              )}
            </Card>

            {/* ZK Proof Section */}
            {analysisResult.zk_proof && (
              <Card className="p-6 bg-[#C0E6FF]/10 border-[#4DA2FF]/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#4DA2FF] flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Zero-Knowledge Proof
                  </h3>
                  {proofVerified && (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>

                <div className="space-y-3">
                  {analysisResult.image_commitment && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Image Commitment</p>
                      <p className="text-xs font-mono text-gray-500 bg-white p-2 rounded border">
                        {analysisResult.image_commitment.slice(0, 32)}...
                      </p>
                    </div>
                  )}

                  {analysisResult.tee_attestation && (
                    <div>
                      <Badge className="bg-[#4DA2FF] text-white">
                        ⚛️ Atoma Secure Enclave
                      </Badge>
                    </div>
                  )}

                  <Button
                    onClick={handleVerifyProof}
                    disabled={isAnalyzing}
                    variant="outline"
                    className="w-full border-[#4DA2FF] text-[#4DA2FF] hover:bg-[#4DA2FF] hover:text-white"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Verify Proof
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setDiagnosticMode('recent')}
          className={`px-4 py-2 font-medium transition-colors ${
            diagnosticMode === 'recent'
              ? 'text-[#4DA2FF] border-b-2 border-[#4DA2FF]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Recent Analyses
        </button>
        <button
          onClick={() => setDiagnosticMode('diagnostic')}
          className={`px-4 py-2 font-medium transition-colors ${
            diagnosticMode === 'diagnostic'
              ? 'text-[#4DA2FF] border-b-2 border-[#4DA2FF]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Diagnostic Tool
        </button>
      </div>

      {/* Content */}
      {diagnosticMode === 'recent' ? renderRecentAnalyses() : renderDiagnosticTool()}
    </div>
  );
}

