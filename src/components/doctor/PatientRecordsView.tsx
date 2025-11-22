import { useState } from "react";
import { ArrowLeft, FileText, AlertCircle, User } from "lucide-react";
import { Button } from "../ui/button";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { XrayRecordCard } from "../XrayRecordCard";

interface PatientRecordsViewProps {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

export function PatientRecordsView({ patientId, patientName, onBack }: PatientRecordsViewProps) {
  // Mock records data - In a real app, this would be fetched based on patientId
  const [records] = useState([
    {
      id: "XR-2025-001",
      title: "Chest X-Ray (AP View)",
      date: "Nov 22, 2025",
      isShared: true,
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
  ]);

  const sharedRecords = records.filter(r => r.isShared);

  return (
    <div className="flex-1 bg-background p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <User className="size-6 text-primary" />
              {patientName}
            </h2>
            <p className="text-muted-foreground">Patient ID: {patientId}</p>
          </div>
        </div>

        {/* Permission Warning */}
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Access Control</AlertTitle>
          <AlertDescription className="text-amber-700">
            You are viewing encrypted records shared by the patient. Records not explicitly shared will remain locked.
          </AlertDescription>
        </Alert>

        {/* Records List */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileText className="size-5" />
            Shared Medical Records ({sharedRecords.length})
          </h3>
          
          {sharedRecords.length > 0 ? (
            sharedRecords.map((record) => (
              <XrayRecordCard
                key={record.id}
                id={record.id}
                title={record.title}
                date={record.date}
                isShared={true}
                isDoctorView={true}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground">No records have been shared with you yet.</p>
            </div>
          )}

          {/* Unshared Records (Optional - showing existence but locked) */}
          {records.filter(r => !r.isShared).length > 0 && (
            <div className="pt-8 opacity-50 grayscale pointer-events-none select-none">
               <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="size-5" />
                Locked Records (Access Denied)
              </h3>
              <div className="space-y-4">
                 {records.filter(r => !r.isShared).map((record) => (
                  <XrayRecordCard
                    key={record.id}
                    id={record.id}
                    title={record.title}
                    date={record.date}
                    isShared={false}
                    isDoctorView={true}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
