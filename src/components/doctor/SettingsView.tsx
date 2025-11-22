import { useState } from "react";
import { 
  Shield, 
  Bell, 
  Key, 
  User, 
  Monitor, 
  Lock, 
  LogOut,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function SettingsView() {
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="flex-1 bg-background p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Settings</h2>
          <p className="text-muted-foreground mt-1">Manage your account preferences and security settings</p>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-6">
          
          {/* Account Section */}
          <Card className="bg-card border-border shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="size-5 text-primary" />
                </div>
                <CardTitle>Profile Information</CardTitle>
              </div>
              <CardDescription>Update your professional profile details visible to patients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input defaultValue="Dr. Jonathan Doe" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Specialty</Label>
                  <Input defaultValue="Senior Radiologist" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Hospital Affiliation</Label>
                  <Input defaultValue="Sui General Hospital" className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Medical License ID</Label>
                  <Input defaultValue="MD-8829-XJ" disabled className="bg-muted text-muted-foreground" />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security & Integration Section */}
          <Card className="bg-card border-border shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="size-5 text-blue-500" />
                </div>
                <CardTitle>Security & Integrations</CardTitle>
              </div>
              <CardDescription>Manage your Walrus storage keys and Sui network connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Walrus Config */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      Walrus Storage API Key
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">Required for accessing encrypted medical records</p>
                  </div>
                </div>
                <div className="relative">
                  <Input 
                    type={showApiKey ? "text" : "password"} 
                    defaultValue="sk_live_51Nq...92kd" 
                    className="pr-10 font-mono bg-background"
                  />
                  <button 
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Connected Wallet */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                    Sui
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Connected Wallet</p>
                    <p className="text-xs text-muted-foreground font-mono">0x71C...9A21</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preferences Section */}
          <Card className="bg-card border-border shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Bell className="size-5 text-amber-500" />
                </div>
                <CardTitle>Notifications & Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-border">
              <div className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates about new patient requests</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <Label className="text-base">High Priority Alerts</Label>
                  <p className="text-sm text-muted-foreground">Immediate notifications for critical patient updates</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">Toggle application theme</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <div className="mt-4">
            <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50">
              <LogOut className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
