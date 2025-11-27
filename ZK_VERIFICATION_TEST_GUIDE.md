# ZK Proof Verification Testing Guide

## Overview
This guide helps you test and verify that Zero-Knowledge Proof verification works correctly in Dr. Sui.

## Quick Test

### Automated Test Script
```bash
cd backend
source venv/bin/activate
python3 ../test_zk_verification.py
```

This will test:
1. Local ZK proof generation and verification
2. Backend verification endpoint
3. Invalid proof rejection

## Manual Testing Steps

### Test 1: Generate and Verify Proof (Backend)

1. **Start Backend**:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload --port 8000
   ```

2. **Upload an Image** (via frontend or test script):
   - Upload a DICOM or image file
   - Wait for analysis to complete
   - Check that `zk_proof` is in the response

3. **Verify the Proof**:
   - Click "Verify Proof" button in frontend
   - OR use curl:
   ```bash
   curl -X POST http://localhost:8000/verify-proof \
     -H "Content-Type: application/json" \
     -d '{
       "proof": {...proof object...},
       "expected_commitment": "...commitment hash..."
     }'
   ```

### Test 2: Frontend Verification (UploadView)

1. **Navigate to Upload Page**
2. **Upload an Image**
3. **Wait for Analysis** - Should see ZK proof section
4. **Click "Verify Proof" Button**
5. **Expected Results**:
   - ✅ Success toast: "Proof verified! ZK proof is cryptographically valid"
   - ✅ Console shows: "✅ Proof verification successful!"
   - ✅ Verification details logged
   - ✅ "Verified" badge appears (if available)

### Test 3: Frontend Verification (Diagnostic Tool)

1. **Navigate to Doctor Portal → Diagnostic Tool**
2. **Upload an Image**
3. **Click "Analyze Image"**
4. **Wait for Results**
5. **Click "Verify Proof" Button** (in ZK Proof section)
6. **Expected Results**:
   - ✅ Success toast appears
   - ✅ Console logs verification details
   - ✅ "Verified" badge shows
   - ✅ No errors in console

### Test 4: Invalid Proof Rejection

Test that tampered proofs are correctly rejected:

1. **Generate a Valid Proof** (via upload)
2. **Tamper with the Proof**:
   - Modify `analysis_hash` in the proof
   - Or modify `signature`
3. **Try to Verify**:
   - Should see ❌ "Proof verification failed"
   - Console shows which check failed

## Expected Console Output

### Successful Verification:
```
🔍 Verifying ZK proof...
📋 Proof data: {
  proof_type: "zk_medical_analysis",
  has_signature: true,
  has_public_key: true,
  image_commitment: "a3f5b2c8..."
}
📤 Sending verification request: {
  has_proof: true,
  has_commitment: true
}
📥 Verification response status: 200
✅ Verification response received: {
  valid: true,
  is_valid: true,
  verification_details: {
    signature_valid: true,
    commitment_valid: true,
    proof_structure_valid: true
  }
}
📊 Verification details: {
  signature_valid: true,
  commitment_valid: true,
  proof_structure_valid: true
}
✅ Proof verification successful!
```

### Failed Verification:
```
🔍 Verifying ZK proof...
📤 Sending verification request: {...}
📥 Verification response status: 200
✅ Verification response received: {
  valid: false,
  is_valid: false,
  verification_details: {
    signature_valid: false,
    commitment_valid: true,
    proof_structure_valid: true
  }
}
❌ Proof verification failed
```

## Backend Logs

When verification happens, backend should log:

```
🔍 Proof verification request received
   Proof type: zk_medical_analysis
   Timestamp: 1234567890
   Proof structure valid: all required fields present
   Verifying signature and commitment...
   Commitment match: true
✅ Proof verification successful
   Signature: Valid
   Commitment: Valid
   Structure: Valid
```

## Common Issues

### Issue: "No ZK proof available to verify"
- **Cause**: Analysis didn't generate a proof
- **Solution**: 
  - Check if `zk_generator` is initialized in backend
  - Check backend logs for ZK proof generation
  - Ensure image was successfully analyzed

### Issue: "Proof verification failed" (signature invalid)
- **Cause**: Proof was tampered with or wrong keypair
- **Solution**:
  - Verify proof wasn't modified
  - Check that same `zk_generator` instance is used for generation and verification
  - Check backend logs for specific error

### Issue: "Commitment mismatch"
- **Cause**: Wrong image commitment provided
- **Solution**:
  - Ensure `expected_commitment` matches `proof.image_commitment`
  - Check that image_commitment wasn't modified

### Issue: "Proof missing required fields"
- **Cause**: Incomplete proof structure
- **Solution**:
  - Check that all required fields are present:
    - proof_type, version, image_commitment, analysis_hash
    - signature, public_key, model_id, timestamp, nonce
  - Verify proof wasn't corrupted during transmission

## Verification Checklist

- [ ] ZK proof is generated during analysis
- [ ] Proof contains all required fields
- [ ] Frontend can send proof to backend
- [ ] Backend verifies signature correctly
- [ ] Backend verifies commitment (if provided)
- [ ] Valid proofs return `valid: true`
- [ ] Invalid/tampered proofs return `valid: false`
- [ ] Frontend displays verification result
- [ ] Console logs show verification details
- [ ] Error handling works for edge cases

## Testing Invalid Proofs

### Test Tampered Signature:
```python
proof["signature"] = "tampered_signature"
# Should fail with signature_valid: false
```

### Test Wrong Commitment:
```python
request_body = {
    "proof": valid_proof,
    "expected_commitment": "wrong_commitment"
}
# Should fail with commitment_valid: false
```

### Test Missing Fields:
```python
incomplete_proof = {proof_type: "zk_medical_analysis"}
# Should fail with proof_structure_valid: false
```

## Success Criteria

ZK Proof Verification is working if:

1. ✅ Valid proofs verify successfully
2. ✅ Invalid proofs are rejected
3. ✅ Tampered proofs are detected
4. ✅ Frontend displays correct results
5. ✅ Backend logs detailed information
6. ✅ Error messages are clear
7. ✅ No exceptions or crashes

## Debug Endpoints

### Check Last Analysis (includes proof):
```bash
curl http://localhost:8000/debug/last-analysis
```

### Verify Proof Directly:
```bash
curl -X POST http://localhost:8000/verify-proof \
  -H "Content-Type: application/json" \
  -d @proof.json
```

Where `proof.json` contains:
```json
{
  "proof": {
    "proof_type": "...",
    "signature": "...",
    "public_key": "...",
    ...
  },
  "expected_commitment": "..."
}
```

