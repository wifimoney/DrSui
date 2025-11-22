import { useEffect, useState } from "react";
import { Eye, Share2, Lock, Unlock, FileText, Loader2 } from "lucide-react";
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
import { useCurrentAccount, useSignPersonalMessage, useSuiClient } from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { blobIdFromInt } from "@mysten/walrus";
import { SealClient, SessionKey } from "@mysten/seal";
import { Transaction } from "@mysten/sui/transactions";
import { toast } from 'sonner';

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

            {/* Share Button and Logic */}
            {!isDoctorView && onShareToggle && (
              <div className="flex items-center">
                {isShared ? (
                  <PermissionSwitch 
                    isShared={isShared}
                    onToggle={(checked) => onShareToggle(checked)}
                    onRevoke={() => onShareToggle(false)}
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      e.stopPropagation(); // Crucial to prevent parent click issues
                      setShowShareDialog(true); // This triggers the dialog
                    }}
                    className="flex items-center gap-2"
                  >
                    <Share2 className="size-4" />
                    <span>Share with Doctor</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>

    {/* Share Dialog - Rendered outside Card to ensure proper portal rendering */}
    {!isDoctorView && onShareToggle && (
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
        <DialogContent className="sm:max-w-[500px]" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              Share Record with Doctor
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2">
              Enter the doctor's Sui wallet address to grant them access to this X-ray record.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="doctor-address" className="text-sm font-medium">
                  Doctor's Wallet Address
                </Label>
                <span className="text-xs text-muted-foreground">Required</span>
              </div>
              <Input
                id="doctor-address"
                placeholder="0x..."
                value={doctorAddress}
                onChange={(e) => {
                  setDoctorAddress(e.target.value);
                  setAddressError(null);
                }}
                className={`font-mono text-sm ${addressError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                disabled={isSharing}
                autoFocus
              />
              {addressError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{addressError}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowShareDialog(false)}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const addressRegex = /^0x[a-fA-F0-9]{64}$/;
                const trimmedAddress = doctorAddress.trim();
                
                if (!trimmedAddress) {
                  setAddressError("Please enter an address");
                  return;
                }
                if (!addressRegex.test(trimmedAddress)) {
                  setAddressError("Invalid Sui address format");
                  return;
                }
                
                setIsSharing(true);
                try {
                  await onShareToggle?.(true, trimmedAddress);
                  setShowShareDialog(false);
                  setDoctorAddress("");
                  setAddressError(null);
                  toast.success("Record shared successfully!");
                } catch (error) {
                  setAddressError(String(error));
                } finally {
                  setIsSharing(false);
                }
              }}
              disabled={isSharing}
            >
              {isSharing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="mr-2 size-4" />
                  Share
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
  </>
  );
}