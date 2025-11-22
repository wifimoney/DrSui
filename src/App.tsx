import { useState, useEffect } from "react";
import { FileText, Database, Users, Upload, Wallet, Lock } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { StatCard } from "./components/StatCard";
import { XrayRecordCard } from "./components/XrayRecordCard";
import { Navigation } from "./components/Navigation";
import { UploadModal } from "./components/UploadModal";
import { DoctorPortal } from "./components/DoctorPortal";
import NetworkLogos from "./imports/NetworkLogos";
import walrusLogo from "./assets/0d79301d3b94cfc4f3db4e1ffc0849c9831d8154.png";
import { LanguageProvider, useLanguage } from "./components/LanguageContext";
import { useCurrentAccount, ConnectModal } from "@mysten/dapp-kit";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl } from "@mysten/sui/client";

function AppContent() {
  const [currentPage, setCurrentPage] = useState<"patient" | "upload" | "doctor">("patient");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { t } = useLanguage();
  const account = useCurrentAccount();
  const patient_registry = import.meta.env.VITE_PATIENT_REGISTRY;
  const client = new SuiJsonRpcClient({
    url: getFullnodeUrl('testnet'),
    network: 'testnet',
  });

  // X-ray records from chain
  const [xrayRecords, setXrayRecords] = useState<Array<{
    id: string;
    blobId?: string;
    title: string;
    date: string;
    isShared: boolean;
  }>>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  // Fetch patient records from blockchain
  useEffect(() => {
    console.log("useEffect called in AppContent");
    const fetchPatientRecords = async () => {
      if (!account?.address || !patient_registry) return;

      setIsLoadingRecords(true);
      try {
        const data = await client.getObject({
          id: patient_registry,
          options: {
            showContent: true,
          },
        });
        console.log('Patient registry data:', data);
        const registryId = (data as any)?.data?.content?.fields?.registry?.fields?.id?.id;
        console.log('Registry ID:', registryId);
        if (registryId) {
          const owned = await client.getDynamicFieldObject({
            parentId: registryId,
            name: {
              type: 'address',
              value: account.address,
    },
          });
          console.log('Owned:', owned);
          
          // Check if dynamic field was not found (user hasn't registered yet)
          if ((owned as any)?.error?.code === 'dynamicFieldNotFound') {
            console.log('User has not registered yet - no records found');
            setXrayRecords([]);
            setIsLoadingRecords(false);
            return;
          }
          
          const ownedId = (owned as any)?.data?.content?.fields?.value;
          if (!ownedId) {
            console.log('No owned ID found');
            setXrayRecords([]);
            setIsLoadingRecords(false);
            return;
          }
          
          const objectData = await client.getObject({
            id: ownedId,
            options: {
              showContent: true,
    },
          });
          console.log('Object data:', objectData);
          const recordFields = (objectData as any)?.data?.content?.fields;

          console.log('Record fields:', recordFields);
          if (recordFields) {

            const blobs = recordFields.blob || [];
            const bodyParts = recordFields.body_parts || [];
            console.log('Blobs:', blobs);
            console.log('Body parts:', bodyParts);
            // Create records based on body_parts array length
            const records = bodyParts.map((bodyPart: string, index: number) => {
              const blob = blobs[index];
              console.log('Blob:', blob);
              
              // Extract blob_id from the blob structure
              // Blob structure: { fields: { blob_id: "...", id: { id: "..." } } }
              const blobId = blob?.fields?.blob_id || 
                            blob?.fields?.id?.id || 
                            blob?.id?.id || 
                            blob?.objectId || 
                            `BLOB-${index}`;
              const blobObjectId = blob?.fields?.id?.id || blob?.id?.id || blobId;
              
              console.log('Blob ID (blob_id):', blobId);
              console.log('Blob Object ID:', blobObjectId);
              
              // Format date (you might want to get this from blob metadata if available)
              const date = new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              });

              // Capitalize body part properly
              const bodyPartCapitalized = bodyPart 
                ? bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1).toLowerCase()
                : 'Unknown';

              return {
                id: blobObjectId, // Use object ID for the record ID
                blobId: blobId, // Store blob_id separately if needed
                title: `${bodyPartCapitalized} X-Ray`,
                date: date,
                isShared: false, // You might want to check this from chain data
              };
            });

            setXrayRecords(records);
            console.log('Fetched records:', records);
            console.log('Body parts count:', bodyParts.length);
          }
        }
      } catch (error) {
        console.error('Error fetching patient records:', error);
        // Keep empty array on error
        setXrayRecords([]);
      } finally {
        setIsLoadingRecords(false);
      }
    };

    fetchPatientRecords();
  }, [account?.address, patient_registry]);

  const handleNavigate = (page: "patient" | "upload" | "doctor") => {
    if (page === "upload") {
      setCurrentPage("patient");
      setShowUploadModal(true);
    } else {
      setCurrentPage(page);
      setShowUploadModal(false);
    }
  };

  const handleShareToggle = (id: string, newState: boolean, doctorAddress?: string) => {
    setXrayRecords((prev: typeof xrayRecords) => 
      prev.map((record: typeof xrayRecords[0]) => 
        record.id === id ? { ...record, isShared: newState } : record
      )
    );
    if (newState && doctorAddress) {
      console.log(`Sharing record ${id} with doctor at address: ${doctorAddress}`);
      // TODO: Implement actual sharing logic with the doctor's address
      // This could involve calling a Move function to grant access to the doctor
    } else {
    console.log(`Toggled share for ${id} to ${newState}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <Navigation 
        currentPage={currentPage} 
        onNavigate={handleNavigate} 
      />

      {/* Conditional Page Rendering */}
      <div className="flex-1 flex flex-col">
        {currentPage === "patient" ? (
          !account ? (
            // Wallet Not Connected Screen
            <main className="flex-1 flex items-center justify-center px-8 py-12">
              <Card className="max-w-md w-full p-8 text-center border-border shadow-lg">
                <div className="flex flex-col items-center gap-6">
                  <div className="size-20 rounded-full bg-muted/20 flex items-center justify-center">
                    <Lock className="size-10 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">Wallet Not Connected</h2>
                    <p className="text-muted-foreground">
                      Please connect your wallet to access your medical records and manage your health data securely.
                    </p>
                  </div>
                  <ConnectModal
                    trigger={
                      <Button 
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow px-8 gap-2"
                      >
                        <Wallet className="size-5" />
                        Connect Wallet
                      </Button>
                    }
                  />
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Your data is encrypted and stored securely on the Sui blockchain using Walrus.
                    </p>
                  </div>
                </div>
              </Card>
            </main>
          ) : (
            // Patient Dashboard (Wallet Connected)
          <main className="max-w-5xl mx-auto px-8 py-12 w-full">
            {/* Header Section */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-foreground text-3xl font-bold tracking-tight mb-2">{t("patient.title")}</h1>
                <p className="text-muted-foreground">{t("patient.subtitle")}</p>
              </div>
              <Button 
                onClick={() => setShowUploadModal(true)} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
              >
                <Upload className="mr-2 size-4" />
                {t("patient.upload")}
              </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatCard
                icon={<FileText className="size-6 text-primary" />}
                label={t("patient.totalRecords")}
                value={xrayRecords.length.toString()}
              />
              <StatCard
                icon={<Database className="size-6 text-primary" />}
                label={t("patient.storageUsed")}
                value="2.4 GB"
              />
              <StatCard
                icon={<Users className="size-6 text-primary" />}
                label={t("patient.activeShares")}
                  value={xrayRecords.filter((r: typeof xrayRecords[0]) => r.isShared).length.toString()}
              />
            </div>

            {/* Medical Files List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">{t("patient.recordsListTitle")}</h2>
                  <span className="text-sm text-muted-foreground font-mono">
                    {t("patient.wallet")}: {account.address.slice(0, 6)}...{account.address.slice(-4)}
                  </span>
              </div>
              
                {isLoadingRecords ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading records...
                  </div>
                ) : xrayRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No records found. Upload your first X-ray to get started.
                  </div>
                ) : (
                  <>
                    {xrayRecords.map((record: typeof xrayRecords[0], index: number) => (
                <XrayRecordCard
                  key={record.id}
                  id={record.id}
                  title={record.title}
                  date={record.date}
                  isShared={record.isShared}
                        onShareToggle={(newState, doctorAddress) => handleShareToggle(record.id, newState, doctorAddress)}
                        index={index}
                />
              ))}
                  </>
                )}
            </div>
          </main>
          )
        ) : (
          <DoctorPortal />
        )}
      </div>

      {/* Footer with Powered by Sui and Walrus */}
      <footer className="border-t border-border py-8 bg-card/50 backdrop-blur-sm mt-auto">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-center gap-12">
          {/* Sui Section */}
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("footer.poweredBy")}</p>
            <div className="h-8 flex items-center">
               <NetworkLogos />
            </div>
          </div>

          {/* Divider for larger screens */}
          <div className="hidden md:block h-12 w-px bg-border" />

          {/* Walrus Section */}
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("footer.poweredBy")}</p>
            <div className="flex items-center gap-3 h-8">
               <img src={walrusLogo} alt="Walrus" className="h-full w-auto object-contain" />
               <span className="font-bold text-xl tracking-tight text-foreground">Walrus</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Upload Modal Overlay */}
      {showUploadModal && (
        <UploadModal onClose={() => setShowUploadModal(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
