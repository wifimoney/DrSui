import { useState } from "react";
import { Search, Filter, MoreHorizontal, FileText, Activity, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { PatientRecordsView } from "./PatientRecordsView";
import { AddPatientModal } from "./AddPatientModal";

export function PatientsView() {
  const [selectedPatient, setSelectedPatient] = useState<{id: string, name: string} | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [visitFilter, setVisitFilter] = useState("");

  const patients = [
    {
      id: "P-2024-001",
      name: "Sarah Johnson",
      age: 45,
      gender: "Female",
      lastVisit: "Nov 20, 2025",
      condition: "Chest Pain",
      status: "Critical",
      statusColor: "bg-red-100 text-red-700 border-red-200",
    },
    {
      id: "P-2024-002",
      name: "Michael Chen",
      age: 32,
      gender: "Male",
      lastVisit: "Nov 18, 2025",
      condition: "Annual Physical",
      status: "Stable",
      statusColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    {
      id: "P-2024-003",
      name: "Emma Williams",
      age: 28,
      gender: "Female",
      lastVisit: "Nov 15, 2025",
      condition: "Knee Injury",
      status: "Recovering",
      statusColor: "bg-amber-100 text-amber-700 border-amber-200",
    },
    {
      id: "P-2024-004",
      name: "David Brown",
      age: 58,
      gender: "Male",
      lastVisit: "Nov 10, 2025",
      condition: "Hypertension",
      status: "Stable",
      statusColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    {
      id: "P-2024-005",
      name: "James Wilson",
      age: 62,
      gender: "Male",
      lastVisit: "Nov 05, 2025",
      condition: "Cardiac Arrhythmia",
      status: "Monitoring",
      statusColor: "bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      id: "P-2024-006",
      name: "Lisa Anderson",
      age: 35,
      gender: "Female",
      lastVisit: "Oct 28, 2025",
      condition: "Migraine",
      status: "Stable",
      statusColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
  ];

  const filteredPatients = patients.filter(patient => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      patient.name.toLowerCase().includes(searchLower) ||
      patient.id.toLowerCase().includes(searchLower) ||
      patient.condition.toLowerCase().includes(searchLower);

    const matchesStatus = statusFilter === "All" || patient.status === statusFilter;
    const matchesGender = genderFilter === "All" || patient.gender === genderFilter;
    
    const matchesMinAge = minAge === "" || patient.age >= parseInt(minAge);
    const matchesMaxAge = maxAge === "" || patient.age <= parseInt(maxAge);
    
    const matchesVisit = visitFilter === "" || patient.lastVisit.toLowerCase().includes(visitFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesGender && matchesMinAge && matchesMaxAge && matchesVisit;
  });

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setGenderFilter("All");
    setMinAge("");
    setMaxAge("");
    setVisitFilter("");
  };

  if (selectedPatient) {
    return (
      <PatientRecordsView 
        patientId={selectedPatient.id} 
        patientName={selectedPatient.name} 
        onBack={() => setSelectedPatient(null)} 
      />
    );
  }

  return (
    <div className="flex-1 bg-background p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">My Patients</h2>
            <p className="text-muted-foreground mt-1">Manage patient records and view histories</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant={showFilters ? "secondary" : "outline"} 
              className="gap-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="size-4" />
              Filters
            </Button>
            <Button className="bg-primary hover:bg-primary-hover text-primary-foreground shadow-glow" onClick={() => setIsAddPatientOpen(true)}>
              Add New Patient
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-muted/30 p-4 rounded-xl border border-border grid gap-4 md:grid-cols-4 animate-in fade-in slide-in-from-top-2">
             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground">Status</label>
               <select 
                 className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
               >
                 <option value="All">All Statuses</option>
                 <option value="Critical">Critical</option>
                 <option value="Stable">Stable</option>
                 <option value="Recovering">Recovering</option>
                 <option value="Monitoring">Monitoring</option>
               </select>
             </div>
             
             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground">Gender</label>
               <select 
                 className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                 value={genderFilter}
                 onChange={(e) => setGenderFilter(e.target.value)}
               >
                 <option value="All">All Genders</option>
                 <option value="Male">Male</option>
                 <option value="Female">Female</option>
               </select>
             </div>

             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground">Age Range</label>
               <div className="flex gap-2">
                 <Input 
                   placeholder="Min" 
                   className="h-9" 
                   type="number"
                   value={minAge}
                   onChange={(e) => setMinAge(e.target.value)}
                 />
                 <Input 
                   placeholder="Max" 
                   className="h-9" 
                   type="number"
                   value={maxAge}
                   onChange={(e) => setMaxAge(e.target.value)}
                 />
               </div>
             </div>

             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground">Last Visit</label>
               <Input 
                 placeholder="e.g. Nov 20" 
                 className="h-9"
                 value={visitFilter}
                 onChange={(e) => setVisitFilter(e.target.value)}
               />
             </div>

             <div className="md:col-span-4 flex justify-end pt-2">
               <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-8">
                 <X className="size-3 mr-1" /> Clear Filters
               </Button>
             </div>
          </div>
        )}

        {/* Search and Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search patients by name, ID, or condition..." 
                className="pl-10 h-12 bg-card border-border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {/* Quick Stats */}
          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Activity className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <p className="text-xl font-bold text-foreground">{filteredPatients.length}</p>
            </div>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-amber-50 rounded-lg">
              <FileText className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">New Reports</p>
              <p className="text-xl font-bold text-foreground">12</p>
            </div>
          </div>
        </div>

        {/* Patients Table */}
        <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Patient Name</TableHead>
                <TableHead>Age/Gender</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <TableRow key={patient.id} className="hover:bg-muted/50 border-border cursor-pointer">
                    <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                      {patient.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs">
                          {patient.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-foreground">{patient.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.age} / {patient.gender}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.lastVisit}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {patient.condition}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`border ${patient.statusColor} hover:${patient.statusColor}`}
                      >
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-primary hover:bg-primary/10 hover:text-primary mr-2"
                        onClick={() => setSelectedPatient({ id: patient.id, name: patient.name })}
                      >
                        View Records
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AddPatientModal 
        isOpen={isAddPatientOpen} 
        onClose={() => setIsAddPatientOpen(false)} 
      />
    </div>
  );
}
