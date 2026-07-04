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
  Sun
} from "lucide-react";
import { Button } from "./ui/button";

const Layout = ({ children, user, onLogout }) => {
  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "డాష్‌బోర్డ్", labelEn: "Dashboard" },
    { path: "/day-summary", icon: Sun, label: "రోజు సారాంశం", labelEn: "Day Book" },
    { path: "/billing", icon: Receipt, label: "బిల్లింగ్", labelEn: "Billing" },
    { path: "/stock", icon: Package, label: "స్టాక్", labelEn: "Stock" },
    { path: "/purchases", icon: Truck, label: "కొనుగోళ్లు", labelEn: "Purchases" },
    { path: "/customers", icon: Users, label: "కస్టమర్లు", labelEn: "Customers" },
    { path: "/loans", icon: CreditCard, label: "అప్పులు", labelEn: "Loans" },
    { path: "/expenses", icon: Wallet, label: "ఖర్చులు", labelEn: "Expenses" },
    { path: "/reports", icon: ClipboardList, label: "నివేదిక", labelEn: "Reports" },
    { path: "/accounts", icon: LineChart, label: "ఖాతాలు", labelEn: "Accounts" },
    { path: "/settings", icon: Settings, label: "సెట్టింగ్‌లు", labelEn: "Settings" },
  ];

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
            <div>
              <h1 className="font-telugu font-bold text-green-800 text-sm leading-tight">
                స్వర్ణదీపిక
              </h1>
              <p className="text-xs text-slate-500 font-heading">Swarna Deepika</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                  isActive
                    ? "active bg-green-50 text-green-800"
                    : "text-slate-600 hover:text-green-800"
                }`
              }
              data-testid={`nav-${item.labelEn.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              <div>
                <span className="font-telugu block">{item.label}</span>
                <span className="text-xs text-slate-400">{item.labelEn}</span>
              </div>
            </NavLink>
          ))}
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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;
