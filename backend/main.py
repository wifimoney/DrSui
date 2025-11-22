from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from io import BytesIO
import pydicom
from PIL import Image
import numpy as np
import base64
import os
import json
from dotenv import load_dotenv
from atoma_sdk import AtomaSDK

# Load environment variables
load_dotenv()

# Initialize AtomaSDK client
client = AtomaSDK(
    bearer_auth=os.getenv("ATOMASDK_BEARER_AUTH")
)

# System prompt for Dr. Sui
SYSTEM_PROMPT = "You are Dr. Sui, a radiologist. Output JSON only: {findings: str, severity: str, confidence: int}"

# Vision models (models that support image input)
VISION_MODELS = [
    "llama-3.2-vision",
    "llama-3.2-vision-11b",
    "llama-3.2-90b-vision",
    "llama-3.2-11b-vision",
]

app = FastAPI()


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
    try:
        # Read the uploaded file
        contents = await file.read()
        
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
            try:
                response = await client.chat.create(
                    messages=messages,
                    model=model_to_use
                )
                
                # Extract response content
                if hasattr(response, 'choices') and len(response.choices) > 0:
                    content = response.choices[0].message.content
                    # Try to parse JSON from response
                    try:
                        # Extract JSON from response (might be wrapped in markdown code blocks)
                        content_clean = content.strip()
                        if content_clean.startswith('```'):
                            # Remove markdown code blocks
                            content_clean = content_clean.split('```')[1]
                            if content_clean.startswith('json'):
                                content_clean = content_clean[4:].strip()
                        result = json.loads(content_clean)
                        return JSONResponse(
                            content=result,
                            status_code=200
                        )
                    except json.JSONDecodeError:
                        # If not JSON, return raw content
                        return JSONResponse(
                            content={
                                "findings": content,
                                "severity": "unknown",
                                "confidence": 0
                            },
                            status_code=200
                        )
                else:
                    return JSONResponse(
                        content={"status": "error", "message": "No response from model"},
                        status_code=500
                    )
            except Exception as api_error:
                # If vision model failed, try with text prompt
                if has_vision:
                    messages = [
                        {
                            "role": "system",
                            "content": SYSTEM_PROMPT
                        },
                        {
                            "role": "user",
                            "content": "Analyze this text report of an X-ray..."
                        }
                    ]
                    response = await client.chat.create(
                        messages=messages,
                        model="llama-3.2-90b"
                    )
                    if hasattr(response, 'choices') and len(response.choices) > 0:
                        content = response.choices[0].message.content
                        try:
                            content_clean = content.strip()
                            if content_clean.startswith('```'):
                                content_clean = content_clean.split('```')[1]
                                if content_clean.startswith('json'):
                                    content_clean = content_clean[4:].strip()
                            result = json.loads(content_clean)
                            return JSONResponse(content=result, status_code=200)
                        except json.JSONDecodeError:
                            return JSONResponse(
                                content={
                                    "findings": content,
                                    "severity": "unknown",
                                    "confidence": 0
                                },
                                status_code=200
                            )
                raise api_error
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

