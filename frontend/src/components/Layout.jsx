import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  CreditCard,
  LogOut,
  Store,
  ClipboardList,
  Settings,
  Truck,
  Wallet,
  LineChart,
  Sun,
  Database,
  Handshake,
  Eye,
  EyeOff,
  ShieldAlert,
  Calculator as CalculatorIcon,
  Undo2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import Calculator from "./Calculator";

// Sidebar is split into 3 sections. Sections marked private are HIDDEN when the
// shop-owner toggles Privacy Mode (so farmers standing in front of the counter
// only see farmer-facing screens).
const NAV_SECTIONS = [
  {
    id: "farmer",
    title: "Farmer / Selling side",
    telugu: "రైతు వైపు",
    private: false,
    items: [
      { path: "/", icon: LayoutDashboard, label: "డాష్‌బోర్డ్", labelEn: "Dashboard" },
      { path: "/billing", icon: Receipt, label: "బిల్లింగ్", labelEn: "Billing" },
      { path: "/customers", icon: Users, label: "కస్టమర్లు", labelEn: "Customers" },
      { path: "/loans", icon: CreditCard, label: "అప్పులు", labelEn: "Loans" },
      { path: "/stock", icon: Package, label: "స్టాక్", labelEn: "Stock" },
      { path: "/reports", icon: ClipboardList, label: "రైతు నివేదిక", labelEn: "Farmer Report" },
    ],
  },
  {
    id: "mine",
    title: "My side (purchases & expenses)",
    telugu: "నా వైపు",
    private: true,
    items: [
      { path: "/purchases", icon: Truck, label: "కొనుగోళ్లు", labelEn: "Purchases" },
      { path: "/returns", icon: Undo2, label: "రిటర్న్స్", labelEn: "Returns" },
      { path: "/suppliers", icon: Handshake, label: "సప్లయర్లు", labelEn: "Suppliers" },
      { path: "/expenses", icon: Wallet, label: "ఖర్చులు", labelEn: "Expenses" },
    ],
  },
  {
    id: "overall",
    title: "Overall & System",
    telugu: "మొత్తం & వ్యవస్థ",
    private: false,
    items: [
      { path: "/day-summary", icon: Sun, label: "రోజు సారాంశం", labelEn: "Day Book" },
      { path: "/accounts", icon: LineChart, label: "ఖాతాలు", labelEn: "Accounts" },
    ],
  },
  {
    id: "system",
    title: "System",
    telugu: "సెట్టింగ్",
    private: true,
    items: [
      { path: "/data", icon: Database, label: "డేటా & బ్యాకప్", labelEn: "Data & Backup" },
      { path: "/settings", icon: Settings, label: "సెట్టింగ్‌లు", labelEn: "Settings" },
    ],
  },
];

const Layout = ({ children, user, onLogout }) => {
  // Privacy mode persisted in localStorage
  const [privacy, setPrivacy] = useState(() => {
    try { return localStorage.getItem("privacyMode") === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("privacyMode", privacy ? "1" : "0"); } catch { /* ignore */ }
  }, [privacy]);

  // Ctrl+P (or Cmd+P) toggles privacy — but only when NOT focused on an input
  useEffect(() => {
    const onKey = (e) => {
      const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (isTyping) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setPrivacy((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleSections = NAV_SECTIONS.filter((s) => !privacy || !s.private);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Shop Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-telugu font-bold text-green-800 text-sm leading-tight">
                స్వర్ణదీపిక
              </h1>
              <p className="text-xs text-slate-500 font-heading truncate">Swarna Deepika</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPrivacy((p) => !p)}
                    className={`h-8 w-8 shrink-0 ${privacy ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "text-slate-500 hover:text-green-700"}`}
                    data-testid="privacy-toggle"
                  >
                    {privacy ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {privacy ? "Privacy ON - my-side hidden" : "Privacy OFF - all sections visible"}
                  <div className="text-[10px] text-slate-400">Ctrl+Shift+P</div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {privacy && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1"
              data-testid="privacy-banner">
              <ShieldAlert className="w-3 h-3" />
              Privacy mode ON
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {visibleSections.map((section) => (
            <div key={section.id}>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-3 mb-1">
                {section.title}
                <span className="font-telugu text-slate-400 font-normal ml-1">· {section.telugu}</span>
              </p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `sidebar-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                        isActive
                          ? "active bg-green-50 text-green-800"
                          : "text-slate-600 hover:text-green-800"
                      }`
                    }
                    data-testid={`nav-${item.labelEn.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-telugu block leading-tight">{item.label}</span>
                      <span className="text-[11px] text-slate-400">{item.labelEn}</span>
                    </div>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          
          {/* Quick Calculator Tool */}
          <div className="pt-2 px-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full flex items-center justify-start gap-3 border-green-200 text-green-700 hover:bg-green-50"
                  data-testid="calculator-btn"
                >
                  <CalculatorIcon className="w-4 h-4" />
                  <div className="text-left">
                    <span className="font-telugu block leading-tight">క్యాలిక్యులేటర్</span>
                    <span className="text-[10px] text-slate-400">Calculator</span>
                  </div>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[300px] p-0 border-none bg-transparent shadow-none">
                <DialogHeader className="sr-only">
                  <DialogTitle>Calculator</DialogTitle>
                </DialogHeader>
                <Calculator />
              </DialogContent>
            </Dialog>
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-slate-700">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-slate-500 hover:text-red-600"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

export default Layout;
