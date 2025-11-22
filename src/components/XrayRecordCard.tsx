import { useState } from "react";
import { Eye, Share2, Lock, Unlock, FileText, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { decryptXrayRecord } from "../services/mockBackend";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PermissionSwitch } from "./patient/PermissionSwitch";

interface XrayRecordCardProps {
  id: string;
  title: string;
  date: string;
  isShared?: boolean; // Optional for doctor view
  isDoctorView?: boolean; // Flag to determine view mode
  onShareToggle?: (newState: boolean) => void;
}

export function XrayRecordCard({ 
  id, 
  title, 
  date, 
  isShared = false,
  isDoctorView = false,
  onShareToggle 
}: XrayRecordCardProps) {
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    try {
      // Call mock backend
      const response = await decryptXrayRecord({
        blobId: id,
        encryptedKey: "mock-encrypted-key", // In real app, this comes from record data
        requesterWallet: "0x71C...9A21", // Current user wallet
        userType: isDoctorView ? 'doctor' : 'patient'
      });

      if (response.success && response.imageUrl) {
        setImageUrl(response.imageUrl);
        setIsDecrypted(true);
      } else {
        console.error("Decryption failed:", response.error);
        // Handle error (toast, alert, etc.)
      }
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
                <h3 className="font-semibold text-lg text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{date}</p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                ID: {id}
              </Badge>
            </div>
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
