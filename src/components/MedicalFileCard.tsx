import { Share2 } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface MedicalFileCardProps {
  icon: React.ReactNode;
  title: string;
  date: string;
}

export function MedicalFileCard({ icon, title, date }: MedicalFileCardProps) {
  return (
    <Card className="p-6 bg-card border border-border rounded-xl hover:border-primary transition-colors shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-lg">{icon}</div>
          <div>
            <h3 className="text-foreground font-medium mb-1">{title}</h3>
            <p className="text-muted-foreground text-sm">{date}</p>
          </div>
          <Badge
            variant="secondary"
            className="ml-4 bg-teal-50 text-primary border-0 rounded-full"
          >
            Sui Object
          </Badge>
        </div>
        <Button
          variant="outline"
          className="border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg"
        >
          <Share2 className="size-4 mr-2" />
          Share
        </Button>
      </div>
    </Card>
  );
}
