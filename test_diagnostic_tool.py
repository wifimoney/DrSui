#!/usr/bin/env python3
"""
Test script for Diagnostic Tool functionality
Tests the metadata flow from frontend to backend to display
"""

import requests
import json
import os
from pathlib import Path
from datetime import datetime

# Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
TEST_IMAGE_PATH = "test_image.png"  # You can create a dummy image for testing

def test_backend_health():
    """Test if backend is running"""
    print("=" * 60)
    print("TEST 1: Backend Health Check")
    print("=" * 60)
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is it running?")
        print(f"   Expected URL: {BACKEND_URL}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_analyze_endpoint_metadata():
    """Test /analyze endpoint with metadata"""
    print("\n" + "=" * 60)
    print("TEST 2: Analyze Endpoint with Metadata")
    print("=" * 60)
    
    # Create a dummy test image (1x1 PNG)
    test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
    
    # Prepare metadata
    test_metadata = {
        "patient_address": "0x1234567890123456789012345678901234567890123456789012345678901234",
        "timestamp": datetime.utcnow().isoformat(),
        "image_name": "test_chest_xray.dcm",
        "image_size": str(len(test_image_data))
    }
    
    print(f"📤 Sending test upload with metadata:")
    print(f"   Patient: {test_metadata['patient_address'][:20]}...")
    print(f"   Timestamp: {test_metadata['timestamp']}")
    print(f"   Image: {test_metadata['image_name']}")
    print(f"   Size: {test_metadata['image_size']} bytes")
    
    try:
        # Create form data
        files = {
            'file': ('test_chest_xray.dcm', test_image_data, 'application/dicom')
        }
        data = {
            'patient_address': test_metadata['patient_address'],
            'timestamp': test_metadata['timestamp'],
            'image_name': test_metadata['image_name'],
            'image_size': test_metadata['image_size']
        }
        
        response = requests.post(
            f"{BACKEND_URL}/analyze",
            files=files,
            data=data,
            timeout=30
        )
        
        print(f"\n📥 Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Analysis successful!")
            
            # Check metadata
            if 'metadata' in result:
                metadata = result['metadata']
                print("\n📋 Metadata received:")
                print(f"   Patient: {metadata.get('patient_address', 'MISSING')}")
                print(f"   Timestamp: {metadata.get('timestamp', 'MISSING')}")
                print(f"   Image: {metadata.get('image_name', 'MISSING')}")
                print(f"   Size: {metadata.get('image_size', 'MISSING')}")
                print(f"   Model: {metadata.get('model_used', 'MISSING')}")
                
                # Verify metadata matches
                mismatches = []
                if metadata.get('patient_address') != test_metadata['patient_address']:
                    mismatches.append('patient_address')
                if metadata.get('image_name') != test_metadata['image_name']:
                    mismatches.append('image_name')
                if metadata.get('image_size') != int(test_metadata['image_size']):
                    mismatches.append('image_size')
                
                if mismatches:
                    print(f"\n❌ Metadata mismatches: {mismatches}")
                    return False
                else:
                    print("\n✅ Metadata matches!")
            else:
                print("\n⚠️  No metadata in response")
            
            # Check analysis result
            if 'status' in result:
                print(f"\n📊 Analysis Result:")
                print(f"   Status: {result.get('status')}")
                print(f"   Severity: {result.get('severity', 'N/A')}")
                print(f"   Confidence: {result.get('confidence', 'N/A')}%")
            
            return True
        else:
            print(f"❌ Analysis failed with status {response.status_code}")
            try:
                error = response.json()
                print(f"   Error: {error}")
            except:
                print(f"   Response: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_debug_endpoint():
    """Test /debug/last-analysis endpoint"""
    print("\n" + "=" * 60)
    print("TEST 3: Debug Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/debug/last-analysis", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Debug endpoint working")
            print(f"\n📋 Last Analysis Cache:")
            print(f"   Request metadata: {data.get('request_metadata', {})}")
            print(f"   Response metadata: {data.get('response_metadata', {})}")
            return True
        elif response.status_code == 404:
            print("⚠️  No analysis cached yet (this is OK if no uploads have been made)")
            return True
        else:
            print(f"❌ Debug endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_analyses_endpoint():
    """Test /analyses endpoint"""
    print("\n" + "=" * 60)
    print("TEST 4: Analyses Endpoint")
    print("=" * 60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/analyses", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Analyses endpoint working")
            print(f"   Total analyses: {data.get('total', 0)}")
            print(f"   Returned: {data.get('returned', 0)}")
            
            if data.get('analyses'):
                first = data['analyses'][0]
                print(f"\n📋 Sample Analysis:")
                print(f"   ID: {first.get('id')}")
                print(f"   Patient: {first.get('patient_id', 'N/A')}")
                print(f"   File: {first.get('file_name', 'N/A')}")
                print(f"   Has metadata: {bool(first.get('metadata'))}")
                if first.get('metadata'):
                    print(f"   Metadata keys: {list(first['metadata'].keys())}")
            
            return True
        else:
            print(f"❌ Analyses endpoint returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("DIAGNOSTIC TOOL TEST SUITE")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = []
    
    # Test 1: Backend health
    results.append(("Backend Health", test_backend_health()))
    
    # Test 2: Analyze with metadata (only if backend is up)
    if results[0][1]:
        results.append(("Analyze Endpoint with Metadata", test_analyze_endpoint_metadata()))
        results.append(("Debug Endpoint", test_debug_endpoint()))
        results.append(("Analyses Endpoint", test_analyses_endpoint()))
    else:
        print("\n⚠️  Skipping remaining tests - backend is not available")
    
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
        print("\n🎉 All tests passed! Diagnostic tool is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please check the errors above.")
        return 1

if __name__ == "__main__":
    exit(main())

