import { useState } from "react";
import { CloudUpload } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-8 py-16">
      <Card className="bg-white border border-slate-200 rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-slate-900 mb-2">Upload Diagnostic Imaging</h2>
          <p className="text-slate-600">Securely store your medical files on Walrus</p>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 mb-6 transition-all ${
            isDragging
              ? "border-[#0D9488] bg-teal-50"
              : "border-[#0D9488] bg-white"
          }`}
        >
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-teal-50 rounded-full">
                <CloudUpload className="size-12 text-[#0D9488]" />
              </div>
              <div className="text-center">
                <p className="text-slate-900 mb-1">
                  {selectedFile ? selectedFile.name : "Drag DICOM files here"}
                </p>
                <p className="text-slate-500">or click to browse</p>
              </div>
            </div>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".dcm,.dicom"
            />
          </label>
        </div>

        {/* Input Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="scan-date" className="text-slate-700 mb-2 block">
              Date of Scan
            </Label>
            <Input
              id="scan-date"
              type="date"
              className="rounded-lg border-slate-300"
            />
          </div>

          <div>
            <Label htmlFor="body-part" className="text-slate-700 mb-2 block">
              Body Part
            </Label>
            <Input
              id="body-part"
              type="text"
              placeholder="e.g., Chest, Knee, Brain"
              className="rounded-lg border-slate-300"
            />
          </div>
        </div>

        {/* Submit Button */}
        <Button className="w-full bg-[#0D9488] hover:bg-[#0D9488]/90 text-white rounded-lg py-6">
          <CloudUpload className="size-5 mr-2" />
          Encrypt & Mint to Walrus
        </Button>
      </Card>
    </main>
  );
}
