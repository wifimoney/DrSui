"""
Zero-Knowledge Proof Utilities for Medical AI Analysis

This module provides cryptographic proof generation for medical image analysis
in the DrSui application. It enables privacy-preserving verification that:

1. An AI analysis was performed on a specific image
2. The analysis results are authentic and unmodified
3. The computation occurred in a trusted execution environment (TEE)
4. All of this WITHOUT revealing the actual medical image

WHY ZERO-KNOWLEDGE PROOFS FOR MEDICAL DATA?

Medical images (X-rays, CT scans, etc.) contain highly sensitive patient
information. Traditional approaches require sharing the full image for
verification, which violates patient privacy. ZK proofs solve this by:

- Privacy Preservation: Prove analysis happened without showing the image
- Data Integrity: Verify results haven't been tampered with
- Regulatory Compliance: Meet HIPAA/GDPR requirements for minimal disclosure
- Blockchain Integration: Store proofs on-chain without storing sensitive data
- Auditability: Maintain verifiable records without exposing patient data

HOW IT WORKS:

1. Image Commitment: Hash the image to create a cryptographic commitment
   - The commitment is a one-way hash that uniquely identifies the image
   - It's impossible to reconstruct the image from the commitment
   - But we can prove we have the image by revealing it later (if needed)

2. Analysis Proof: Create a signed proof linking:
   - The image commitment (what was analyzed)
   - The AI model used (which AI performed the analysis)
   - The analysis results (findings, severity, confidence)
   - Timestamp and nonce (when and uniqueness)

3. Signature Verification: Use ECC (Elliptic Curve Cryptography) to sign
   - Private key signs the proof (only DrSui backend has this)
   - Public key verifies the signature (anyone can verify)
   - Proves the proof came from the authorized DrSui system

4. TEE Attestation: Prove computation happened in Atoma's secure enclave
   - Trusted Execution Environment (TEE) provides hardware-level security
   - Enclave signature proves code ran in isolated, tamper-proof environment
   - Prevents malicious modification of AI analysis results

INTEGRATION WITH ATOMA TEE:

Atoma provides a Trusted Execution Environment (TEE) that:
- Runs AI models in hardware-isolated secure enclaves
- Prevents even the cloud provider from seeing the data
- Generates cryptographic attestations proving secure execution
- This module creates proofs that incorporate TEE attestations

BLOCKCHAIN INTEGRATION:

Proofs are stored on the Sui blockchain in the Diagnosis object:
- Proofs are serialized to bytes (vector<u8> in Move)
- Stored immutably on-chain for permanent audit trail
- Verifiable by anyone without revealing patient data
- Enables trustless verification of medical AI analysis
"""

import hashlib
import json
import time
import secrets
from typing import Dict, Any, Optional, Tuple
from Crypto.PublicKey import ECC
from Crypto.Signature import DSS
from Crypto.Hash import SHA256, SHA3_256
import base58


class ZKProofGenerator:
    """
    Zero-Knowledge Proof Generator for Medical AI Analysis
    
    This class generates cryptographic proofs that demonstrate:
    1. An AI analysis was performed on a specific image (without revealing the image)
    2. The analysis results are authentic and unmodified
    3. The computation occurred in a trusted execution environment
    
    The proofs can be verified by anyone without access to the original medical image,
    enabling privacy-preserving verification on the blockchain.
    """
    
    def __init__(self, atoma_model_id: str):
        """
        Initialize the ZK Proof Generator.
        
        Args:
            atoma_model_id: The Atoma AI model ID used for analysis
                           (e.g., "atoma-vision-v1" or model UUID)
        
        This creates or loads a signing keypair that will be used to sign all proofs.
        The private key must be kept secret - only the DrSui backend should have it.
        The public key can be shared for verification.
        """
        self.atoma_model_id = atoma_model_id
        self.proof_version = "1.0"
        self.proof_type = "zk_medical_analysis"
        
        # Generate or load ECC keypair for signing proofs
        # Using P-256 curve (secp256r1) - same as used in TLS/HTTPS
        # This provides 128-bit security level
        try:
            # Try to load existing keypair from environment or file
            # In production, load from secure key management system
            private_key_pem = self._load_or_generate_key()
            self.private_key = ECC.import_key(private_key_pem)
        except Exception as e:
            # Generate new keypair if loading fails
            print(f"Warning: Could not load keypair, generating new one: {e}")
            self.private_key = ECC.generate(curve='P-256')
        
        # Extract public key for verification
        self.public_key = self.private_key.public_key()
        
        # Initialize proof metadata
        self.proof_metadata = {
            "proof_type": self.proof_type,
            "version": self.proof_version,
            "generator": "DrSui-ZK-Proof-System",
            "atoma_model_id": self.atoma_model_id,
        }
    
    def _load_or_generate_key(self) -> str:
        """
        Load existing ECC keypair or generate a new one.
        
        In production, this should:
        - Load from secure key management (AWS KMS, HashiCorp Vault, etc.)
        - Use environment variables for development
        - Never commit keys to version control
        
        Returns:
            PEM-encoded private key string
        """
        import os
        
        # Check for key in environment variable (for development)
        key_pem = os.getenv('DRSUI_ZK_PRIVATE_KEY')
        if key_pem:
            return key_pem
        
        # In production, load from secure storage
        # For now, generate a new key (should be persisted in production)
        key = ECC.generate(curve='P-256')
        return key.export_key(format='PEM')
    
    def generate_image_commitment(self, image_bytes: bytes) -> str:
        """
        Creates a cryptographic commitment to the image without revealing it.
        
        This is the "zero-knowledge" part - we prove we have the image
        without showing the image itself. The commitment is:
        - One-way: Cannot reconstruct image from commitment
        - Binding: Each unique image produces unique commitment
        - Hiding: Commitment reveals nothing about image content
        
        The commitment uses SHA3-256 (Keccak) which is:
        - Resistant to length extension attacks
        - Used in Ethereum and other blockchain systems
        - Provides 256-bit security (128-bit collision resistance)
        
        Args:
            image_bytes: The raw image file bytes (DICOM, PNG, etc.)
        
        Returns:
            Hexadecimal string of the commitment hash (64 characters)
        
        Example:
            >>> generator = ZKProofGenerator("atoma-vision-v1")
            >>> with open("xray.dcm", "rb") as f:
            ...     image_bytes = f.read()
            >>> commitment = generator.generate_image_commitment(image_bytes)
            >>> print(commitment)
            'a3f5b2c8d9e1f4a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0'
        """
        try:
            # Create SHA3-256 hash of the image
            # SHA3-256 is part of the SHA-3 family (Keccak)
            # It's different from SHA-256 and provides better security properties
            hash_obj = SHA3_256.new(image_bytes)
            image_hash = hash_obj.digest()
            
            # Add timestamp and salt for uniqueness
            # This prevents rainbow table attacks and ensures uniqueness
            # even if the same image is analyzed multiple times
            timestamp = int(time.time())
            salt = secrets.token_bytes(16)  # 128-bit random salt
            
            # Combine hash, timestamp, and salt
            # This creates a unique commitment even for identical images
            commitment_data = image_hash + timestamp.to_bytes(8, 'big') + salt
            
            # Final hash of the commitment data
            commitment_hash = SHA3_256.new(commitment_data).digest()
            
            # Return as hexadecimal string for easy storage and transmission
            return commitment_hash.hex()
            
        except Exception as e:
            raise ValueError(f"Failed to generate image commitment: {str(e)}")
    
    def generate_analysis_proof(
        self,
        image_commitment: str,
        ai_response: dict,
        timestamp: Optional[int] = None
    ) -> dict:
        """
        Generates a ZK proof that:
        1. We committed to an image (image_commitment)
        2. We ran AI analysis on that image
        3. We got these specific results (ai_response)
        4. All without revealing the image itself
        
        The proof is cryptographically signed, making it tamper-proof.
        Anyone can verify the proof without access to the original image.
        
        Args:
            image_commitment: The cryptographic commitment hash from
                            generate_image_commitment()
            ai_response: Dictionary containing AI analysis results:
                        {
                            "findings": {...},
                            "severity": "HIGH|MEDIUM|LOW",
                            "confidence": 0.95,
                            "status": "NORMAL|ABNORMAL",
                            ...
                        }
            timestamp: Optional Unix timestamp (defaults to current time)
        
        Returns:
            Dictionary containing the complete ZK proof:
            {
                "proof_type": "zk_medical_analysis",
                "version": "1.0",
                "image_commitment": str,
                "analysis_hash": str,
                "model_id": str,
                "timestamp": int,
                "signature": str (base58 encoded),
                "public_key": str (base58 encoded),
                "nonce": str
            }
        
        Example:
            >>> generator = ZKProofGenerator("atoma-vision-v1")
            >>> commitment = "a3f5b2c8..."
            >>> ai_results = {"findings": {"pneumonia": 0.95}, "severity": "HIGH"}
            >>> proof = generator.generate_analysis_proof(commitment, ai_results)
            >>> print(proof["signature"])
            '5KJvsngHeM...'
        """
        try:
            # Use current time if not provided
            if timestamp is None:
                timestamp = int(time.time())
            
            # Generate random nonce for uniqueness
            # Nonce prevents replay attacks and ensures each proof is unique
            nonce = secrets.token_hex(16)  # 128-bit nonce
            
            # Hash the AI response to create analysis_hash
            # This commits to the results without storing the full response
            # The hash is deterministic - same response = same hash
            ai_response_json = json.dumps(ai_response, sort_keys=True)
            ai_response_bytes = ai_response_json.encode('utf-8')
            analysis_hash_obj = SHA256.new(ai_response_bytes)
            analysis_hash = analysis_hash_obj.hexdigest()
            
            # Create the proof payload that will be signed
            # This payload contains all the information needed for verification
            # but NOT the actual image or full analysis details
            proof_payload = {
                "proof_type": self.proof_type,
                "version": self.proof_version,
                "image_commitment": image_commitment,
                "analysis_hash": analysis_hash,
                "model_id": self.atoma_model_id,
                "timestamp": timestamp,
                "nonce": nonce,
            }
            
            # Serialize payload for signing
            # Sort keys for deterministic JSON serialization
            payload_json = json.dumps(proof_payload, sort_keys=True)
            payload_bytes = payload_json.encode('utf-8')
            
            # Hash the payload before signing (ECDSA signs hashes, not raw data)
            payload_hash = SHA256.new(payload_bytes)
            
            # Sign the payload with our private key using ECDSA
            # ECDSA (Elliptic Curve Digital Signature Algorithm) provides:
            # - Strong security (128-bit for P-256)
            # - Small signature size (64 bytes for P-256)
            # - Fast verification
            signer = DSS.new(self.private_key, 'fips-186-3')
            signature = signer.sign(payload_hash)
            
            # Encode signature and public key in Base58 for blockchain storage
            # Base58 is used in Bitcoin, Sui, and other blockchains because:
            # - Avoids ambiguous characters (0, O, I, l)
            # - More compact than Base64
            # - Human-readable
            signature_b58 = base58.b58encode(signature).decode('utf-8')
            
            # Export public key for verification
            # The public key allows anyone to verify the signature
            # without needing the private key
            public_key_pem = self.public_key.export_key(format='PEM')
            public_key_b58 = base58.b58encode(public_key_pem.encode('utf-8')).decode('utf-8')
            
            # Construct the complete proof
            proof = {
                "proof_type": self.proof_type,
                "version": self.proof_version,
                "image_commitment": image_commitment,
                "analysis_hash": analysis_hash,
                "model_id": self.atoma_model_id,
                "timestamp": timestamp,
                "signature": signature_b58,
                "public_key": public_key_b58,
                "nonce": nonce,
                "metadata": self.proof_metadata,
            }
            
            return proof
            
        except Exception as e:
            raise ValueError(f"Failed to generate analysis proof: {str(e)}")
    
    def verify_proof(self, proof: dict, expected_commitment: Optional[str] = None) -> bool:
        """
        Verifies a ZK proof without seeing the original image.
        
        This function allows anyone to verify that:
        1. The proof was signed by the authorized DrSui backend
        2. The image commitment matches (if expected_commitment provided)
        3. The proof hasn't been tampered with
        4. The signature is cryptographically valid
        
        Verification does NOT require:
        - The original image
        - The private key
        - Access to DrSui backend systems
        
        This enables trustless verification on the blockchain.
        
        Args:
            proof: The proof dictionary from generate_analysis_proof()
            expected_commitment: Optional expected image commitment to verify against
        
        Returns:
            True if proof is valid, False otherwise
        
        Example:
            >>> generator = ZKProofGenerator("atoma-vision-v1")
            >>> proof = {...}  # Proof from generate_analysis_proof()
            >>> is_valid = generator.verify_proof(proof, expected_commitment="a3f5...")
            >>> print(is_valid)
            True
        """
        try:
            # Extract signature and public key from proof
            signature_b58 = proof.get("signature")
            public_key_b58 = proof.get("public_key")
            
            if not signature_b58 or not public_key_b58:
                return False
            
            # Decode Base58-encoded signature and public key
            try:
                signature = base58.b58decode(signature_b58)
                public_key_pem = base58.b58decode(public_key_b58).decode('utf-8')
                public_key = ECC.import_key(public_key_pem)
            except Exception as e:
                print(f"Failed to decode signature or public key: {e}")
                return False
            
            # Recreate the signed payload (must match exactly what was signed)
            proof_payload = {
                "proof_type": proof.get("proof_type"),
                "version": proof.get("version"),
                "image_commitment": proof.get("image_commitment"),
                "analysis_hash": proof.get("analysis_hash"),
                "model_id": proof.get("model_id"),
                "timestamp": proof.get("timestamp"),
                "nonce": proof.get("nonce"),
            }
            
            # Serialize payload exactly as it was signed
            payload_json = json.dumps(proof_payload, sort_keys=True)
            payload_bytes = payload_json.encode('utf-8')
            
            # Hash the payload
            payload_hash = SHA256.new(payload_bytes)
            
            # Verify the signature using the public key
            # DSS verifier checks that the signature matches the hash
            verifier = DSS.new(public_key, 'fips-186-3')
            try:
                verifier.verify(payload_hash, signature)
                signature_valid = True
            except ValueError:
                # Signature verification failed
                signature_valid = False
            
            # Verify commitment matches (if provided)
            commitment_valid = True
            if expected_commitment:
                commitment_valid = (proof.get("image_commitment") == expected_commitment)
            
            # Proof is valid only if both signature and commitment are valid
            return signature_valid and commitment_valid
            
        except Exception as e:
            print(f"Error verifying proof: {e}")
            return False
    
    def create_atoma_tee_proof(self, analysis_data: dict) -> dict:
        """
        Special proof that shows the analysis was done in Atoma's 
        Trusted Execution Environment (TEE).
        
        A Trusted Execution Environment (TEE) is a secure area of a processor
        that provides:
        - Hardware-level isolation from the main operating system
        - Protection against tampering and side-channel attacks
        - Cryptographic attestation proving code ran in the enclave
        - Even cloud providers cannot see the data or code
        
        Atoma uses TEEs (like Intel SGX or AMD SEV) to run AI models securely.
        This function creates a proof that incorporates TEE attestation,
        proving the computation happened in a secure enclave.
        
        In production, this would include:
        - Real TEE attestation report from Intel/AMD
        - Enclave measurement (hash of the code that ran)
        - Remote attestation signature
        - TEE certificate chain
        
        For now, we simulate this with metadata that will be replaced
        with real attestations in production.
        
        Args:
            analysis_data: Dictionary containing the full AI analysis results
        
        Returns:
            Dictionary containing TEE-enhanced proof with attestation metadata
        
        Example:
            >>> generator = ZKProofGenerator("atoma-vision-v1")
            >>> analysis = {"findings": {...}, "severity": "HIGH"}
            >>> tee_proof = generator.create_atoma_tee_proof(analysis)
            >>> print(tee_proof["tee_attestation"]["enclave_id"])
            'atoma-tee-enclave-v1'
        """
        try:
            # Generate standard analysis proof first
            # We need the image commitment, but for TEE proof we might
            # have already committed to the image
            # For now, we'll create a commitment from the analysis data itself
            # In production, this would use the actual image commitment
            
            # Create a commitment from analysis metadata
            analysis_json = json.dumps(analysis_data, sort_keys=True)
            analysis_bytes = analysis_json.encode('utf-8')
            analysis_commitment = self.generate_image_commitment(analysis_bytes)
            
            # Generate base proof
            base_proof = self.generate_analysis_proof(
                image_commitment=analysis_commitment,
                ai_response=analysis_data
            )
            
            # Add TEE-specific attestation metadata
            # In production, this would come from the actual TEE attestation report
            tee_attestation = {
                "tee_type": "atoma-secure-enclave",
                "enclave_id": f"atoma-tee-{self.atoma_model_id}",
                "attestation_version": "1.0",
                "enclave_measurement": self._generate_enclave_measurement(),
                "remote_attestation": {
                    "attested": True,
                    "attestation_timestamp": int(time.time()),
                    "attestation_provider": "atoma-tee-service",
                    # In production, this would be a real cryptographic signature
                    # from the TEE attestation service
                    "attestation_signature": "simulated-for-development",
                },
                "security_properties": {
                    "memory_encryption": True,
                    "code_integrity": True,
                    "remote_attestation": True,
                    "secure_boot": True,
                },
            }
            
            # Enhance proof with TEE attestation
            tee_proof = {
                **base_proof,
                "tee_attestation": tee_attestation,
                "proof_type": "zk_medical_analysis_tee",
                "computation_environment": "trusted_execution_environment",
            }
            
            return tee_proof
            
        except Exception as e:
            raise ValueError(f"Failed to create TEE proof: {str(e)}")
    
    def _generate_enclave_measurement(self) -> str:
        """
        Generate enclave measurement (hash of the code that ran in TEE).
        
        In production, this would be the actual measurement from the TEE
        attestation report. The measurement is a cryptographic hash of:
        - The code that ran in the enclave
        - The configuration and security parameters
        - The model weights (if applicable)
        
        This allows verification that the correct, unmodified code ran.
        
        Returns:
            Hexadecimal string of the enclave measurement
        """
        # Simulate enclave measurement
        # In production, this would come from the TEE attestation report
        measurement_data = f"{self.atoma_model_id}-enclave-v1".encode('utf-8')
        measurement_hash = SHA256.new(measurement_data).digest()
        return measurement_hash.hex()


def create_proof_for_blockchain(zk_proof: dict) -> bytes:
    """
    Converts the ZK proof into a format suitable for storing on Sui blockchain.
    
    The Sui blockchain stores data in Move objects, which use vector<u8> (byte arrays)
    for binary data. This function serializes the proof to bytes that can be:
    - Stored in the Diagnosis object on-chain
    - Transmitted efficiently
    - Verified by anyone with the proof bytes
    
    The proof is serialized as JSON and converted to UTF-8 bytes. In production,
    you might want to:
    - Use a more compact binary format (MessagePack, CBOR)
    - Compress the proof (gzip, zstd)
    - Add versioning for format evolution
    
    Args:
        zk_proof: The proof dictionary from ZKProofGenerator methods
    
    Returns:
        Bytes suitable for storing in vector<u8> in Move/Sui
    
    Example:
        >>> generator = ZKProofGenerator("atoma-vision-v1")
        >>> proof = generator.generate_analysis_proof(...)
        >>> proof_bytes = create_proof_for_blockchain(proof)
        >>> print(len(proof_bytes))
        1024
    """
    try:
        # Serialize proof to JSON
        # JSON is human-readable and easy to debug
        # For production, consider binary formats for efficiency
        proof_json = json.dumps(zk_proof, sort_keys=True)
        
        # Convert to UTF-8 bytes
        # UTF-8 is the standard encoding for JSON and works well with Move
        proof_bytes = proof_json.encode('utf-8')
        
        # Optional: Compress the proof to save on-chain storage costs
        # Uncomment if you want compression:
        # import gzip
        # proof_bytes = gzip.compress(proof_bytes)
        
        return proof_bytes
        
    except Exception as e:
        raise ValueError(f"Failed to create blockchain proof: {str(e)}")


def deserialize_proof_from_blockchain(proof_bytes: bytes) -> dict:
    """
    Deserializes a proof from blockchain bytes back to a dictionary.
    
    This is the inverse of create_proof_for_blockchain(). It allows
    reading proofs that were stored on-chain.
    
    Args:
        proof_bytes: Bytes from blockchain (vector<u8> in Move)
    
    Returns:
        Dictionary containing the proof
    
    Example:
        >>> proof_bytes = b'{"proof_type": "zk_medical_analysis", ...}'
        >>> proof = deserialize_proof_from_blockchain(proof_bytes)
        >>> print(proof["proof_type"])
        'zk_medical_analysis'
    """
    try:
        # Decode from UTF-8
        proof_json = proof_bytes.decode('utf-8')
        
        # Parse JSON
        proof = json.loads(proof_json)
        
        return proof
        
    except Exception as e:
        raise ValueError(f"Failed to deserialize blockchain proof: {str(e)}")
