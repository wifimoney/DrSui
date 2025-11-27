# Diagnostic Tool Testing Guide

## Overview
This guide helps you test the Diagnostic Tool feature in the Doctor Dashboard to ensure it works correctly with metadata tracking.

## Prerequisites

1. **Backend Running**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload --port 8000
   ```

2. **Frontend Running**
   ```bash
   npm run dev
   ```

3. **Browser Console Open**
   - Open DevTools (F12)
   - Go to Console tab
   - Keep it open to see logging

## Testing Steps

### Test 1: Access Diagnostic Tool

1. Navigate to Doctor Portal
2. Click on "Recent Analyses" tab (should be default)
3. Click on "Diagnostic Tool" tab
4. **Expected**: Diagnostic Tool interface appears with:
   - File upload area (drag-and-drop zone)
   - "Upload Medical Image" heading
   - Instructions for supported file types

### Test 2: File Upload

1. Click on the upload area or drag a file
2. Select a test image file (DICOM, PNG, or JPG)
3. **Expected**:
   - File name and size appear
   - Image preview shows (if image file)
   - "Analyze Image" button appears
   - Console logs: File details and metadata

### Test 3: Analysis with Metadata

1. Click "Analyze Image" button
2. **Expected**:
   - Loading spinner appears
   - Button shows "Analyzing..."
   - Console logs show:
     - "🔬 Starting diagnostic analysis..."
     - "📋 Metadata being sent:"
     - Patient address, timestamp, image name, size
   - Backend processes the file
   - Results appear after analysis

### Test 4: Results Display

After analysis completes, verify:

1. **Status and Severity Badges**
   - Status badge (Normal/Abnormal/Unreadable)
   - Severity badge (NORMAL/MEDIUM/HIGH)
   - Color coding is correct

2. **Findings Section**
   - "Necessary Findings" (green, definitive)
   - "Possible Findings" (yellow, uncertain)
   - Both show as lists

3. **Confidence Score**
   - Progress bar showing percentage
   - Number displayed (0-100%)

4. **Recommendations**
   - Text recommendation displayed
   - Styled in light blue box

5. **Critical Alert** (if applicable)
   - Red alert banner appears
   - Warning message shown

6. **AI Model Info**
   - Model name displayed at bottom
   - Shows which model was used

7. **ZK Proof Section** (if available)
   - "Zero-Knowledge Proof" card appears
   - Image commitment hash shown
   - TEE attestation badge
   - "Verify Proof" button

### Test 5: Metadata Verification

Check console logs for:

1. **Sent Metadata**:
   ```
   📤 Sending to backend: {
     patient_address: "0x...",
     timestamp: "2024-...",
     image_name: "test.dcm",
     image_size: 12345,
     image_type: "application/dicom"
   }
   ```

2. **Received Metadata**:
   ```
   📥 Received from backend: {
     status: "...",
     metadata: {...},
     ...
   }
   ```

3. **Metadata Sync Check**:
   - Should see "✅ Metadata in sync" if all matches
   - Or "❌ Metadata mismatches found" if issues

### Test 6: Save Report

1. After analysis completes, click "Save Report"
2. **Expected**:
   - Success toast notification
   - Report saved to localStorage
   - Appears in "Recent Analyses" tab
   - Console logs: "💾 Analysis saved to localStorage"

### Test 7: Export Report

1. Click "Export" button
2. **Expected**:
   - JSON file downloads
   - Filename: `diagnostic-report-[timestamp].json`
   - Contains full analysis data and metadata
   - Success toast notification

### Test 8: Clear/Reset

1. Click "Clear" button
2. **Expected**:
   - File selection cleared
   - Image preview removed
   - Analysis results cleared
   - Ready for new upload

### Test 9: ZK Proof Verification

1. If ZK proof is available, click "Verify Proof"
2. **Expected**:
   - Loading state shows "Verifying..."
   - Backend verifies the proof
   - Success/error toast appears
   - "Verified" badge appears if successful
   - Console logs verification result

### Test 10: Integration with Recent Analyses

1. Save a diagnostic report
2. Switch to "Recent Analyses" tab
3. **Expected**:
   - Saved report appears in the list
   - Shows correct metadata:
     - Patient address (truncated)
     - Upload timestamp
     - File name
     - Model used
     - Analysis duration
   - Metadata section visible in card
   - All data matches what was saved

## Automated Testing

Run the Python test script:

```bash
python3 test_diagnostic_tool.py
```

This will test:
- Backend health
- Analyze endpoint with metadata
- Debug endpoint
- Analyses endpoint

## Common Issues and Solutions

### Issue: "Cannot connect to server"
- **Solution**: Ensure backend is running on port 8000
- Check `VITE_BACKEND_URL` in `.env` file

### Issue: Metadata not showing
- **Solution**: Check browser console for errors
- Verify backend is receiving metadata
- Check `/debug/last-analysis` endpoint

### Issue: Analysis fails
- **Solution**: Check backend logs
- Verify file format is supported
- Check if Atoma is configured or DEMO_MODE is enabled

### Issue: Results don't display
- **Solution**: Check browser console for errors
- Verify response structure matches expected format
- Check network tab for API response

## Verification Checklist

- [ ] Diagnostic Tool tab accessible
- [ ] File upload works (drag-and-drop and click)
- [ ] Image preview shows
- [ ] Analysis completes successfully
- [ ] Results display correctly
- [ ] Metadata is sent and received
- [ ] Metadata matches between send/receive
- [ ] Save Report works
- [ ] Export Report works
- [ ] Clear/Reset works
- [ ] ZK Proof verification works (if available)
- [ ] Saved reports appear in Recent Analyses
- [ ] Metadata displays correctly in Recent Analyses
- [ ] Console logs show all steps
- [ ] No errors in console

## Debug Endpoints

### Check Last Analysis
```bash
curl http://localhost:8000/debug/last-analysis
```

### Check All Analyses
```bash
curl http://localhost:8000/analyses
```

### Health Check
```bash
curl http://localhost:8000/health
```

## Expected Console Output

When testing, you should see logs like:

```
🔬 Starting diagnostic analysis...
📋 Metadata being sent: {patient_address: "...", timestamp: "...", ...}
📤 Sending to backend: {...}
✅ Diagnostic analysis complete - Full response: {...}
📥 Received from backend: {status: "...", metadata: {...}, ...}
✅ Metadata in sync
💾 Analysis saved to localStorage with metadata: {...}
```

## Success Criteria

The diagnostic tool is working correctly if:

1. ✅ All UI elements render correctly
2. ✅ File upload works
3. ✅ Analysis completes and shows results
4. ✅ Metadata is sent and received correctly
5. ✅ No metadata mismatches in console
6. ✅ Save/Export/Clear functions work
7. ✅ Saved reports appear in Recent Analyses
8. ✅ No console errors
9. ✅ All logging appears as expected

