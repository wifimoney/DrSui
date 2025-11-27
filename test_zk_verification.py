#!/usr/bin/env python3
"""
Test ZK Proof Verification End-to-End
Ensures the verification system works correctly
"""

import sys
import os
import json
import requests
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from zk_utils import ZKProofGenerator

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

def test_zk_proof_generation_and_verification():
    """Test that we can generate and verify a ZK proof"""
    print("=" * 60)
    print("TEST 1: ZK Proof Generation and Verification")
    print("=" * 60)
    
    try:
        # Initialize generator
        generator = ZKProofGenerator("test-model-v1")
        print("✅ ZK Proof Generator initialized")
        
        # Create test image data
        test_image = b"test medical image data" * 100
        print(f"📷 Test image size: {len(test_image)} bytes")
        
        # Generate image commitment
        commitment = generator.generate_image_commitment(test_image)
        print(f"🔐 Image commitment generated: {commitment[:32]}...")
        print(f"   Length: {len(commitment)} characters (expected 64)")
        
        # Create test AI response
        ai_response = {
            "status": "Normal",
            "findings": {
                "necessary": ["Clear lung fields"],
                "possible": ["Minor atelectasis"]
            },
            "severity": "NORMAL",
            "confidence": 95
        }
        
        # Generate proof
        print("\n🔬 Generating ZK proof...")
        proof = generator.generate_analysis_proof(
            image_commitment=commitment,
            ai_response=ai_response
        )
        
        print("✅ Proof generated successfully")
        print(f"   Proof type: {proof.get('proof_type')}")
        print(f"   Version: {proof.get('version')}")
        print(f"   Model ID: {proof.get('model_id')}")
        print(f"   Has signature: {bool(proof.get('signature'))}")
        print(f"   Has public key: {bool(proof.get('public_key'))}")
        
        # Verify proof with same generator
        print("\n🔍 Verifying proof with same generator...")
        is_valid = generator.verify_proof(proof, commitment)
        
        if is_valid:
            print("✅ Proof verification PASSED")
        else:
            print("❌ Proof verification FAILED")
            return False
        
        # Verify proof with commitment check
        print("\n🔍 Verifying proof with commitment check...")
        is_valid_with_commitment = generator.verify_proof(proof, commitment)
        
        if is_valid_with_commitment:
            print("✅ Proof verification with commitment PASSED")
        else:
            print("❌ Proof verification with commitment FAILED")
            return False
        
        # Test tamper detection
        print("\n🔍 Testing tamper detection...")
        tampered_proof = proof.copy()
        tampered_proof["analysis_hash"] = "tampered_hash_value"
        is_tampered_valid = generator.verify_proof(tampered_proof, commitment)
        
        if not is_tampered_valid:
            print("✅ Tamper detection working - tampered proof correctly rejected")
        else:
            print("❌ Tamper detection FAILED - tampered proof was accepted!")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_backend_verification_endpoint():
    """Test the backend /verify-proof endpoint"""
    print("\n" + "=" * 60)
    print("TEST 2: Backend Verification Endpoint")
    print("=" * 60)
    
    try:
        # First, check if backend is running
        health_response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ Backend is not running")
            return False
        
        print("✅ Backend is running")
        
        # Generate a test proof
        generator = ZKProofGenerator("test-model-v1")
        test_image = b"test image data" * 50
        commitment = generator.generate_image_commitment(test_image)
        
        ai_response = {
            "status": "Normal",
            "severity": "NORMAL",
            "confidence": 90
        }
        
        proof = generator.generate_analysis_proof(
            image_commitment=commitment,
            ai_response=ai_response
        )
        
        print("📤 Sending proof to backend for verification...")
        print(f"   Proof type: {proof.get('proof_type')}")
        print(f"   Timestamp: {proof.get('timestamp')}")
        
        # Send to backend
        response = requests.post(
            f"{BACKEND_URL}/verify-proof",
            json={
                "proof": proof,
                "expected_commitment": commitment
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"\n📥 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Verification endpoint responded")
            print(f"   Valid: {result.get('valid', result.get('is_valid', False))}")
            print(f"   Proof type: {result.get('proof_type')}")
            print(f"   Model ID: {result.get('model_id')}")
            
            if result.get('verification_details'):
                details = result['verification_details']
                print(f"   Signature valid: {details.get('signature_valid')}")
                print(f"   Commitment valid: {details.get('commitment_valid')}")
                print(f"   Structure valid: {details.get('proof_structure_valid')}")
            
            is_valid = result.get('valid', result.get('is_valid', False))
            if is_valid:
                print("\n✅ Backend verification PASSED")
                return True
            else:
                print("\n❌ Backend verification FAILED")
                return False
        else:
            print(f"❌ Backend returned error: {response.status_code}")
            try:
                error = response.json()
                print(f"   Error: {error}")
            except:
                print(f"   Response: {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend")
        print(f"   Is it running on {BACKEND_URL}?")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_invalid_proof_rejection():
    """Test that invalid proofs are correctly rejected"""
    print("\n" + "=" * 60)
    print("TEST 3: Invalid Proof Rejection")
    print("=" * 60)
    
    try:
        generator = ZKProofGenerator("test-model-v1")
        
        # Test 1: Missing signature
        print("\n🔍 Test 1: Proof with missing signature")
        invalid_proof_1 = {
            "proof_type": "zk_medical_analysis",
            "version": "1.0",
            "image_commitment": "test_commitment",
            "analysis_hash": "test_hash",
            "model_id": "test-model",
            "timestamp": 1234567890,
            "nonce": "test_nonce"
            # Missing signature and public_key
        }
        is_valid = generator.verify_proof(invalid_proof_1)
        if not is_valid:
            print("✅ Missing signature correctly rejected")
        else:
            print("❌ Missing signature was accepted!")
            return False
        
        # Test 2: Wrong commitment
        print("\n🔍 Test 2: Proof with wrong commitment")
        test_image = b"test data"
        commitment = generator.generate_image_commitment(test_image)
        proof = generator.generate_analysis_proof(
            image_commitment=commitment,
            ai_response={"status": "Normal"}
        )
        
        wrong_commitment = "wrong_commitment_value"
        is_valid = generator.verify_proof(proof, wrong_commitment)
        if not is_valid:
            print("✅ Wrong commitment correctly rejected")
        else:
            print("❌ Wrong commitment was accepted!")
            return False
        
        # Test 3: Tampered signature
        print("\n🔍 Test 3: Proof with tampered signature")
        tampered_proof = proof.copy()
        tampered_proof["signature"] = "tampered_signature_value"
        is_valid = generator.verify_proof(tampered_proof, commitment)
        if not is_valid:
            print("✅ Tampered signature correctly rejected")
        else:
            print("❌ Tampered signature was accepted!")
            return False
        
        print("\n✅ All invalid proof tests passed")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all verification tests"""
    print("\n" + "=" * 60)
    print("ZK PROOF VERIFICATION TEST SUITE")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    results = []
    
    # Test 1: Local generation and verification
    results.append(("Local ZK Proof Generation & Verification", test_zk_proof_generation_and_verification()))
    
    # Test 2: Backend endpoint
    results.append(("Backend Verification Endpoint", test_backend_verification_endpoint()))
    
    # Test 3: Invalid proof rejection
    results.append(("Invalid Proof Rejection", test_invalid_proof_rejection()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All ZK proof verification tests passed!")
        print("✅ ZK Proof Verification is WORKING correctly!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed.")
        print("❌ ZK Proof Verification needs fixes.")
        return 1

if __name__ == "__main__":
    exit(main())

