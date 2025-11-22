#!/usr/bin/env python3
"""
DrSui API Test Suite
Simple tests for all DrSui API endpoints.
"""

import requests
import json
import os
from PIL import Image
import pydicom
from pydicom.dataset import Dataset, FileDataset
import numpy as np

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

BASE_URL = "http://localhost:8000"


def print_json(data):
    """Pretty print JSON data."""
    print(json.dumps(data, indent=2, ensure_ascii=False))


def test_health():
    """Test the health check endpoint (GET /)."""
    print(f"\n{YELLOW}Testing: GET /{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:")
            print_json(data)
            
            if "status" in data or "message" in data:
                print(f"{GREEN}✅ PASS{RESET}")
                return True
            else:
                print(f"{RED}❌ FAIL - Response missing 'status' or 'message'{RESET}")
                return False
        else:
            print(f"{RED}❌ FAIL - Expected status 200, got {response.status_code}{RESET}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"{RED}❌ Server not running! Start it with: uvicorn main:app --reload{RESET}")
        return False
    except Exception as e:
        print(f"{RED}❌ FAIL - Error: {str(e)}{RESET}")
        return False


def test_mock_analyze():
    """Test the mock analyze endpoint (GET /test-analyze)."""
    print(f"\n{YELLOW}Testing: GET /test-analyze{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/test-analyze", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Full JSON Response:")
            print_json(data)
            
            # Check for required fields
            has_report = "report" in data
            has_hash = "hash" in data
            has_model = "model" in data or "ai_model" in data
            
            if has_report and has_hash and has_model:
                print(f"{GREEN}✅ PASS{RESET}")
                return True
            else:
                missing = []
                if not has_report:
                    missing.append("report")
                if not has_hash:
                    missing.append("hash")
                if not has_model:
                    missing.append("model/ai_model")
                print(f"{RED}❌ FAIL - Missing fields: {', '.join(missing)}{RESET}")
                return False
        elif response.status_code == 404:
            print(f"{YELLOW}⚠️  SKIP - Endpoint /test-analyze not found (may not be implemented){RESET}")
            return None  # Skip this test
        else:
            print(f"{RED}❌ FAIL - Expected status 200, got {response.status_code}{RESET}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"{RED}❌ Server not running! Start it with: uvicorn main:app --reload{RESET}")
        return False
    except Exception as e:
        print(f"{RED}❌ FAIL - Error: {str(e)}{RESET}")
        return False


def test_analyze_with_image():
    """Test the analyze endpoint with an image (POST /analyze)."""
    print(f"\n{YELLOW}Testing: POST /analyze{RESET}")
    
    # Create a simple 100x100 gray DICOM image
    test_image_path = "test_image.dcm"
    print(f"Creating test DICOM image: {test_image_path}")
    
    try:
        # Create a simple DICOM file with a gray image
        # Create a 100x100 array of gray pixels (value 128)
        pixel_array = np.full((100, 100), 128, dtype=np.uint16)
        
        # Create file meta information
        file_meta = Dataset()
        file_meta.MediaStorageSOPClassUID = '1.2.840.10008.5.1.4.1.1.1'  # CR Image Storage
        file_meta.MediaStorageSOPInstanceUID = "1.2.3.4.5.1.1"
        file_meta.ImplementationClassUID = "1.2.3.4.5.6"
        file_meta.TransferSyntaxUID = '1.2.840.10008.1.2'  # Implicit VR Little Endian
        
        # Create DICOM dataset
        ds = FileDataset(test_image_path, {}, file_meta=file_meta, preamble=b"\x00" * 128)
        ds.PatientName = "Test^Patient"
        ds.PatientID = "TEST001"
        ds.StudyInstanceUID = "1.2.3.4.5"
        ds.SeriesInstanceUID = "1.2.3.4.5.1"
        ds.SOPInstanceUID = "1.2.3.4.5.1.1"
        ds.SOPClassUID = '1.2.840.10008.5.1.4.1.1.1'  # CR Image Storage
        ds.Modality = "CR"  # Computed Radiography
        ds.Rows = 100
        ds.Columns = 100
        ds.BitsAllocated = 16
        ds.BitsStored = 16
        ds.HighBit = 15
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.PixelRepresentation = 0
        ds.PixelData = pixel_array.tobytes()
        
        # Save DICOM file
        ds.save_as(test_image_path, write_like_original=False)
        print(f"{GREEN}✅ Test DICOM image created{RESET}")
    except Exception as e:
        print(f"{RED}❌ FAIL - Could not create test DICOM image: {str(e)}{RESET}")
        return False
    
    try:
        # Upload the DICOM image
        print(f"Uploading DICOM image to {BASE_URL}/analyze...")
        with open(test_image_path, 'rb') as f:
            files = {'file': (test_image_path, f, 'application/dicom')}
            response = requests.post(f"{BASE_URL}/analyze", files=files, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:")
            print_json(data)
            
            # Check if response contains analysis data
            has_analysis = (
                "status" in data or 
                "findings" in data or 
                "report" in data or
                "modality" in data
            )
            
            if has_analysis:
                print(f"{GREEN}✅ PASS{RESET}")
                return True
            else:
                print(f"{RED}❌ FAIL - Response missing analysis data{RESET}")
                return False
        else:
            print(f"{RED}❌ FAIL - Expected status 200, got {response.status_code}{RESET}")
            print(f"Response: {response.text[:200]}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"{RED}❌ Server not running! Start it with: uvicorn main:app --reload{RESET}")
        return False
    except Exception as e:
        print(f"{RED}❌ FAIL - Error: {str(e)}{RESET}")
        return False
    finally:
        # Clean up test image
        if os.path.exists(test_image_path):
            os.remove(test_image_path)
            print(f"Cleaned up: {test_image_path}")


def test_docs():
    """Test the API documentation endpoint (GET /docs)."""
    print(f"\n{YELLOW}Testing: GET /docs{RESET}")
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"{GREEN}✅ PASS{RESET}")
            print(f"View docs at: {BASE_URL}/docs")
            return True
        else:
            print(f"{RED}❌ FAIL - Expected status 200, got {response.status_code}{RESET}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"{RED}❌ Server not running! Start it with: uvicorn main:app --reload{RESET}")
        return False
    except Exception as e:
        print(f"{RED}❌ FAIL - Error: {str(e)}{RESET}")
        return False


def main():
    """Main test runner."""
    print("🧪 DrSui API Test Suite")
    print("=" * 60)
    
    results = []
    skipped = 0
    
    # Run all tests
    try:
        result = test_health()
        if result is not None:
            results.append(result)
        else:
            skipped += 1
    except Exception as e:
        print(f"{RED}❌ Unexpected error in test_health: {str(e)}{RESET}")
        results.append(False)
    
    try:
        result = test_mock_analyze()
        if result is not None:
            results.append(result)
        else:
            skipped += 1
    except Exception as e:
        print(f"{RED}❌ Unexpected error in test_mock_analyze: {str(e)}{RESET}")
        results.append(False)
    
    try:
        result = test_analyze_with_image()
        if result is not None:
            results.append(result)
        else:
            skipped += 1
    except Exception as e:
        print(f"{RED}❌ Unexpected error in test_analyze_with_image: {str(e)}{RESET}")
        results.append(False)
    
    try:
        result = test_docs()
        if result is not None:
            results.append(result)
        else:
            skipped += 1
    except Exception as e:
        print(f"{RED}❌ Unexpected error in test_docs: {str(e)}{RESET}")
        results.append(False)
    
    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"{GREEN}✅ {passed}/{total} tests passed{RESET}")
    
    if skipped > 0:
        print(f"{YELLOW}⚠️  {skipped} tests skipped{RESET}")
    
    if passed == total:
        print(f"\n{GREEN}🎉 All tests passed!{RESET}")
        return 0
    else:
        print(f"\n{RED}Some tests failed. Check the output above for details.{RESET}")
        return 1


if __name__ == "__main__":
    exit(main())
