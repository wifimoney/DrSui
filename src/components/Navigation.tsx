import { LayoutDashboard, Stethoscope } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import drSuiLogo from "../assets/drsui_symbol.png";
import { WalletButton } from "./WalletButton";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useState, useEffect } from "react";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { getFullnodeUrl } from "@mysten/sui/client";

interface NavigationProps {
  currentPage: "patient" | "upload" | "doctor";
  onNavigate: (page: "patient" | "upload" | "doctor") => void;
}

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const { language, setLanguage, t } = useLanguage();
  const currentAccount = useCurrentAccount();
  const doctor_registry = import.meta.env.VITE_DOCTOR_REGISTRY;
  const [hasDoctorCap, setHasDoctorCap] = useState<boolean>(false);

  // Check if user has doctor cap
  useEffect(() => {
    const checkDoctorCap = async () => {
      if (!currentAccount?.address || !doctor_registry) {
        setHasDoctorCap(false);
        return;
      }

      try {
        const client = new SuiJsonRpcClient({
          url: getFullnodeUrl('testnet'),
          network: 'testnet',
        });

        const registryData = await client.getObject({
          id: doctor_registry,
          options: { showContent: true },
        });

        const registryFields = (registryData as any)?.data?.content?.fields;
        const doctorCapsField = registryFields?.doctor_caps;
        const doctorCapsTableId = doctorCapsField?.fields?.id?.id;

        if (!doctorCapsTableId) {
          setHasDoctorCap(false);
          return;
        }

        const doctorCapData = await client.getDynamicFieldObject({
          parentId: doctorCapsTableId,
          name: {
            type: 'address',
            value: currentAccount.address,
          },
        });

        if ((doctorCapData as any)?.error?.code === 'dynamicFieldNotFound') {
          setHasDoctorCap(false);
        } else {
          const capId = (doctorCapData as any)?.data?.content?.fields?.value;
          setHasDoctorCap(!!capId);
        }
      } catch (error) {
        console.error('Error checking doctor cap:', error);
        setHasDoctorCap(false);
      }
    };

    checkDoctorCap();
  }, [currentAccount?.address, doctor_registry]);

  return (
    <nav className="bg-white border-b border-border px-8 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <img 
              src={drSuiLogo} 
              alt="DrSui Logo" 
              className="h-10 w-auto object-contain drop-shadow-[0_0_8px_rgba(20,184,166,0.3)] transition-all hover:drop-shadow-[0_0_12px_rgba(20,184,166,0.5)]" 
            />
            <span className="text-foreground font-semibold text-lg">DrSui</span>
          </div>
          
          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNavigate("patient")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                currentPage === "patient"
                  ? "bg-teal-50 text-primary shadow-glow"
                  : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="size-4" />
              <span>{t("nav.patient")}</span>
            </button>
            {hasDoctorCap && (
              <button
                onClick={() => onNavigate("doctor")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  currentPage === "doctor"
                    ? "bg-teal-50 text-primary shadow-glow"
                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                }`}
              >
                <Stethoscope className="size-4" />
                <span>{t("nav.doctor")}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-1 h-10 border border-border/50">
            <button
              onClick={() => setLanguage("EN")}
              className={`px-3 h-full rounded-md text-xs font-medium transition-all ${
                language === "EN"
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("FR")}
              className={`px-3 h-full rounded-md text-xs font-medium transition-all ${
                language === "FR"
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FR
            </button>
          </div>
          <WalletButton/>
          {/* <div className="flex items-center gap-3 bg-muted px-4 py-2 rounded-full">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm">
              JD
            </div>
            <span className="text-sm font-medium text-foreground">{t("nav.zkLogin")}</span>
          </div> */}
        </div>
      </div>
    </nav>
  );
}
