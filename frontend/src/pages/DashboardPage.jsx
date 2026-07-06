import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  IndianRupee, 
  CreditCard, 
  Package, 
  Users, 
  AlertTriangle,
  TrendingUp,
  Receipt,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import DrillMetricCard from "../components/DrillMetricCard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const endOfToday = () => today() + "T23:59:59";
const rupee = (n) => `₹${(n || 0).toLocaleString()}`;

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, billsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/dashboard/recent-bills`)
      ]);
      setStats(statsRes.data);
      setRecentBills(billsRes.data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Sales", titleTelugu: "ఈ రోజు అమ్మకాలు",
      value: rupee(stats?.today_sales), sub: `${stats?.total_bills_today || 0} bills`,
      icon: IndianRupee, color: "green", testid: "stat-today-sales",
      drill: {
        title: "Today's bills",
        fetcher: async () => (await axios.get(`${API}/bills`, { params: { start_date: today(), end_date: endOfToday() } })).data,
        renderRow: (b) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">#{b.bill_no} · {b.customer_name}</p>
              <p className="text-xs text-slate-500">{b.village} · {b.payment_type}</p>
            </div>
            <p className="font-semibold text-green-700 shrink-0">{rupee(b.total_amount)}</p>
          </div>
        ),
        totalKey: "total_amount", totalFormatter: rupee,
        seeAllHref: "/reports", seeAllLabel: "Open Reports",
        emptyText: "No bills today.",
      },
    },
    {
      title: "Pending Loans", titleTelugu: "మొత్తం బకాయి",
      value: rupee(stats?.total_pending_loans), sub: `${stats?.pending_loan_count || 0} customers`,
      icon: CreditCard, color: "orange", testid: "stat-pending-loans",
      drill: {
        title: "Bills with pending balance",
        fetcher: async () => (await axios.get(`${API}/loans/pending`)).data,
        renderRow: (b) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">#{b.bill_no} · {b.customer_name}</p>
              <p className="text-xs text-slate-500">{b.village}</p>
            </div>
            <p className="font-semibold text-orange-600 shrink-0">{rupee(b.balance_amount)}</p>
          </div>
        ),
        totalKey: "balance_amount", totalFormatter: rupee,
        seeAllHref: "/loans", seeAllLabel: "Open Loans",
        emptyText: "No pending loans — great!",
      },
    },
    {
      title: "Current Stock", titleTelugu: "ప్రస్తుత స్టాక్",
      value: stats?.total_products?.toLocaleString() || "0", sub: "unique items",
      icon: Package, color: "blue", testid: "stat-total-products",
      drill: {
        title: "Products in stock",
        fetcher: async () => (await axios.get(`${API}/products`)).data,
        renderRow: (p) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{p.name}</p>
              <p className="text-xs text-slate-500">Batch: {p.batch_no || "—"}</p>
            </div>
            <p className="font-semibold text-blue-700 shrink-0">{p.quantity} {p.unit}</p>
          </div>
        ),
        seeAllHref: "/stock", seeAllLabel: "Open Stock",
        emptyText: "No products yet.",
      },
    },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">
            Dashboard
          </h1>
          <p className="font-telugu text-slate-500">డాష్‌బోర్డ్</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">
            {format(new Date(), "EEEE, dd MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Stats Grid - hover any card to see the underlying data, click "Open …" to jump */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <DrillMetricCard
            key={card.testid}
            icon={card.icon}
            color={card.color}
            label={card.title}
            te={card.titleTelugu}
            value={card.value}
            sub={card.sub}
            testid={card.testid}
            drill={card.drill}
          />
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Sold Items Section */}
        <Card className="lg:col-span-1 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>Most Sold Items</span>
              <span className="font-telugu text-sm text-slate-400 font-normal ml-2">ఎక్కువగా అమ్మినవి</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.most_sold_items?.length > 0 ? (
              <div className="space-y-4">
                {stats.most_sold_items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center bg-slate-100 rounded-full text-[10px] font-bold text-slate-500">{idx+1}</span>
                        <p className="font-medium text-slate-800 truncate text-sm">{item.name}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 ml-7">Revenue: {rupee(item.total_revenue)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-600 text-sm">{item.total_qty} {item.unit || 'units'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>No sales data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span>Low Stock Alert</span>
                <span className="font-telugu text-sm text-slate-400 font-normal ml-2">తక్కువ స్టాక్</span>
              </span>
              <a href="/stock" target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-green-700 hover:text-green-800 inline-flex items-center gap-1">
                Open Stock <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.low_stock_items?.length > 0 ? (
              <div className="space-y-3">
                {stats.low_stock_items.slice(0, 5).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">Batch: {item.batch_no}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{item.quantity}</p>
                      <p className="text-xs text-slate-500">{item.unit}</p>
                    </div>
                  </div>
                ))}
                {stats.low_stock_count > 5 && (
                  <p className="text-sm text-slate-500 text-center">
                    +{stats.low_stock_count - 5} more items
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>All products are well stocked</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bills */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                <span>Recent Bills</span>
                <span className="font-telugu text-sm text-slate-400 font-normal ml-2">ఇటీవలి బిల్లులు</span>
              </span>
              <a href="/reports" target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-green-700 hover:text-green-800 inline-flex items-center gap-1">
                Open Reports <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentBills.length > 0 ? (
              <div className="space-y-3">
                {recentBills.slice(0, 5).map((bill, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-800">
                        Bill #{bill.bill_no}
                      </p>
                      <p className="text-sm text-slate-500">{bill.customer_name}</p>
                      <p className="text-xs text-slate-400">{bill.village}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">
                        ₹{bill.total_amount?.toLocaleString()}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          bill.payment_type === "cash"
                            ? "badge-cash"
                            : "badge-credit"
                        }`}
                      >
                        {bill.payment_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No bills today</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
