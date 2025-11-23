import { useEffect, useState } from "react";
import { Eye, Share2, Lock, Unlock, FileText, Loader2, X } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { fromHex } from "@mysten/sui/utils";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PermissionSwitch } from "./patient/PermissionSwitch";
import { useCurrentAccount, useSignPersonalMessage, useSuiClient, useSignAndExecuteTransaction, useSignTransaction } from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { blobIdFromInt } from "@mysten/walrus";
import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from 'sonner';
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

interface XrayRecordCardProps {
  id: string;
  title: string;
  date: string;
  isShared?: boolean; 
  isDoctorView?: boolean; 
  onShareToggle?: (newState: boolean, doctorAddress?: string) => void | Promise<void>;
  index?: number; 
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
  const patient_registry = import.meta.env.VITE_PATIENT_REGISTRY;
  const doctor_registry = import.meta.env.VITE_DOCTOR_REGISTRY;
  const package_id = import.meta.env.VITE_PACKAGE_ID;
  const sponsorAddress = import.meta.env.VITE_SPONSOR_ACCOUNT; //
  const sponsor_priv = import.meta.env.VITE_SPONSOR_ACCOUNT_PRIV; //
  const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsor_priv);
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
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
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [recordData, setRecordData] = useState<any>(null);
  const [owned, setOwned] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // --- DIALOG STATE ---
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [doctorAddress, setDoctorAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);


  const currentAccount = useCurrentAccount();
  const client = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  });

  const patientData = async () => {
    if (!patient_registry) throw new Error("Patient registry not configured");
    return await client.getObject({
      id: patient_registry,
      options: { showContent: true },
    });
  };

  // Fetch Data Effect
  useEffect(() => {
    const fetchData = async () => {
      if (!currentAccount?.address) return;
      
      setIsLoading(true);
      try {
        const data = await patientData();
        const registryId = (data as any)?.data?.content?.fields?.registry?.fields?.id?.id;
        
        if (registryId) {
          const owned = await client.getDynamicFieldObject({
            parentId: registryId,
            name: { type: 'address', value: currentAccount.address },
          });
          setOwned(owned);
          
          if ((owned as any)?.error?.code === 'dynamicFieldNotFound') {
            setRecordData(null);
            return;
          }
          
          const ownedId = (owned as any)?.data?.content?.fields?.value;
          if (!ownedId) return;
          
          const objectData = await client.getObject({
            id: ownedId,
            options: { showContent: true },
          });
          
          const recordFields = (objectData as any)?.data?.content?.fields;
          if (recordFields) setRecordData(recordFields);
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
      if ((owned as any)?.error?.code === 'dynamicFieldNotFound') {
        throw new Error("User has not registered yet.");
      }
      
      const ownedId = (owned as any)?.data?.content?.fields?.value;
      if (!ownedId) throw new Error("Could not find owned object ID");
      
      const objectData = await client.getObject({
        id: ownedId,
        options: { showContent: true },
      });
      
      const recordFields = (objectData as any)?.data?.content?.fields;

      let bodyPart = 'unknown';
      if (recordFields?.body_parts?.length > 0) {
        bodyPart = recordFields.body_parts[index] || recordFields.body_parts[0];
      } else if (recordData?.body_parts?.length > 0) {
        bodyPart = recordData.body_parts[index] || recordData.body_parts[0];
      }

      const accountAddress = currentAccount?.address || '';
      const fileName = `${accountAddress}-${bodyPart}.json`;
      const blobData = recordFields?.blob?.[index] || recordFields?.blob?.[0];
      const blobIdString = blobData?.fields?.blob_id;
      
      if (!blobIdString) throw new Error("Could not find blob_id");
      
      const blobIdBigInt = BigInt(blobIdString);
      const rawBlobId = blobIdFromInt(blobIdBigInt);
      const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
      const directUrl = `${AGGREGATOR}/v1/blobs/by-quilt-id/${rawBlobId}/${fileName}`;
      
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const imageBlob = await res.blob();
      const imageBlobArray = new Uint8Array(await imageBlob.arrayBuffer());
      
      const sessionKey = await SessionKey.create({
          address: currentAccount?.address || '',
          packageId: package_id,
          ttlMin: 10,
          suiClient: new SuiClient({ url: getFullnodeUrl('testnet') }),
      });

      const message = sessionKey.getPersonalMessage();
      const { signature } = await signPersonalMessage({ message });
      sessionKey.setPersonalMessageSignature(signature);

      const tx = new Transaction();
      const idBytes = fromHex("0x1");
      const moduleName = "client_decryption";
      
      const objectId = blobData?.id?.id || 
                       (owned as any)?.data?.content?.fields?.value?.id?.id ||
                       recordFields?.id?.id;
      
      if (!objectId) throw new Error("Could not find object ID for seal_approve");
      
      tx.moveCall({
        target: `${package_id}::${moduleName}::seal_approve`,
        arguments: [tx.pure.vector("u8", idBytes), tx.object(objectId)]
      });
      
      const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
      const decryptedBytes = await sealClient.decrypt({ data: imageBlobArray, sessionKey, txBytes });
      
      const decryptedData = new Uint8Array(decryptedBytes.buffer || decryptedBytes);
      const finalData = Uint8Array.from(decryptedData);
      const blob = new Blob([finalData], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      
      setImageUrl(url);
      setIsDecrypted(true);
    } catch (error) {
      console.error("Decryption error:", error);
      toast.error("Decryption failed", { description: String(error) });
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <>
    <Card className="overflow-hidden bg-card border border-border shadow-soft hover:shadow-lg transition-all duration-300">
      <div className="flex flex-col md:flex-row">
        {/* Thumbnail Section */}
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
                    const bodyPart = recordData?.body_parts?.[index] || recordData?.body_parts?.[0] || null;
                    if (bodyPart) {
                      return `${bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1).toLowerCase()} X-Ray`;
                    }
                    return title;
                  })()}
                </h3>
                <p className="text-sm text-muted-foreground">{date}</p>
              </div>
            </div>
            
            {recordData?.body_parts?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {recordData.body_parts.map((part: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">{part}</Badge>
                ))}
              </div>
            )}
            
            <p className="text-sm text-muted-foreground mt-2">
              Stored securely on Walrus. Decryption required to view details.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <Button 
              variant={isDecrypted ? "secondary" : "default"}
              className={!isDecrypted ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow" : ""}
              size="sm"
              onClick={handleDecrypt}
              disabled={isDecrypted || isDecrypting}
            >
              {isDecrypting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  <span className="hidden sm:inline">Decrypting...</span>
                  <span className="sm:hidden">Decrypting</span>
                </>
              ) : isDecrypted ? (
                <>
                  <Unlock className="mr-2 size-4" />
                  <span className="hidden sm:inline">View X-ray</span>
                  <span className="sm:hidden">View</span>
                </>
              ) : (
                <>
                  <Eye className="mr-2 size-4" />
                  <span className="hidden sm:inline">Decrypt & View</span>
                  <span className="sm:hidden">Decrypt</span>
                </>
              )}
            </Button>

            {/* Share Button and Logic */}
            {!isDoctorView && onShareToggle && (
              <div className="flex items-center">
                {isShared ? (
                  <PermissionSwitch 
                    onRevoke={() => onShareToggle(false)}
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowShareDialog(true);
                    }}
                    className="flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <Share2 className="size-4" />
                    <span className="hidden sm:inline font-medium">Share with Doctor</span>
                    <span className="sm:hidden font-medium">Share</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>

    {/* Share Dialog - Optimized Design */}
    <Dialog 
      open={showShareDialog} 
      onOpenChange={(open: boolean) => {
        setShowShareDialog(open);
        if (!open) {
          setDoctorAddress("");
          setAddressError(null);
          setIsSharing(false);
        }
      }}
    >
      <DialogContent className="max-w-[400px] w-[90vw] p-5 gap-4 sm:p-6 relative">
        <DialogHeader className="space-y-1.5 pr-12">
          <div className="flex items-center gap-2.5 pr-2">
            <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
              <Share2 className="size-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold sm:text-lg flex-1">
              Share with Doctor
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pl-8">
            Enter doctor's Sui wallet address to grant access
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="doctor-address" className="text-xs font-medium">
              Wallet Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="doctor-address"
              placeholder="0x..."
              value={doctorAddress}
              onChange={(e) => {
                setDoctorAddress(e.target.value);
                setAddressError(null);
              }}
              className={`font-mono text-xs h-9 ${addressError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isSharing}
              autoFocus
            />
          </div>
          
          {addressError && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 animate-in slide-in-from-top-1 duration-150">
              <X className="size-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive leading-relaxed">{addressError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareDialog(false)}
            disabled={isSharing}
            className="h-9 min-w-[80px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              const addressRegex = /^0x[a-fA-F0-9]{64}$/;
              const trimmedAddress = doctorAddress.trim();
              
              if (!trimmedAddress) {
                setAddressError("Please enter address");
                return;
              }
              if (!addressRegex.test(trimmedAddress)) {
                setAddressError("Invalid format (0x + 64 hex)");
                return;
              }
              
              setIsSharing(true);
              try {
                // Step 1: Get the XRayImages object ID for this patient
                toast.loading('Fetching patient record...');
                
                if (!currentAccount?.address) {
                  throw new Error("No wallet connected");
                }
                
                if (!patient_registry) {
                  throw new Error("Patient registry not configured");
                }
                
                const registryData = await client.getObject({
                  id: patient_registry,
                  options: { showContent: true },
                });
                
                const registryId = (registryData as any)?.data?.content?.fields?.registry?.fields?.id?.id;
                if (!registryId) {
                  throw new Error("Patient registry not found");
                }
                
                const owned = await client.getDynamicFieldObject({
                  parentId: registryId,
                  name: {
                    type: 'address',
                    value: currentAccount.address,
                  },
                });
                
                const ownedId = (owned as any)?.data?.content?.fields?.value;
                console.log('ownedId', ownedId);
                if (!ownedId) {
                  throw new Error("No patient record found");
                }
                
                if (!doctor_registry) {
                  throw new Error("Doctor registry not configured");
                }
                
                // Step 2: Create access request transaction
                toast.dismiss();
                toast.loading('Creating access request for doctor...');
                console.log('package_id', package_id);
                
                const tx = new Transaction();
                
                // Get Sui Clock object (shared object at 0x6)
                const clockObjectId = '0x6';
                
                // Call request_access_a_day which returns a ValidateRequest object
                const [validateRequest] = tx.moveCall({
                  target: `${package_id}::patient::request_access_a_day`,
                  arguments: [
                    tx.object(clockObjectId),  // Clock
                    tx.object(ownedId)         // XRayImages object
                  ]
                });
                // Call add_doctor_request to link the request to the specific doctor
                tx.moveCall({
                  target: `${package_id}::doctor::add_doctor_request`,
                  arguments: [
                    tx.object(doctor_registry),     // DoctorRegistry
                    tx.object(ownedId),            // XRayImages reference
                    validateRequest,                // ValidateRequest from previous call
                    tx.pure.address(trimmedAddress) // Doctor's address
                  ]
                });
                
                // Execute the transaction
                toast.dismiss();
                toast.loading('Submitting to blockchain...');

                // -----------------------------
                // ---- Sponsor Transaction ----
                // -----------------------------
                // 1. Setup the transaction as you did
                tx.setSender(currentAccount.address);
                tx.setGasOwner(sponsorAddress);
                const { data: coins } = await client.getCoins({
                  owner: sponsorAddress,
                  coinType: "0x2::sui::SUI"
                });
                if (coins.length === 0) throw new Error("Sponsor has no gas!");
                if (coins.length === 0) throw new Error("Sponsor has no gas!");
                tx.setGasPayment([{
                    objectId: coins[0].coinObjectId,
                    digest: coins[0].digest,
                    version: coins[0].version,
                }]);

                console.log("Transaction configured");

                // 2. Build the FULL Transaction Bytes (Remove 'onlyTransactionKind')
                // This freezes the gas coins, gas budget, and sender into the bytes.
                const txBytes = await tx.build({ client }); 

                // 3. Convert bytes back to a Transaction object for the User Wallet to sign
                // We use Transaction.from() (NOT fromKind) to preserve the gas/sponsor data.
                const sponsoredTx = Transaction.from(txBytes);

                console.log("Requesting User Signature...");

                // 4. User signs the transaction
                // The wallet will see the gasOwner is set to the sponsor and won't try to add its own coins.
                const { signature: userSignature } = await signTransaction({
                  transaction: sponsoredTx,
                });

                // 5. Sponsor signs the EXACT same bytes
                const { signature: sponsorSignature } = await sponsorKeypair.signTransaction(txBytes);

                console.log("Submitting Dual-Signed Transaction...");

                // 6. Execute
                const result = await client.executeTransactionBlock({
                    transactionBlock: txBytes, // Submit the bytes we built in step 2
                    signature: [userSignature, sponsorSignature], // Order usually doesn't matter, but having both is key
                    options: {
                        showEffects: true,
                        showObjectChanges: true,
                    }
                });
   
                // const result = await signAndExecuteTransaction({
                //   transaction: tx
                // });
                
                console.log('Access granted to doctor:', result);
                
                // Step 3: Update local state
                if (onShareToggle) {
                  await onShareToggle(true, trimmedAddress);
                }
                
                toast.dismiss();
                setShowShareDialog(false);
                setDoctorAddress("");
                setAddressError(null);
                
                toast.success("Access granted!", {
                  description: `Doctor ${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)} can access your record for 24 hours`,
                  duration: 5000,
                });
              } catch (error) {
                toast.dismiss();
                console.error("Share error:", error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                setAddressError(errorMessage);
                toast.error("Failed to grant access", { 
                  description: errorMessage,
                  duration: 5000 
                });
              } finally {
                setIsSharing(false);
              }
            }}
            disabled={isSharing}
            className="h-9 min-w-[90px]"
          >
            {isSharing ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="mr-1.5 size-3.5" />
                Share
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}