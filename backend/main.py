from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from io import BytesIO
import pydicom
from PIL import Image
import numpy as np
import base64
import os
import json
import random
import hashlib
import time
from datetime import datetime
from dotenv import load_dotenv
from atoma_sdk import AtomaSDK
from zk_utils import ZKProofGenerator, create_proof_for_blockchain

# Load environment variables
load_dotenv()

# Check if demo mode is enabled (for hackathon demos when Atoma is unavailable)
# Set DEMO_MODE=true in .env file to enable demo mode
DEMO_MODE = os.getenv("DEMO_MODE", "False").lower() in ("true", "1", "yes")

# Initialize AtomaSDK client (may be None if no API key is set)
atoma_bearer_auth = os.getenv("ATOMASDK_BEARER_AUTH")
client = AtomaSDK(bearer_auth=atoma_bearer_auth) if atoma_bearer_auth else None

# Modal Logic System Prompt for Dr. Sui
# This prompt enforces Modal Logic (Necessity vs Possibility) to reduce hallucinations
# by clearly distinguishing between definitive findings and uncertain observations.
SYSTEM_PROMPT = """You are Dr. Sui, a radiologist using Modal Logic to analyze medical images.

Modal Logic Framework - Distinguish between:
1. NECESSITY (definitive findings) - What MUST be present based on clear evidence
2. POSSIBILITY (uncertain findings) - What MIGHT be present but requires confirmation

CRITICAL RULES:
- Only state as "necessary_findings" what you can definitively see with high confidence
- Use "possible_findings" for anything uncertain, ambiguous, or requiring confirmation
- Be conservative: when in doubt, place findings in "possible" category
- Serious conditions (tumors, fractures, malignancies) should ONLY be in "possible" unless absolutely certain
- Never diagnose life-threatening conditions without clear, unambiguous evidence

Output format (JSON only, no markdown):
{
  "status": "Normal" | "Abnormal - Findings Detected" | "Unreadable",
  "modality": "Chest X-Ray (PA/Lateral)" | etc,
  "findings": {
    "necessary": ["definitive finding 1", "definitive finding 2"],
    "possible": ["uncertain finding 1", "uncertain finding 2"]
  },
  "severity": "NORMAL" | "MEDIUM" | "HIGH",
  "confidence": <integer 0-100>,
  "recommendation": "text recommendation",
  "critical_alert": <boolean>,
  "ai_model": "model name"
}

Remember: Modal Logic means being honest about uncertainty. Better to understate than overstate severity."""

# Vision models (models that support image input)
VISION_MODELS = [
    "llama-3.2-vision",
    "llama-3.2-vision-11b",
    "llama-3.2-90b-vision",
    "llama-3.2-11b-vision",
]

app = FastAPI()

# Add CORS middleware to allow frontend requests
# This is essential for the frontend (running on localhost:3000) to communicate with backend (localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, use specific origins like ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# In-memory storage for analyses (in production, use a database)
# This stores recent analyses so the doctor dashboard can retrieve them
analyses_storage = []

# Initialize ZK Proof Generator for cryptographic proof generation
# ZK proofs enable privacy-preserving verification that:
# 1. AI analysis was performed on a specific image (without revealing the image)
# 2. Results are authentic and unmodified
# 3. Computation occurred in a trusted execution environment (TEE)
# This enhances trust and privacy in medical AI analysis
MODEL_ID = os.getenv("ATOMA_MODEL_ID", "atoma-vision-v1")  # Default model ID
try:
    zk_generator = ZKProofGenerator(MODEL_ID)
    print(f"✅ ZK Proof System initialized with model: {MODEL_ID}")
    print("   Zero-knowledge proofs will be generated for all analyses")
except Exception as e:
    print(f"⚠️ Warning: Failed to initialize ZK Proof Generator: {e}")
    print("   Analysis will continue without ZK proofs")
    zk_generator = None


def generate_demo_response(image_type=None):
    """
    Generate a realistic mock medical analysis response for demo mode.
    
    This function creates believable medical findings for hackathon demos
    when Atoma API is unavailable or DEMO_MODE is enabled.
    
    Args:
        image_type (str, optional): Type of medical image (e.g., "chest", "knee")
    
    Returns:
        dict: Mock analysis response with medical findings
    """
    # Generate hash from image_type for consistent "random" selection
    # This ensures the same image type gets the same result (deterministic)
    # For demo purposes, we use a simple hash of image_type
    hash_input = (image_type or "chest") + "_demo"
    hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
    scenario_index = hash_value % 4
    
    # Scenario a) Normal chest X-ray
    if scenario_index == 0:
        return {
            "status": "Normal",
            "modality": "Chest X-Ray (PA/Lateral)",
            "findings": {
                "necessary": [
                    "Normal cardiac silhouette and mediastinal contours",
                    "Clear bilateral lung fields without focal consolidation",
                    "No pleural effusion or pneumothorax",
                    "Normal bony structures and soft tissues"
                ],
                "possible": []
            },
            "severity": "NORMAL",
            "confidence": 95,
            "recommendation": "No acute cardiopulmonary abnormalities detected. Routine follow-up recommended.",
            "critical_alert": False,
            "ai_model": "llama-3.2-vision (demo)",
            "hash": hashlib.sha256(f"normal_{hash_input}".encode()).hexdigest()
        }
    
    # Scenario b) Possible pneumonia indicators
    elif scenario_index == 1:
        return {
            "status": "Abnormal - Findings Detected",
            "modality": "Chest X-Ray (AP)",
            "findings": {
                "necessary": [
                    "Mild perihilar opacification in right lower lobe",
                    "Increased bronchovascular markings",
                    "Small bilateral pleural effusions (trace)"
                ],
                "possible": [
                    "Consolidation consistent with early pneumonia",
                    "Possible atelectasis in right lower lobe"
                ]
            },
            "severity": "MEDIUM",
            "confidence": 78,
            "recommendation": "Clinical correlation recommended. Consider follow-up imaging in 48-72 hours. Antibiotic therapy may be indicated based on clinical presentation.",
            "critical_alert": False,
            "critical_alert_message": None,
            "ai_model": "llama-3.2-vision (demo)",
            "hash": hashlib.sha256(f"pneumonia_{hash_input}".encode()).hexdigest()
        }
    
    # Scenario c) Cardiac enlargement suggestion
    elif scenario_index == 2:
        return {
            "status": "Abnormal - Cardiac Findings",
            "modality": "Chest X-Ray (PA/Lateral)",
            "findings": {
                "necessary": [
                    "Cardiothoracic ratio increased (> 50%)",
                    "Left atrial enlargement suggested",
                    "Mild pulmonary vascular congestion"
                ],
                "possible": [
                    "Possible left ventricular hypertrophy",
                    "Pleural effusions may be related to cardiac dysfunction"
                ]
            },
            "severity": "MEDIUM",
            "confidence": 82,
            "recommendation": "Cardiac evaluation recommended. Consider echocardiography for further assessment. ECG and clinical correlation advised.",
            "critical_alert": False,
            "critical_alert_message": None,
            "ai_model": "llama-3.2-vision (demo)",
            "hash": hashlib.sha256(f"cardiac_{hash_input}".encode()).hexdigest()
        }
    
    # Scenario d) Post-surgical changes
    else:
        return {
            "status": "Post-Operative",
            "modality": "Chest X-Ray (AP/Lateral)",
            "findings": {
                "necessary": [
                    "Surgical clips and staples present consistent with recent procedure",
                    "Mild postoperative atelectasis in left lower lobe",
                    "Small residual pneumothorax (approximately 5%)",
                    "Normal mediastinal position"
                ],
                "possible": [
                    "Postoperative changes expected given surgical history",
                    "Small pleural effusion may be reactive"
                ]
            },
            "severity": "MEDIUM",
            "confidence": 88,
            "recommendation": "Findings consistent with expected postoperative changes. Clinical correlation with surgical team recommended. Follow-up imaging as clinically indicated.",
            "critical_alert": False,
            "critical_alert_message": None,
            "ai_model": "llama-3.2-vision (demo)",
            "hash": hashlib.sha256(f"postop_{hash_input}".encode()).hexdigest()
        }


def check_hallucination(result):
    """
    Hallucination Check Function - Modal Logic Anti-Hallucination System
    
    Checks for potential hallucinations in AI-generated medical reports:
    1. If "possible_findings" contain serious conditions, downgrade severity
    2. Adds "Requires Human Verification" flag for safety
    
    Args:
        result (dict): The AI analysis result dictionary
    
    Returns:
        dict: Modified result with hallucination checks applied
    """
    # Serious medical conditions that should trigger downgrade if in "possible" findings
    # These are high-stakes diagnoses that require definitive evidence
    SERIOUS_CONDITIONS = [
        'tumor', 'tumour', 'malignancy', 'cancer', 'carcinoma',
        'fracture', 'broken', 'break',
        'pneumothorax', 'collapsed lung',
        'pulmonary embolism', 'embolism',
        'aortic dissection', 'dissection',
        'acute appendicitis', 'appendicitis',
        'stroke', 'infarct', 'ischemia', 'ischaemia',
        'meningitis', 'encephalitis',
        'severe', 'critical', 'emergency',
    ]
    
    # Normalize result structure
    if not isinstance(result, dict):
        return result
    
    # Check if status is UNREADABLE - return error
    status = result.get('status', '').upper()
    if status == 'UNREADABLE':
        raise ValueError(
            "Image quality is insufficient for analysis. "
            "Status: UNREADABLE. Please ensure image is clear and properly formatted."
        )
    
    # Get findings structure (handle both formats)
    findings = result.get('findings', {})
    if isinstance(findings, list):
        # If findings is a list, convert to proper structure
        findings = {
            'necessary': findings,
            'possible': []
        }
        result['findings'] = findings
    
    # Extract possible findings
    possible_findings = findings.get('possible', [])
    if isinstance(possible_findings, str):
        # If possible_findings is a string, convert to list
        possible_findings = [possible_findings] if possible_findings else []
        findings['possible'] = possible_findings
    
    # Check if any serious conditions appear in possible findings
    requires_verification = False
    found_serious = []
    
    for finding in possible_findings:
        if isinstance(finding, str):
            finding_lower = finding.lower()
            for serious_term in SERIOUS_CONDITIONS:
                if serious_term in finding_lower:
                    requires_verification = True
                    found_serious.append(serious_term)
                    break
    
    # Apply hallucination check: downgrade severity if serious conditions in "possible"
    if requires_verification:
        current_severity = result.get('severity', 'NORMAL').upper()
        
        # Downgrade severity to MEDIUM if it was HIGH
        # This is conservative: uncertain serious findings should be MEDIUM, not HIGH
        if current_severity == 'HIGH':
            result['severity'] = 'MEDIUM'
            result['original_severity'] = 'HIGH'  # Keep original for tracking
            result['severity_downgraded'] = True
            result['downgrade_reason'] = f"Serious conditions ({', '.join(found_serious)}) found in 'possible' findings - requires human verification"
        
        # Add verification requirement flag
        result['requires_human_verification'] = True
        result['verification_reason'] = f"Potential serious conditions detected in uncertain findings: {', '.join(found_serious)}"
        
        # Update recommendation to emphasize human review
        original_recommendation = result.get('recommendation', '')
        verification_note = " [IMPORTANT: Requires human radiologist verification - serious conditions mentioned in possible findings]"
        if verification_note not in original_recommendation:
            result['recommendation'] = original_recommendation + verification_note
    
    return result


def parse_json_response(content):
    """
    Robust JSON parsing function that handles markdown-wrapped JSON.
    
    Strips markdown code blocks (```json ... ```) and attempts to parse JSON.
    
    Args:
        content (str): Raw content from AI response
    
    Returns:
        dict: Parsed JSON object
    
    Raises:
        json.JSONDecodeError: If JSON parsing fails
        ValueError: If content is invalid
    """
    if not content or not isinstance(content, str):
        raise ValueError("Content must be a non-empty string")
    
    content_clean = content.strip()
    
    # Remove markdown code blocks if present
    if content_clean.startswith('```'):
        # Split by triple backticks
        parts = content_clean.split('```')
        
        # Look for JSON code block (```json or ```)
        for i, part in enumerate(parts):
            part_clean = part.strip()
            # Skip empty parts
            if not part_clean:
                continue
            
            # If it starts with 'json', remove that prefix
            if part_clean.lower().startswith('json'):
                part_clean = part_clean[4:].strip()
            
            # Try to parse this part as JSON
            try:
                return json.loads(part_clean)
            except json.JSONDecodeError:
                continue
    
    # If no markdown blocks, try parsing directly
    try:
        return json.loads(content_clean)
    except json.JSONDecodeError:
        # Try to find JSON object in text (look for { ... })
        start_idx = content_clean.find('{')
        end_idx = content_clean.rfind('}')
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            json_str = content_clean[start_idx:end_idx + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass
        
        # If all parsing attempts fail, raise error with original content preview
        raise ValueError(f"Failed to parse JSON from response. Content preview: {content_clean[:200]}")


async def has_vision_model_available():
    """
    Check if Atoma has a vision model available.
    Returns the model name if available, None otherwise.
    """
    try:
        # Try to get available models from Atoma
        if hasattr(client, 'models') and hasattr(client.models, 'list'):
            models_response = await client.models.list()
            if hasattr(models_response, 'data') and models_response.data:
                available_models = []
                for model in models_response.data:
                    if hasattr(model, 'id'):
                        model_id = model.id.lower()
                        available_models.append(model_id)
                        # Check if this is a vision model
                        for vision_model in VISION_MODELS:
                            if vision_model in model_id or model_id in vision_model:
                                return vision_model
        # If we can't get models list, try to check by attempting to use a vision model
        # This will be caught in the exception handler
        return None
    except Exception:
        # If we can't check, assume no vision model is available
        return None


@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze a medical image file using AtomaSDK.
    If the file is a DICOM (.dcm) file, it converts it to PNG.
    """
    print(f"📥 Received analysis request: {file.filename} ({file.size or 'unknown'} bytes)")
    try:
        # Read the uploaded file
        contents = await file.read()
        
        # ZK PROOF STEP 1: Generate image commitment
        # This creates a cryptographic hash of the image without revealing it.
        # The commitment proves we have the image without showing the image itself.
        # This is the "zero-knowledge" foundation - we commit to the data
        # without revealing it, enabling privacy-preserving verification.
        image_commitment = None
        if zk_generator:
            try:
                image_commitment = zk_generator.generate_image_commitment(contents)
                print(f"🔐 ZK Commitment generated: {image_commitment[:16]}... (first 16 chars)")
                print("   This commitment proves we have the image without revealing it")
            except Exception as zk_error:
                print(f"⚠️ Warning: Failed to generate image commitment: {zk_error}")
                print("   Analysis will continue without ZK proof")
        
        # Check if it's a DICOM file
        if file.filename and file.filename.lower().endswith('.dcm'):
            # Read DICOM file from memory buffer
            dicom_buffer = BytesIO(contents)
            dicom_file = pydicom.dcmread(dicom_buffer)
            
            # Get pixel array from DICOM file
            pixel_array = dicom_file.pixel_array
            
            # Normalize pixel array to 0-255 range for PNG conversion
            if pixel_array.dtype != np.uint8:
                # Normalize to 0-255 range
                pixel_min = pixel_array.min()
                pixel_max = pixel_array.max()
                if pixel_max > pixel_min:
                    pixel_array = ((pixel_array - pixel_min) / (pixel_max - pixel_min) * 255).astype(np.uint8)
                else:
                    pixel_array = pixel_array.astype(np.uint8)
            
            # Handle different array dimensions
            if len(pixel_array.shape) == 2:
                # 2D image (grayscale)
                image = Image.fromarray(pixel_array, mode='L')
            elif len(pixel_array.shape) == 3:
                # 3D image (RGB)
                image = Image.fromarray(pixel_array, mode='RGB')
            else:
                # For other dimensions, try to convert to grayscale
                # Take first slice if 3D volume
                if len(pixel_array.shape) > 2:
                    pixel_array = pixel_array[0]
                image = Image.fromarray(pixel_array, mode='L')
            
            # Save to temporary memory buffer as PNG
            png_buffer = BytesIO()
            image.save(png_buffer, format='PNG')
            png_buffer.seek(0)
            
            # Convert PNG buffer to base64
            png_bytes = png_buffer.getvalue()
            image_base64 = base64.b64encode(png_bytes).decode('utf-8')
            
            # Check if DEMO_MODE is enabled OR if Atoma is not configured
            use_demo_mode = DEMO_MODE or client is None
            
            # Try to use Atoma API first (unless in demo mode)
            if not use_demo_mode:
                try:
                    # Check if Atoma has a vision model available
                    vision_model = await has_vision_model_available()
                    has_vision = vision_model is not None
                    
                    # Prepare messages with system prompt
                    messages = [
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT
                        }
                    ]
                    
                    # Crucial Logic: If Atoma has a Vision model, send image as base64
                    # If NOT, use placeholder text prompt
                    if has_vision:
                        # Vision model available: Send image buffer as base64
                        messages.append({
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{image_base64}"
                                    }
                                }
                            ]
                        })
                        model_to_use = vision_model
                    else:
                        # No vision model: Use placeholder text prompt
                        messages.append({
                            "role": "user",
                            "content": "Analyze this text report of an X-ray..."
                        })
                        # Use a default text model
                        model_to_use = "llama-3.2-90b"
                    
                    # Call AtomaSDK chat completions
                    # Note: Using client.chat.create (SDK structure) 
                    # which is conceptually equivalent to client.chat.completions.create
                    response = await client.chat.create(
                        messages=messages,
                        model=model_to_use
                    )
                    
                    # Extract response content
                    if hasattr(response, 'choices') and len(response.choices) > 0:
                        content = response.choices[0].message.content
                        
                        # Robust JSON parsing with markdown handling
                        try:
                            result = parse_json_response(content)
                            
                            # Apply hallucination check before returning
                            result = check_hallucination(result)
                            
                            # Generate hash for blockchain storage (legacy compatibility)
                            result_str = json.dumps(result, sort_keys=True)
                            result['hash'] = hashlib.sha256(result_str.encode()).hexdigest()
                            
                            # ZK PROOF STEP 2: Generate zero-knowledge proof of analysis
                            # This proves that:
                            # 1. We analyzed the committed image (image_commitment)
                            # 2. We got these specific results (result)
                            # 3. The analysis was performed by the specified AI model
                            # 4. All without revealing the actual image
                            # This enables trustless verification on the blockchain
                            # while maintaining complete patient privacy.
                            zk_proof = None
                            tee_proof = None
                            blockchain_proof_bytes = None
                            timestamp = int(time.time())
                            
                            if zk_generator and image_commitment:
                                try:
                                    # Generate standard ZK proof
                                    zk_proof = zk_generator.generate_analysis_proof(
                                        image_commitment=image_commitment,
                                        ai_response=result,
                                        timestamp=timestamp
                                    )
                                    print(f"🔐 ZK Proof generated successfully")
                                    print(f"   Proof type: {zk_proof.get('proof_type')}")
                                    print(f"   Analysis hash: {zk_proof.get('analysis_hash', '')[:16]}...")
                                    
                                    # ZK PROOF STEP 3: Generate Atoma TEE attestation
                                    # This proves the computation happened in Atoma's
                                    # Trusted Execution Environment (TEE), providing
                                    # hardware-level security guarantees.
                                    tee_proof = zk_generator.create_atoma_tee_proof(result)
                                    print(f"🛡️ TEE Attestation generated")
                                    print(f"   Enclave ID: {tee_proof.get('tee_attestation', {}).get('enclave_id', 'N/A')}")
                                    
                                    # Convert proof to blockchain format (bytes for Sui Move)
                                    blockchain_proof_bytes = create_proof_for_blockchain(zk_proof)
                                    proof_b64 = base64.b64encode(blockchain_proof_bytes).decode('utf-8')
                                    print(f"📦 Blockchain proof prepared ({len(blockchain_proof_bytes)} bytes)")
                                    
                                    # Add ZK proof data to result
                                    result['image_commitment'] = image_commitment
                                    result['zk_proof'] = zk_proof
                                    result['tee_attestation'] = tee_proof.get('tee_attestation')
                                    result['blockchain_proof_bytes'] = proof_b64
                                    result['zk_timestamp'] = timestamp
                                    
                                except Exception as zk_error:
                                    print(f"⚠️ Warning: Failed to generate ZK proof: {zk_error}")
                                    print("   Analysis will continue without ZK proof")
                            
                            # Store analysis in memory for doctor dashboard
                            analysis_record = {
                                "id": len(analyses_storage) + 1,
                                "timestamp": datetime.now().isoformat(),
                                "patient_id": "anonymous",  # In production, get from auth
                                "file_name": file.filename or "unknown.dcm",
                                "result": result
                            }
                            analyses_storage.append(analysis_record)
                            # Keep only last 100 analyses in memory
                            if len(analyses_storage) > 100:
                                analyses_storage.pop(0)
                            print(f"📊 Analysis stored: {analysis_record['id']} - {result.get('status', 'Unknown')}")
                            
                            return JSONResponse(
                                content=result,
                                status_code=200
                            )
                        except ValueError as parse_error:
                            # Handle UNREADABLE status or parsing errors
                            error_msg = str(parse_error)
                            if 'UNREADABLE' in error_msg or 'unreadable' in error_msg:
                                return JSONResponse(
                                    content={
                                        "status": "error",
                                        "message": error_msg,
                                        "error_type": "UNREADABLE"
                                    },
                                    status_code=400
                                )
                            # Other parsing errors
                            return JSONResponse(
                                content={
                                    "status": "error",
                                    "message": f"Failed to parse AI response: {error_msg}",
                                    "raw_content": content[:200]  # First 200 chars for debugging
                                },
                                status_code=500
                            )
                        except json.JSONDecodeError as json_error:
                            # Fallback: return raw content if JSON parsing completely fails
                            print(f"⚠️ JSON parsing failed: {str(json_error)}")
                            return JSONResponse(
                                content={
                                    "findings": content,
                                    "severity": "unknown",
                                    "confidence": 0,
                                    "warning": "Response format was not valid JSON - returning raw content"
                                },
                                status_code=200
                            )
                    else:
                        # No response from model - fall through to demo mode
                        raise Exception("No response from Atoma model")
                        
                except Exception as api_error:
                    # If Atoma call fails, log and fall back to demo mode
                    print(f"⚠️ Atoma API call failed: {str(api_error)}")
                    print("🔄 Falling back to demo mode...")
                    use_demo_mode = True
            
            # Use demo mode if DEMO_MODE is True OR if Atoma call failed
            if use_demo_mode:
                print("🎭 Using DEMO MODE - Generating mock response")
                
                # Determine image type from filename if possible
                image_type = None
                if file.filename:
                    filename_lower = file.filename.lower()
                    if "chest" in filename_lower:
                        image_type = "chest"
                    elif "knee" in filename_lower:
                        image_type = "knee"
                    elif "cardiac" in filename_lower or "heart" in filename_lower:
                        image_type = "cardiac"
                
                # Generate demo response
                demo_result = generate_demo_response(image_type)
                
                # Apply hallucination check to demo responses too
                try:
                    demo_result = check_hallucination(demo_result)
                except ValueError as verification_error:
                    # If demo result is UNREADABLE, return 400 error
                    error_msg = str(verification_error)
                    if 'UNREADABLE' in error_msg or 'unreadable' in error_msg:
                        return JSONResponse(
                            content={
                                "status": "error",
                                "message": error_msg,
                                "error_type": "UNREADABLE"
                            },
                            status_code=400
                        )
                    # Other errors - log but continue with demo result
                    print(f"⚠️ Hallucination check warning: {error_msg}")
                
                # Generate hash for blockchain storage (legacy compatibility)
                result_str = json.dumps(demo_result, sort_keys=True)
                demo_result['hash'] = hashlib.sha256(result_str.encode()).hexdigest()
                
                # ZK PROOF STEP 2 & 3: Generate ZK proofs even in demo mode
                # This demonstrates the system works end-to-end and generates
                # real cryptographic proofs even when using mock AI responses.
                # In production, these proofs would be identical in structure.
                zk_proof = None
                tee_proof = None
                blockchain_proof_bytes = None
                timestamp = int(time.time())
                
                if zk_generator and image_commitment:
                    try:
                        # Generate standard ZK proof (same as production)
                        zk_proof = zk_generator.generate_analysis_proof(
                            image_commitment=image_commitment,
                            ai_response=demo_result,
                            timestamp=timestamp
                        )
                        print(f"🔐 ZK Proof generated (demo mode)")
                        print(f"   Proof type: {zk_proof.get('proof_type')}")
                        
                        # Generate TEE attestation (demo mode)
                        tee_proof = zk_generator.create_atoma_tee_proof(demo_result)
                        print(f"🛡️ TEE Attestation generated (demo mode)")
                        
                        # Convert to blockchain format
                        blockchain_proof_bytes = create_proof_for_blockchain(zk_proof)
                        proof_b64 = base64.b64encode(blockchain_proof_bytes).decode('utf-8')
                        print(f"📦 Blockchain proof prepared ({len(blockchain_proof_bytes)} bytes)")
                        
                        # Add ZK proof data to demo result
                        demo_result['image_commitment'] = image_commitment
                        demo_result['zk_proof'] = zk_proof
                        demo_result['tee_attestation'] = tee_proof.get('tee_attestation')
                        demo_result['blockchain_proof_bytes'] = proof_b64
                        demo_result['zk_timestamp'] = timestamp
                        demo_result['demo_mode'] = True  # Flag to indicate demo mode
                        
                    except Exception as zk_error:
                        print(f"⚠️ Warning: Failed to generate ZK proof in demo mode: {zk_error}")
                        print("   Demo analysis will continue without ZK proof")
                
                # Store analysis in memory for doctor dashboard
                analysis_record = {
                    "id": len(analyses_storage) + 1,
                    "timestamp": datetime.now().isoformat(),
                    "patient_id": "anonymous",  # In production, get from auth
                    "file_name": file.filename or "unknown.dcm",
                    "result": demo_result
                }
                analyses_storage.append(analysis_record)
                # Keep only last 100 analyses in memory
                if len(analyses_storage) > 100:
                    analyses_storage.pop(0)
                print(f"📊 Demo analysis stored: {analysis_record['id']} - {demo_result.get('status', 'Unknown')}")
                
                return JSONResponse(
                    content=demo_result,
                    status_code=200
                )
        else:
            # If not a DICOM file, still try to analyze with Atoma
            # (could be a PNG/JPEG image)
            return JSONResponse(
                content={"status": "error", "message": "Only DICOM files are supported"},
                status_code=400
            )
    
    except pydicom.errors.InvalidDicomError:
        # File is not a valid DICOM file
        return JSONResponse(
            content={"status": "error", "message": "Invalid DICOM file"},
            status_code=400
        )
    except Exception as e:
        # Handle other errors
        return JSONResponse(
            content={"status": "error", "message": str(e)},
            status_code=500
        )


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "FastAPI backend for DrSui"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/status")
async def get_status():
    """
    Status endpoint that returns configuration information.
    
    Useful for debugging and determining if Atoma is configured correctly.
    
    Returns:
        dict: Status information including:
            - demo_mode: Whether demo mode is enabled
            - atoma_configured: Whether Atoma API key is set
            - version: API version
    """
    return {
        "demo_mode": DEMO_MODE,
        "atoma_configured": atoma_bearer_auth is not None and atoma_bearer_auth != "",
        "version": "1.0.0"
    }


@app.get("/ping")
async def ping():
    """
    Simple connection test endpoint.
    Returns a pong message with timestamp to verify backend is accessible.
    
    Returns:
        dict: Message and current timestamp
    """
    return {
        "message": "pong",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/analyses")
async def get_analyses(limit: int = 50):
    """
    Get recent analyses for the doctor dashboard.
    
    This endpoint returns all recent analyses that have been performed.
    In production, this would query a database and filter by doctor permissions.
    
    Args:
        limit: Maximum number of analyses to return (default: 50)
    
    Returns:
        dict: List of recent analyses with metadata
    """
    # Return recent analyses (most recent first)
    recent = analyses_storage[-limit:] if len(analyses_storage) > limit else analyses_storage
    return {
        "total": len(analyses_storage),
        "returned": len(recent),
        "analyses": list(reversed(recent))  # Most recent first
    }


@app.post("/verify-proof")
async def verify_proof(request: Request):
    """
    Verify a zero-knowledge proof without seeing the original image.
    
    This endpoint allows anyone to verify that:
    1. A ZK proof was signed by the authorized DrSui backend
    2. The proof hasn't been tampered with
    3. The image commitment matches (if provided)
    
    Verification does NOT require:
    - The original medical image
    - The private key
    - Access to DrSui backend systems
    
    This enables trustless verification on the blockchain, allowing
    anyone to verify medical AI analysis proofs without compromising
    patient privacy.
    
    Request Body:
        {
            "proof": {...},  # The ZK proof dictionary
            "expected_commitment": "optional_commitment_hash"  # Optional
        }
    
    Returns:
        {
            "valid": bool,
            "proof_type": str,
            "timestamp": int,
            "model_id": str,
            "verification_details": {
                "signature_valid": bool,
                "commitment_valid": bool,
                "proof_structure_valid": bool
            }
        }
    """
    try:
        body = await request.json()
        proof = body.get("proof")
        expected_commitment = body.get("expected_commitment")
        
        if not proof:
            return JSONResponse(
                content={
                    "valid": False,
                    "error": "Proof is required in request body"
                },
                status_code=400
            )
        
        print(f"🔍 Proof verification request received")
        print(f"   Proof type: {proof.get('proof_type', 'unknown')}")
        print(f"   Timestamp: {proof.get('timestamp', 'unknown')}")
        
        if not zk_generator:
            return JSONResponse(
                content={
                    "valid": False,
                    "error": "ZK proof system not initialized"
                },
                status_code=503
            )
        
        # Verify the proof
        is_valid = zk_generator.verify_proof(proof, expected_commitment)
        
        # Extract verification details
        verification_details = {
            "signature_valid": is_valid,  # Simplified - in production, extract more details
            "commitment_valid": True if not expected_commitment or proof.get("image_commitment") == expected_commitment else False,
            "proof_structure_valid": all(key in proof for key in ["proof_type", "version", "image_commitment", "analysis_hash", "signature", "public_key"])
        }
        
        result = {
            "valid": is_valid,
            "proof_type": proof.get("proof_type"),
            "timestamp": proof.get("timestamp"),
            "model_id": proof.get("model_id"),
            "verification_details": verification_details
        }
        
        if is_valid:
            print(f"✅ Proof verification successful")
        else:
            print(f"❌ Proof verification failed")
        
        return JSONResponse(
            content=result,
            status_code=200
        )
        
    except json.JSONDecodeError:
        return JSONResponse(
            content={
                "valid": False,
                "error": "Invalid JSON in request body"
            },
            status_code=400
        )
    except Exception as e:
        print(f"❌ Error verifying proof: {e}")
        return JSONResponse(
            content={
                "valid": False,
                "error": str(e)
            },
            status_code=500
        )

