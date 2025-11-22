import { useState } from "react";
import { CloudUpload, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useLanguage } from "./LanguageContext";

interface UploadModalProps {
  onClose: () => void;
}

export function UploadModal({ onClose }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { t } = useLanguage();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-[600px] h-[500px] p-8 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-6" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-foreground font-semibold text-2xl mb-1">{t("upload.title")}</h2>
          <p className="text-muted-foreground">{t("upload.subtitle")}</p>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl transition-all ${
            isDragging
              ? "border-primary bg-teal-50/50"
              : "border-primary/50 bg-teal-50/30 hover:border-primary hover:bg-teal-50/50"
          }`}
          style={{ height: "200px" }}
        >
          <label htmlFor="file-upload" className="cursor-pointer h-full flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-card rounded-full shadow-sm">
                <CloudUpload className="size-10 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-foreground font-medium mb-1">
                  {selectedFile ? selectedFile.name : t("upload.dragDrop")}
                </p>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {t("upload.description")}
                </p>
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
        <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
          <div>
            <Label htmlFor="scan-date" className="text-foreground mb-2 block">
              {t("upload.dateScan")}
            </Label>
            <Input
              id="scan-date"
              type="date"
              className="rounded-lg border-input h-11"
            />
          </div>

          <div>
            <Label htmlFor="body-part" className="text-foreground mb-2 block">
              {t("upload.bodyPart")}
            </Label>
            <Select>
              <SelectTrigger className="rounded-lg border-input h-11">
                <SelectValue placeholder={t("upload.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chest">{t("body.chest")}</SelectItem>
                <SelectItem value="head">{t("body.head")}</SelectItem>
                <SelectItem value="abdomen">{t("body.abdomen")}</SelectItem>
                <SelectItem value="knee">{t("body.knee")}</SelectItem>
                <SelectItem value="hand">{t("body.hand")}</SelectItem>
                <SelectItem value="foot">{t("body.foot")}</SelectItem>
                <SelectItem value="spine">{t("body.spine")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Button */}
        <Button
          className="w-full h-12 text-primary-foreground rounded-xl bg-primary hover:bg-primary-hover shadow-glow transition-all"
        >
          <CloudUpload className="size-5 mr-2" />
          {t("upload.submit")}
        </Button>
      </div>
    </div>
  );
}
