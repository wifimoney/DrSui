import { useState } from "react";
import { FileText, Database, Share2, Users, Upload } from "lucide-react";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Card } from "./components/ui/card";
import { StatCard } from "./components/StatCard";
import { MedicalFileCard } from "./components/MedicalFileCard";
import { XrayRecordCard } from "./components/XrayRecordCard";
import { Navigation } from "./components/Navigation";
import { UploadModal } from "./components/UploadModal";
import { DoctorPortal } from "./components/DoctorPortal";
import NetworkLogos from "./imports/NetworkLogos";
import walrusLogo from "figma:asset/0d79301d3b94cfc4f3db4e1ffc0849c9831d8154.png";
import { LanguageProvider, useLanguage } from "./components/LanguageContext";

function AppContent() {
  const [currentPage, setCurrentPage] = useState<"patient" | "upload" | "doctor">("patient");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  // Mock data for X-ray records from chain
  const [xrayRecords, setXrayRecords] = useState([
    {
      id: "XR-2025-001",
      title: "Chest X-Ray (AP View)",
      date: "Nov 22, 2025",
      isShared: false,
    },
    {
      id: "XR-2025-002",
      title: "Left Knee MRI",
      date: "Oct 15, 2025",
      isShared: true,
    },
    {
      id: "XR-2025-003",
      title: "Cervical Spine CT",
      date: "Sep 01, 2025",
      isShared: false,
    },
    {
      id: "LB-2025-089",
      title: "Full Body Bone Scan",
      date: "Aug 12, 2025",
      isShared: false,
    },
  ]);

  const handleNavigate = (page: "patient" | "upload" | "doctor") => {
    if (page === "upload") {
      setCurrentPage("patient");
      setShowUploadModal(true);
    } else {
      setCurrentPage(page);
      setShowUploadModal(false);
    }
  };

  const handleDecrypt = (id: string) => {
    console.log(`Decrypting record ${id}...`);
    // Logic to fetch encrypted key and decrypt content would go here
  };

  const handleShareToggle = (id: string, newState: boolean) => {
    setXrayRecords(prev => 
      prev.map(record => 
        record.id === id ? { ...record, isShared: newState } : record
      )
    );
    console.log(`Toggled share for ${id} to ${newState}`);
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
                value={xrayRecords.filter(r => r.isShared).length.toString()}
              />
            </div>

            {/* Medical Files List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">{t("patient.recordsListTitle")}</h2>
                <span className="text-sm text-muted-foreground font-mono">{t("patient.wallet")}: 0x71C...9A21</span>
              </div>
              
              {xrayRecords.map((record) => (
                <XrayRecordCard
                  key={record.id}
                  id={record.id}
                  title={record.title}
                  date={record.date}
                  isShared={record.isShared}
                  onShareToggle={(newState) => handleShareToggle(record.id, newState)}
                />
              ))}
            </div>
          </main>
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
