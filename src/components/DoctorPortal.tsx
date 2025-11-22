import { useState } from "react";
import { Inbox, Users, Settings, ZoomIn, Contrast, Ruler, Lock, Unlock } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { PatientsView } from "./doctor/PatientsView";
import { SettingsView } from "./doctor/SettingsView";
import { AuditTrailWidget } from "./doctor/AuditTrailWidget";
import { GhostAnnotationOverlay } from "./doctor/GhostAnnotationOverlay";
import { RequestAccessToast } from "./doctor/RequestAccessToast";
import { useLanguage } from "./LanguageContext";

export function DoctorPortal() {
  const [activeNav, setActiveNav] = useState("inbox");
  const [selectedRequest, setSelectedRequest] = useState(0);
  const [decryptedIds, setDecryptedIds] = useState<number[]>([]);
  const [isDecrypting, setIsDecrypting] = useState<number | null>(null);
  const [showRequestToast, setShowRequestToast] = useState(true);
  const { t } = useLanguage();

  const doctorProfile = {
    name: "Dr. Jonathan Doe",
    initials: "JD",
    id: "MD-8829-XJ",
    specialty: t("doctor.profile.specialty"),
    hospital: "Sui General Hospital"
  };

  const [incomingRequests, setIncomingRequests] = useState([
    {
      id: 1,
      name: "Sarah Johnson",
      initials: "SJ",
      condition: "Chest Pain",
      timestamp: "2 hours ago",
    },
    {
      id: 2,
      name: "Michael Chen",
      initials: "MC",
      condition: "Follow-up X-Ray",
      timestamp: "5 hours ago",
    },
    {
      id: 3,
      name: "Emma Williams",
      initials: "EW",
      condition: "Knee Injury",
      timestamp: "1 day ago",
    },
    {
      id: 4,
      name: "David Brown",
      initials: "DB",
      condition: "Annual Check",
      timestamp: "2 days ago",
    },
  ]);

  const handleAcceptRequest = () => {
    const newRequest = {
      id: incomingRequests.length + 1,
      name: "John Doe",
      initials: "JD",
      condition: "New Record Shared",
      timestamp: "Just now",
    };
    setIncomingRequests(prev => [newRequest, ...prev]);
    setShowRequestToast(false);
  };

  const handleDeclineRequest = () => {
    setShowRequestToast(false);
  };

  const patientData = {
    name: "Sarah Johnson",
    age: "45",
    studyDate: "Nov 20, 2025",
    modality: "X-Ray",
    bodyPart: "Chest",
    institution: "City General Hospital",
  };

  const handleDecrypt = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDecrypting) return;

    setIsDecrypting(id);
    
    // Simulate network request to /decrypt
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setDecryptedIds(prev => [...prev, id]);
    } finally {
      setIsDecrypting(null);
    }
  };

  const isDecrypted = (id: number) => decryptedIds.includes(id);

  return (
    <div className="flex h-full min-h-[600px] relative">
      {showRequestToast && (
        <RequestAccessToast 
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
        />
      )}
      {/* Left Sidebar Navigation */}
      <aside className="w-72 bg-sidebar flex flex-col text-sidebar-foreground border-r border-sidebar-border shrink-0 transition-all duration-300">
        {/* Doctor Profile Section */}
        <div className="p-6 border-b border-sidebar-border bg-sidebar-accent/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-glow">
              {doctorProfile.initials}
            </div>
            <div>
              <h3 className="font-semibold text-sidebar-foreground text-sm">{doctorProfile.name}</h3>
              <p className="text-xs text-primary font-medium">{doctorProfile.specialty}</p>
            </div>
          </div>
          <div className="space-y-2 bg-sidebar-accent/50 p-3 rounded-lg border border-sidebar-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground uppercase tracking-wider font-medium">{t("doctor.profile.id")}</span>
              <span className="text-sidebar-foreground font-mono bg-sidebar-accent px-1.5 rounded">{doctorProfile.id}</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span className="text-muted-foreground uppercase tracking-wider font-medium">{t("doctor.profile.hospital")}</span>
              <span className="text-sidebar-foreground text-right truncate ml-2">{doctorProfile.hospital}</span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveNav("inbox")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "inbox"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Inbox className="size-5" />
            <span className="font-medium text-sm">{t("doctor.nav.inbox")}</span>
          </button>
          <button
            onClick={() => setActiveNav("patients")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "patients"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Users className="size-5" />
            <span className="font-medium text-sm">{t("doctor.nav.patients")}</span>
          </button>
          <button
            onClick={() => setActiveNav("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeNav === "settings"
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground"
            }`}
          >
            <Settings className="size-5" />
            <span className="font-medium text-sm">{t("doctor.nav.settings")}</span>
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <AuditTrailWidget />
        </div>
      </aside>

      {/* Main Content Area */}
      {activeNav === "patients" ? (
        <PatientsView />
      ) : activeNav === "settings" ? (
        <SettingsView />
      ) : (
        <div className="flex-1 flex">
          {/* Left Column - Incoming Requests */}
          <div className="w-96 bg-card border-r border-border overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-foreground font-semibold text-xl">{t("doctor.incoming.title")}</h2>
              <p className="text-muted-foreground mt-1">
                {incomingRequests.length} {t("doctor.incoming.pending")}
              </p>
            </div>

            <div className="divide-y divide-border">
              {incomingRequests.map((request, index) => {
                const decrypted = isDecrypted(request.id);
                return (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(index)}
                    className={`p-6 cursor-pointer transition-colors ${
                      selectedRequest === index
                        ? "bg-muted"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="size-12 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0">
                        {request.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-foreground font-medium">{request.name}</h3>
                          {decrypted && (
                            <Unlock className="size-3 text-primary" />
                          )}
                        </div>
                        <p className="text-muted-foreground mb-2">{request.condition}</p>
                        <p className="text-muted-foreground text-sm">{request.timestamp}</p>
                      </div>
                    </div>
                    <Button
                      className={`w-full mt-4 shadow-sm transition-all ${
                        decrypted 
                          ? "bg-teal-50 text-primary border border-teal-100 hover:bg-teal-100" 
                          : "bg-primary hover:bg-primary-hover text-primary-foreground"
                      }`}
                      onClick={(e) => handleDecrypt(request.id, e)}
                      disabled={decrypted || isDecrypting === request.id}
                    >
                      {isDecrypting === request.id ? (
                        <span className="flex items-center gap-2">
                          <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          {t("doctor.action.decrypting")}
                        </span>
                      ) : decrypted ? (
                        <span className="flex items-center gap-2">
                          <Unlock className="size-4" />
                          {t("doctor.status.decrypted")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Lock className="size-4" />
                          {t("doctor.action.decrypt")}
                        </span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Patient Detail View */}
          <div className="flex-1 bg-background overflow-y-auto p-8">
            <div className="max-w-4xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-foreground font-bold text-3xl">
                  {incomingRequests[selectedRequest].name}
                </h2>
                {!isDecrypted(incomingRequests[selectedRequest].id) && (
                   <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                     <Lock className="size-3" />
                     {t("doctor.status.encrypted")}
                   </div>
                )}
              </div>

              {/* X-Ray Image Placeholder */}
              <Card className="bg-black/90 border-border rounded-lg mb-6 overflow-hidden shadow-soft relative group">
                {!isDecrypted(incomingRequests[selectedRequest].id) && (
                  <div className="absolute inset-0 z-20 backdrop-blur-md bg-background/10 flex flex-col items-center justify-center text-center p-6">
                    <div className="bg-background/80 p-4 rounded-full mb-4 shadow-lg">
                      <Lock className="size-8 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-medium max-w-md">
                      {t("doctor.viewer.encryptedMessage")}
                    </p>
                    <Button 
                      className="mt-6"
                      onClick={(e) => handleDecrypt(incomingRequests[selectedRequest].id, e)}
                      disabled={isDecrypting === incomingRequests[selectedRequest].id}
                    >
                      {isDecrypting === incomingRequests[selectedRequest].id ? t("doctor.action.decrypting") : t("doctor.action.decrypt")}
                    </Button>
                  </div>
                )}
                
                <div className={`aspect-[4/3] flex items-center justify-center relative transition-all duration-500 ${
                  !isDecrypted(incomingRequests[selectedRequest].id) ? "blur-sm opacity-50" : "blur-0 opacity-100"
                }`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-muted/20 to-background" />
                  <div className="relative text-muted-foreground font-medium">
                    {t("doctor.viewer.placeholder")}
                  </div>
                  {isDecrypted(incomingRequests[selectedRequest].id) && <GhostAnnotationOverlay />}
                </div>
                {/* Tool Icons Row */}
                <div className="bg-card p-4 flex items-center gap-2 border-t border-border relative z-10">
                  <button className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <ZoomIn className="size-5" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Contrast className="size-5" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
                    <Ruler className="size-5" />
                  </button>
                </div>
              </Card>

              {/* Metadata Section */}
              <Card className="bg-card border-border rounded-lg p-6 shadow-soft relative overflow-hidden">
                {!isDecrypted(incomingRequests[selectedRequest].id) && (
                   <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-background/50 flex items-center justify-center">
                     <Lock className="size-6 text-muted-foreground/50" />
                   </div>
                )}
                <h3 className="text-foreground font-semibold text-lg mb-4">{t("doctor.metadata.title")}</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      {t("doctor.metadata.name")}
                    </Label>
                    <p className="text-foreground font-medium">
                      {isDecrypted(incomingRequests[selectedRequest].id) ? patientData.name : "********"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">{t("doctor.metadata.age")}</Label>
                    <p className="text-foreground font-medium">
                      {isDecrypted(incomingRequests[selectedRequest].id) ? patientData.age : "**"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      {t("doctor.metadata.studyDate")}
                    </Label>
                    <p className="text-foreground font-medium">{patientData.studyDate}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">{t("doctor.metadata.modality")}</Label>
                    <p className="text-foreground font-medium">{patientData.modality}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">{t("doctor.metadata.bodyPart")}</Label>
                    <p className="text-foreground font-medium">{patientData.bodyPart}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide mb-1 block">
                      {t("doctor.metadata.institution")}
                    </Label>
                    <p className="text-foreground font-medium">{patientData.institution}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
