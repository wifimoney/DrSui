import { Card } from "./ui/card";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <Card className="p-6 bg-card border border-border rounded-xl shadow-soft">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-teal-50 rounded-lg">{icon}</div>
        <div>
          <p className="text-muted-foreground text-sm font-medium mb-1 uppercase tracking-wide">{label}</p>
          <p className="text-foreground text-2xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
