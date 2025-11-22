import { useState, useEffect } from "react";
import { CloudUpload, X, Loader2, Wallet } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient, useSignAndExecuteTransaction, ConnectModal } from "@mysten/dapp-kit";
import { SealClient } from "@mysten/seal";
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { getFullnodeUrl } from "@mysten/sui/client";
import { walrus, WalrusFile } from '@mysten/walrus';
import { toast } from 'sonner';
import { Transaction } from "@mysten/sui/transactions";
interface UploadModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function UploadModal({ onClose, onSuccess }: UploadModalProps) {
  const package_id = import.meta.env.VITE_PACKAGE_ID;
  const patient_registry = import.meta.env.VITE_PATIENT_REGISTRY;
  const doctor_address = import.meta.env.VITE_DOCTOR_ACCOUNT;
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const suiClient = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  const client = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  }).$extend(
    walrus({
      uploadRelay: {
        host: 'https://upload-relay.testnet.walrus.space',
        sendTip: {
          max: 1_000,
        },
      },     
      wasmUrl: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
    }),
  );
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanDate, setScanDate] = useState<string>("");
  const [bodyPart, setBodyPart] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seal server configuration
  const serverObjectIds = [
    "0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2", 
    "0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007"
  ];

  // Initialize SealClient
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
      objectId: id,
      weight: 1,
    })),
    verifyKeyServers: false,
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Generate preview URL when file is selected
  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      // Cleanup function to revoke the object URL
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Validate that the file is an image
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
      } else {
        alert("Please upload an image file (PNG, JPEG, etc.)");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Validate that the file is an image
      if (file.type.startsWith("image/")) {
        setSelectedFile(file);
        setError(null);
      } else {
        alert("Please upload an image file (PNG, JPEG, etc.)");
      }
    }
  };

  const handleEncryptAndMint = async () => {
    // Validation
    if (!selectedFile) {
      setError("Please select an image file");
      return;
    }
    if (!scanDate) {
      setError("Please select a scan date");
      return;
    }
    if (!bodyPart) {
      setError("Please select a body part");
      return;
    }
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("=== ENCRYPTION PROCESS ===");
      
      // Convert file to ArrayBuffer and then to Uint8Array
      const arrayBuffer = await selectedFile.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      const fileSizeMB = (selectedFile.size / (1024 * 1024)).toFixed(2);
      const dataSizeMB = (data.length / (1024 * 1024)).toFixed(2);
      
      console.log("Original file size:", fileSizeMB, "MB");
      console.log("Data to encrypt:", dataSizeMB, "MB");
      console.log("Encrypting data with Seal SDK...");
      
      // Encrypt the file using Seal SDK
      toast.loading('Encrypting file with Seal SDK...');
      const { encryptedObject: encryptedBytes, key: backupKey } = await sealClient.encrypt({
        threshold: 1,
        packageId: package_id,
        id: "0x1",
        data
      });

      console.log("✓ Encryption complete");
      console.log("Encrypted data size:", (encryptedBytes.length / (1024 * 1024)).toFixed(2), "MB");
      
      // Prepare encrypted file for Walrus upload
      const encryptedFile: WalrusFile = WalrusFile.from({
        contents: new Uint8Array(encryptedBytes),
        identifier: `${account?.address}-${bodyPart}.json`,
      });

      toast.dismiss();
      toast.loading('Preparing upload to Walrus...');
      
      // Create Walrus upload flow
      const flow = client.walrus.writeFilesFlow({
        files: [encryptedFile],
      });
        
      await flow.encode();
        
      toast.dismiss();
      toast.loading('Registering file on Sui blockchain...');
      
      const registerTx = flow.register({
        epochs: 3,
        owner: account?.address || '',
        deletable: true,
      });
        
      const { digest } = await signAndExecuteTransaction({ 
        transaction: registerTx 
      });
        
      toast.dismiss();
      toast.loading('Uploading encrypted file to Walrus storage...');
      
      // Upload the encrypted data to storage nodes
      await flow.upload({ digest });
        
      const info = await client.getTransactionBlock({
        digest, 
        options: { showObjectChanges: true }
      });
      const blobChange =
      info?.objectChanges?.find(
        (o: any) =>
          o.type === 'created' &&
          ((o.objectType ?? o.object_type) || '').toLowerCase().endsWith('::blob::blob')
      ) ?? null;
      const blob_objectId = (blobChange as any)?.objectId;
      
      // Validate blob creation
      if (!blob_objectId) {
        throw new Error('Failed to create blob object. Please try again.');
      }
      const tx = new Transaction();
      tx.moveCall({
        target: `${package_id}::patient::upload_data_from_patient`,
        arguments: [
          tx.object(patient_registry),
          tx.pure.address(doctor_address),
          tx.object(blob_objectId),
          tx.pure.string(bodyPart)
        ]
      });
      // Extract blob ID from transaction info
      let blobId = `BLOB-${Date.now()}`;
      if (info.objectChanges) {
        const createdChange = info.objectChanges.find(
          (change: any) => change.type === 'created'
        ) as any;
        if (createdChange && 'objectId' in createdChange) {
          blobId = createdChange.objectId;
        }
      }
      const createResult = await signAndExecuteTransaction({ 
        transaction: tx
      });
      
      console.log('✅ Project created on-chain:', createResult.digest);
      
      // Wait for transaction and get full details
      const txDetails = await suiClient.waitForTransaction({
        digest: createResult.digest,
        options: { showEffects: true, showObjectChanges: true }
      });
      console.log('Transaction details:', txDetails);
      console.log(`✓ Encrypted blob stored on Walrus with ID: ${blobId}`);
      console.log(`✓ Ownership NFT minted on Sui blockchain: ${digest}`);
      
      // Format date for display
      const dateObj = new Date(scanDate);
      const formattedDate = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      
      // Create record metadata
      const recordMetadata = {
        id: `XR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
        title: `${bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)} X-Ray`,
        date: formattedDate,
        blobId,
        backupKey: backupKey, // Seal backup key
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        scanDate,
        bodyPart,
        encryptedDataSize: encryptedBytes.length,
        encryptionAlgorithm: "Seal SDK",
      };
      
      console.log("Record metadata:", {
        ...recordMetadata,
        backupKey: backupKey ? "***" : undefined,
      });
      
      toast.dismiss();
      toast.success('File encrypted and uploaded successfully!');
      
      // Success - close modal and trigger refresh
      setTimeout(() => {
        setIsLoading(false);
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 1000);
      
    } catch (err) {
      console.error("Encryption/Upload error:", err);
      toast.dismiss();
      const errorMessage = err instanceof Error ? err.message : "Failed to encrypt and upload file. Please try again.";
      toast.error(errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-[600px] max-h-[90vh] p-8 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="size-6" />
        </button>

        {/* Header */}
        <div className="mb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-foreground font-semibold text-2xl mb-1">Upload Diagnostic Imaging</h2>
              <p className="text-muted-foreground">Securely store on Walrus</p>
            </div>
            {/* Wallet Connection Button */}
            {!account ? (
              <ConnectModal
                trigger={
                  <Button 
                    variant="outline"
                    size="sm"
                    className="gap-2 h-[36px] px-4 rounded-lg"
                  >
                    <Wallet className="size-4" />
                    <span className="text-sm">Connect Wallet</span>
                  </Button>
                }
              />
            ) : (
              <div className="inline-flex items-center justify-center gap-2 px-4 h-[36px] rounded-lg border border-border bg-background text-foreground text-sm font-medium whitespace-nowrap">
                <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="font-mono text-sm">
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl transition-all overflow-auto flex-grow min-h-[200px] ${
            isDragging
              ? "border-primary bg-teal-50/50"
              : "border-primary/50 bg-teal-50/30 hover:border-primary hover:bg-teal-50/50"
          }`}
        >
          <label htmlFor="file-upload" className="cursor-pointer w-full min-h-full flex flex-col items-center justify-center relative">
            {previewUrl ? (
              <div className="relative w-full flex items-center justify-center p-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-auto h-auto"
                  style={{ maxWidth: '100%' }}
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                  <div className="opacity-0 hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/50 px-3 py-1 rounded pointer-events-auto">
                    Click to change image
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="p-3 bg-card rounded-full shadow-sm">
                  <CloudUpload className="size-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-foreground font-medium mb-1">
                    Drag image files here
                  </p>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Files are encrypted and stored on Walrus. You receive the ownership NFT.
                  </p>
                </div>
              </div>
            )}
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*"
            />
          </label>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-2 gap-4 mt-6 mb-6 flex-shrink-0">
          <div>
            <Label htmlFor="scan-date" className="text-foreground mb-2 block">
              Date of Scan
            </Label>
            <Input
              id="scan-date"
              type="date"
              className="rounded-lg border-input h-11"
              value={scanDate}
              onChange={(e) => {
                setScanDate(e.target.value);
                setError(null);
              }}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="body-part" className="text-foreground mb-2 block">
              Body Part
            </Label>
            <Select value={bodyPart} onValueChange={(value) => {
              setBodyPart(value);
              setError(null);
            }} disabled={isLoading}>
              <SelectTrigger className="rounded-lg border-input h-11">
                <SelectValue placeholder="Select body part" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chest">Chest</SelectItem>
                <SelectItem value="head">Head</SelectItem>
                <SelectItem value="abdomen">Abdomen</SelectItem>
                <SelectItem value="knee">Knee</SelectItem>
                <SelectItem value="hand">Hand</SelectItem>
                <SelectItem value="foot">Foot</SelectItem>
                <SelectItem value="spine">Spine</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleEncryptAndMint}
          disabled={isLoading || !selectedFile || !scanDate || !bodyPart}
          className="w-full h-12 text-primary-foreground rounded-xl bg-primary hover:bg-primary-hover shadow-glow transition-all flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 mr-2 animate-spin" />
              Encrypting & Minting...
            </>
          ) : (
            <>
              <CloudUpload className="size-5 mr-2" />
              Encrypt & Mint Record
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
