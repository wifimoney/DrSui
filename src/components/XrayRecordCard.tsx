import { useEffect, useState } from "react";
import { Eye, Share2, Lock, Unlock, FileText, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { fromHex } from "@mysten/sui/utils";
import { decryptXrayRecord } from "../services/mockBackend";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PermissionSwitch } from "./patient/PermissionSwitch";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { blobIdFromInt } from "@mysten/walrus";
import { walrusImageUrl } from "../lib/walrus_utils";
import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";

interface XrayRecordCardProps {
  id: string;
  title: string;
  date: string;
  isShared?: boolean; // Optional for doctor view
  isDoctorView?: boolean; // Flag to determine view mode
  onShareToggle?: (newState: boolean) => void;
  index?: number; // Index position of this card in the list
}

export function XrayRecordCard({ 
  id, 
  title, 
  date, 
  isShared = false,
  isDoctorView = false,
  onShareToggle,
  index = 0
}: XrayRecordCardProps) {
  console.log("XrayRecordCard component rendered", { id, title, index });
  const patient_registry = import.meta.env.VITE_PATIENT_REGISTRY;
  const package_id = import.meta.env.VITE_PACKAGE_ID;
  // Seal server configuration
  const serverObjectIds = [
    "0x164ac3d2b3b8694b8181c13f671950004765c23f270321a45fdd04d40cccf0f2", 
    "0x5466b7df5c15b508678d51496ada8afab0d6f70a01c10613123382b1b8131007"
  ];
  const suiClient = useSuiClient();
  const sealClient = new SealClient({
    suiClient,
    serverConfigs: serverObjectIds.map((id) => ({
        objectId: id,
        weight: 1,
    })),
    verifyKeyServers: false,
  });
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recordData, setRecordData] = useState<any>(null);
  const [owned, setOwned] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentAccount = useCurrentAccount();
  const client = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  });
  const patientData = async () => {
    const patientData = await client.getObject({
      id: patient_registry,
      options: {
        showContent: true,
      },
    });
    return patientData;
  };
  useEffect(() => {
    console.log("useEffect called in XrayRecordCard");
    console.log("currentAccount:", currentAccount);
    console.log("currentAccount?.address:", currentAccount?.address);
    
    const fetchData = async () => {
      console.log("Fetching data...");
      if (!currentAccount?.address) {
        console.log("No account address, returning early");
        return;
      }
      
      setIsLoading(true);
      try {
        const data = await patientData();
        console.log(data);
        const registryId = (data as any)?.data?.content?.fields?.registry?.fields?.id?.id;
        
        if (registryId) {
          console.log('Registry ID:', registryId);
          const owned = await client.getDynamicFieldObject({
            parentId: registryId,
            name: {
              type: 'address',
              value: currentAccount.address,
            },
          });
          console.log("Owned:", owned);
          setOwned(owned);
          
          // Get the object ID from the dynamic field value
          const ownedId = (owned as any)?.data?.content?.fields?.value;
          console.log("Owned ID:", ownedId);
          
          if (ownedId) {
            // Fetch the full object data using the ownedId
            const objectData = await client.getObject({
              id: ownedId,
              options: {
                showContent: true,
              },
            });
            console.log('Object data:', objectData);
            
            // Extract record fields from the object data (same structure as App.tsx)
            const recordFields = (objectData as any)?.data?.content?.fields;
            console.log("recordFields:", recordFields);
            
            if (recordFields) {
              setRecordData(recordFields);
              console.log('Body Parts:', recordFields.body_parts);
              console.log('Blob:', recordFields.blob);
              console.log('Patient:', recordFields.patient);
              console.log('Uploader:', recordFields.uploader);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentAccount?.address]);
  const handleDecrypt = async () => {
    setIsDecrypting(true);
    try {
      // Get blob ID from owned data
      console.log('Owned:', owned);
      const ownedId = (owned as any)?.data?.content?.fields?.value;
      const objectData = await client.getObject({
        id: ownedId,
        options: {
          showContent: true,
        },
      });
      console.log('Object data:', objectData);
      const recordFields = (objectData as any)?.data?.content?.fields;

      console.log("recordFields:", recordFields);
      
      // Get body part for this record based on the card's position/index
      let bodyPart = 'unknown';
      if (recordFields?.body_parts && recordFields.body_parts.length > 0) {
        // Use the index to get the corresponding body part
        bodyPart = recordFields.body_parts[index] || recordFields.body_parts[0];
      } else if (recordData?.body_parts && recordData.body_parts.length > 0) {
        // Fallback to recordData
        bodyPart = recordData.body_parts[index] || recordData.body_parts[0];
      }
      console.log('Body part:', bodyPart);
      // Construct filename in format: ${account?.address}-${bodyPart}.json
      const accountAddress = currentAccount?.address || '';

      const fileName = `${accountAddress}-${bodyPart}.json`;
      console.log('File name:', fileName);
      console.log('Body part:', bodyPart);
      
      // Get blob data - the blob array corresponds to body_parts by index
      const blobData = recordFields?.blob?.[index] || recordFields?.blob?.[0];
      console.log('Blob data:', blobData);
      
      // Extract blob_id from the blob structure
      // Blob structure from blockchain: { fields: { blob_id: "101684021963897672628454749071710670679042034548234599894850465957679589925488", id: { id: "0x..." } } }
      // blob_id is stored as a STRING representation of a big integer
      const blobIdString = blobData?.fields?.blob_id;
      console.log('Blob ID (string):', blobIdString);
      
      if (!blobIdString) {
        throw new Error("Could not find blob_id in blob data");
      }
      
      // Convert string to BigInt, then use blobIdFromInt to convert to the format Walrus expects
      const blobIdBigInt = BigInt(blobIdString);
      console.log('Blob ID (BigInt):', blobIdBigInt);
      const rawBlobId = blobIdFromInt(blobIdBigInt);
      console.log('Raw Blob ID (for Walrus):', rawBlobId);
      const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
      const directUrl = `${AGGREGATOR}/v1/blobs/by-quilt-id/${rawBlobId}/${fileName}`;
      console.log('Fetching image from Walrus aggregator:', directUrl);
      
      const res = await fetch(directUrl);
      if (!res.ok) {
        console.error(`Failed to fetch image: HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}`);
      }
      console.log('Response:', res);
      const imageBlob = await res.blob();
      console.log('imageBlob:', imageBlob);
      const imageBlobArray = new Uint8Array(await imageBlob.arrayBuffer());
      console.log('imageBlobArray:', imageBlobArray);
      const sessionKey = await SessionKey.create({
          address: currentAccount?.address || '',
          packageId: package_id,
          ttlMin: 10, // TTL of 10 minutes
          suiClient: new SuiClient({ url: getFullnodeUrl('testnet') }),
      });
      console.log("Signing session key...");
      const message = sessionKey.getPersonalMessage();
      console.log("Message created...");
      const { signature } = await signPersonalMessage({ message }); // User confirms in wallet
      console.log("Signature created...");
      sessionKey.setPersonalMessageSignature(signature); // Initialization complete
      console.log("Session key created...");
      // Create the Transaction for evaluating the seal_approve function.
      console.log("Creating transaction...");
      const tx = new Transaction();
      const idBytes = fromHex("0x1");
      const moduleName = "client_decryption";
      
      // Get the correct object ID - try from blob data or owned object
      const objectId = blobData?.id?.id || 
                       (owned as any)?.data?.content?.fields?.value?.id?.id ||
                       recordFields?.id?.id;
      
      if (!objectId) {
        throw new Error("Could not find object ID for seal_approve");
      }
      
      tx.moveCall({
        target: `${package_id}::${moduleName}::seal_approve`,
        arguments: [
            tx.pure.vector("u8", idBytes),
            tx.object(objectId)
        ]
      });
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      console.log("Decrypting data...");
      const decryptedBytes = await sealClient.decrypt({ data: imageBlobArray, sessionKey, txBytes });
      
      const decryptedSizeMB = (decryptedBytes.length / (1024 * 1024)).toFixed(2);
      
      // Print detailed information about the decrypted data
      console.log("=== DECRYPTED DATA ===");
      console.log("Decrypted data size:", decryptedSizeMB, "MB");
      console.log("Raw decrypted bytes:", decryptedBytes);
      console.log("Type:", typeof decryptedBytes);
      console.log("Length:", decryptedBytes.length, "bytes");
      console.log("First 100 bytes:", decryptedBytes.slice(0, 100));
      
      const decryptedData = new Uint8Array(decryptedBytes.buffer || decryptedBytes);
      console.log("Uint8Array length:", decryptedData.length);
      console.log("First 50 bytes as array:", Array.from(decryptedData.slice(0, 50)));
      
      // Create a new Uint8Array copy for the Blob to avoid type issues
      const finalData = Uint8Array.from(decryptedData);
      // Use image MIME type for X-ray images
      const mimeType = "image/jpeg"; // or "image/png" depending on your image format
      const blob = new Blob([finalData], { type: mimeType });
      const blobSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      console.log("Blob created - size:", blobSizeMB, "MB, type:", blob.type);
      console.log("=========================");
      const url = URL.createObjectURL(blob);
      console.log('blobId (string):', blobIdString);
      console.log('blobId (BigInt):', blobIdBigInt);
      console.log('Decrypted image URL:', url);
      
      // Use the decrypted blob URL instead of mock backend
      setImageUrl(url);
      setIsDecrypted(true);
    } catch (error) {
      console.error("Decryption error:", error);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <Card className="overflow-hidden bg-card border border-border shadow-soft hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col md:flex-row">
        {/* Encrypted Thumbnail Section */}
        <div className="relative w-full md:w-48 h-48 md:h-auto bg-black flex items-center justify-center flex-shrink-0">
          {!isDecrypted ? (
            <div className="text-center p-4">
              <div className="mx-auto size-12 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                <Lock className="size-6 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Encrypted Data</p>
            </div>
          ) : (
            <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden group">
               {imageUrl ? (
                 <ImageWithFallback 
                   src={imageUrl} 
                   alt="Decrypted X-Ray" 
                   className="object-cover w-full h-full opacity-80 transition-opacity group-hover:opacity-100"
                 />
               ) : (
                 <FileText className="size-16 text-primary opacity-50" />
               )}
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <p className="text-primary font-medium text-sm bg-black/80 px-3 py-1 rounded-full shadow-lg backdrop-blur-sm">Decrypted</p>
               </div>
            </div>
          )}
          
          {/* Overlay Pattern to suggest encryption */}
          {!isDecrypted && (
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-lg text-foreground">
                  {(() => {
                    // Get body part based on card index
                    const bodyPart = recordData?.body_parts?.[index] || 
                                    recordData?.body_parts?.[0] || 
                                    null;
                    if (bodyPart) {
                      // Properly capitalize: first letter uppercase, rest lowercase
                      const capitalized = bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1).toLowerCase();
                      return `${capitalized} X-Ray`;
                    }
                    return title;
                  })()}
                </h3>
                <p className="text-sm text-muted-foreground">{date}</p>
              </div>
            </div>
            
            {/* Display Body Parts */}
            {recordData?.body_parts && recordData.body_parts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {recordData.body_parts.map((part: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {part}
                  </Badge>
                ))}
              </div>
            )}
            
            {isLoading && (
              <p className="text-sm text-muted-foreground mt-2">Loading record data...</p>
            )}
            
            <p className="text-sm text-muted-foreground mt-2">
              Stored securely on Walrus. Decryption required to view details.
            </p>
            
            {/* Display additional info if available */}
            {recordData && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {recordData.blob && Array.isArray(recordData.blob) && recordData.blob.length > 0 && (
                  <p>Blob ID: {recordData.blob[0]?.id || 'N/A'}</p>
                )}
                {recordData.uploader && Array.isArray(recordData.uploader) && recordData.uploader.length > 0 && (
                  <p>Uploader: {recordData.uploader[0]?.slice(0, 6)}...{recordData.uploader[0]?.slice(-4)}</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <Button 
              variant={isDecrypted ? "secondary" : "default"}
              className={!isDecrypted ? "bg-primary hover:bg-primary-hover shadow-glow w-40" : "w-40"}
              onClick={handleDecrypt}
              disabled={isDecrypted || isDecrypting}
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Decrypting...
                </>
              ) : isDecrypted ? (
                <>
                  <Unlock className="mr-2 size-4" />
                  View X-ray
                </>
              ) : (
                <>
                  <Eye className="mr-2 size-4" />
                  Decrypt & View
                </>
              )}
            </Button>

            {!isDoctorView && onShareToggle && (
              <div className="flex items-center">
                {isShared ? (
                  <PermissionSwitch 
                    isShared={isShared}
                    onToggle={onShareToggle}
                    onRevoke={() => onShareToggle(false)}
                  />
                ) : (
                  <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border border-border/50">
                    <Switch 
                      checked={isShared} 
                      onCheckedChange={onShareToggle}
                      id={`share-${id}`}
                    />
                    <Label htmlFor={`share-${id}`} className="text-sm font-medium cursor-pointer flex items-center gap-2">
                      <Share2 className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Share with Doctor</span>
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
