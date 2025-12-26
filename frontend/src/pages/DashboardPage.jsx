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
  Receipt
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
      title: "Today's Sales",
      titleTelugu: "ఈ రోజు అమ్మకాలు",
      value: `₹${stats?.today_sales?.toLocaleString() || 0}`,
      icon: IndianRupee,
      color: "bg-green-500",
      bgColor: "bg-green-50"
    },
    {
      title: "Cash Received",
      titleTelugu: "నగదు",
      value: `₹${stats?.today_cash?.toLocaleString() || 0}`,
      icon: TrendingUp,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50"
    },
    {
      title: "Credit Given",
      titleTelugu: "అప్పు ఇచ్చారు",
      value: `₹${stats?.today_credit?.toLocaleString() || 0}`,
      icon: CreditCard,
      color: "bg-yellow-500",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Pending Loans",
      titleTelugu: "మొత్తం బకాయి",
      value: `₹${stats?.total_pending_loans?.toLocaleString() || 0}`,
      subtext: `${stats?.pending_loan_count || 0} customers`,
      icon: CreditCard,
      color: "bg-orange-500",
      bgColor: "bg-orange-50"
    },
    {
      title: "Total Products",
      titleTelugu: "మొత్తం ఉత్పత్తులు",
      value: stats?.total_products || 0,
      icon: Package,
      color: "bg-blue-500",
      bgColor: "bg-blue-50"
    },
    {
      title: "Total Customers",
      titleTelugu: "మొత్తం కస్టమర్లు",
      value: stats?.total_customers || 0,
      icon: Users,
      color: "bg-purple-500",
      bgColor: "bg-purple-50"
    }
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          <Card key={index} className="stat-card border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.title}</p>
                  <p className="font-telugu text-xs text-slate-400">{card.titleTelugu}</p>
                  <p className="font-heading text-2xl font-bold text-slate-800 mt-2">
                    {card.value}
                  </p>
                  {card.subtext && (
                    <p className="text-xs text-slate-500 mt-1">{card.subtext}</p>
                  )}
                </div>
                <div className={`${card.bgColor} p-3 rounded-xl`}>
                  <card.icon className={`w-6 h-6 text-${card.color.replace('bg-', '')}`} style={{ color: card.color.includes('green') ? '#22c55e' : card.color.includes('yellow') ? '#eab308' : card.color.includes('orange') ? '#f97316' : card.color.includes('blue') ? '#3b82f6' : card.color.includes('purple') ? '#a855f7' : card.color.includes('emerald') ? '#10b981' : '#6b7280' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span>Low Stock Alert</span>
              <span className="font-telugu text-sm text-slate-400 font-normal ml-2">తక్కువ స్టాక్</span>
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
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="w-5 h-5 text-green-600" />
              <span>Recent Bills</span>
              <span className="font-telugu text-sm text-slate-400 font-normal ml-2">ఇటీవలి బిల్లులు</span>
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
