import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Banknote, Smartphone, HandCoins, Wallet, TrendingUp, TrendingDown,
  AlertTriangle, PackageX, CalendarClock, ArrowUpRight, ArrowDownLeft, Landmark,
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const rupee = (n) => `₹${(n || 0).toLocaleString()}`;

const DaySummaryPage = () => {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/reports/day-summary`, { params: { date } });
      setData(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cf = data?.cash_flow;
  const growth = data?.growth;
  const alerts = data?.alerts;
  const growthPositive = (growth?.mom_growth_pct || 0) >= 0;

  return (
    <div className="p-6" data-testid="day-summary-page">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Day Book — Business Health</h1>
          <p className="font-telugu text-slate-500">రోజు సారాంశం</p>
        </div>
        <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
          className="w-44" data-testid="day-summary-date" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Today's Cash Flow */}
          <div>
            <h2 className="text-sm font-semibold text-slate-600 mb-3">Today's Cash Flow <span className="font-telugu text-slate-400">(నేటి నగదు)</span></h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FlowCard icon={Banknote} color="green" label="Cash Collected" te="నగదు" value={rupee(cf?.cash_collected)} testid="cash-collected" />
              <FlowCard icon={Smartphone} color="blue" label="UPI Collected" te="యూపీఐ" value={rupee(cf?.upi_collected)} testid="upi-collected" />
              <FlowCard icon={HandCoins} color="orange" label="Hamali Payouts" te="హమాలీ" value={rupee(cf?.hamali_payouts)} testid="hamali-payouts" />
              <Card className="bg-green-700 text-white" data-testid="drawer-cash">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-green-100">Expected Cash in Drawer</p>
                      <p className="font-telugu text-[11px] text-green-200">డ్రాయర్‌లో నగదు</p>
                    </div>
                  </div>
                  <p className="font-heading text-2xl font-bold">{rupee(cf?.expected_drawer_cash)}</p>
                  <p className="text-[11px] text-green-100 mt-0.5">cash collected − cash expenses</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Khata + Growth */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Khata (Credit) Today <span className="font-telugu text-sm text-slate-400">(అప్పు)</span></CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-red-50">
                  <div className="flex items-center gap-2 text-red-600 mb-1"><ArrowUpRight className="w-4 h-4" /><span className="text-xs">Issued Today</span></div>
                  <p className="font-heading text-xl font-bold text-red-600" data-testid="khata-issued">{rupee(data?.khata.issued_today)}</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50">
                  <div className="flex items-center gap-2 text-green-600 mb-1"><ArrowDownLeft className="w-4 h-4" /><span className="text-xs">Recovered Today</span></div>
                  <p className="font-heading text-xl font-bold text-green-600" data-testid="khata-recovered">{rupee(data?.khata.recovered_today)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Business Growth <span className="font-telugu text-sm text-slate-400">(వృద్ధి)</span></CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${growthPositive ? "bg-emerald-50" : "bg-red-50"}`}>
                  <div className={`flex items-center gap-2 mb-1 ${growthPositive ? "text-emerald-600" : "text-red-600"}`}>
                    {growthPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span className="text-xs">Month-over-Month</span>
                  </div>
                  <p className={`font-heading text-xl font-bold ${growthPositive ? "text-emerald-600" : "text-red-600"}`} data-testid="mom-growth">
                    {growthPositive ? "+" : ""}{growth?.mom_growth_pct}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{rupee(growth?.this_month_sales)} vs {rupee(growth?.prev_month_sales)}</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-50">
                  <div className="flex items-center gap-2 text-yellow-700 mb-1"><Landmark className="w-4 h-4" /><span className="text-xs">Outstanding Market Credit</span></div>
                  <p className="font-heading text-xl font-bold text-yellow-700" data-testid="outstanding-credit">{rupee(growth?.outstanding_market_credit)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">money locked in the market</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stock Movement + Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top Moving Items Today <span className="font-telugu text-sm text-slate-400">(అమ్మకాలు)</span></CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.top_items.map((it, i) => (
                      <TableRow key={i} data-testid={`top-item-${i}`}>
                        <TableCell>{it.product_name}</TableCell>
                        <TableCell className="text-right font-semibold">{it.quantity} {it.unit}</TableCell>
                        <TableCell className="text-right">{rupee(it.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!data?.top_items || data.top_items.length === 0) && (
                  <div className="text-center py-10 text-slate-400"><p>No sales today</p></div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Smart Alerts
                  <span className="font-telugu text-sm text-slate-400">(హెచ్చరికలు)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 text-red-600">
                    <CalendarClock className="w-4 h-4" />
                    <span className="text-sm font-medium">Expiring within 60 days</span>
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100" data-testid="expiring-count">{alerts?.expiring_count || 0}</Badge>
                  </div>
                  {alerts?.expiring?.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {alerts.expiring.map((e, i) => (
                        <div key={i} className="flex justify-between text-sm bg-red-50 rounded px-3 py-1.5" data-testid={`expiring-${i}`}>
                          <span>{e.name} <span className="text-slate-400">({e.quantity} {e.unit})</span></span>
                          <span className="text-red-600 font-medium">{e.days_left}d left</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-400">Nothing expiring soon 👍</p>}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2 text-orange-600">
                    <PackageX className="w-4 h-4" />
                    <span className="text-sm font-medium">Low stock (below 10)</span>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100" data-testid="lowstock-count">{alerts?.low_stock_count || 0}</Badge>
                  </div>
                  {alerts?.low_stock?.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {alerts.low_stock.map((s, i) => (
                        <div key={i} className="flex justify-between text-sm bg-orange-50 rounded px-3 py-1.5" data-testid={`lowstock-${i}`}>
                          <span>{s.name}</span>
                          <span className="text-orange-600 font-medium">{s.quantity} {s.unit} left</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-400">Stock levels healthy 👍</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

const colorMap = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  orange: "bg-orange-100 text-orange-700",
};

const FlowCard = ({ icon: Icon, color, label, te, value, testid }) => (
  <Card data-testid={testid}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="font-telugu text-[11px] text-slate-400">{te}</p>
        </div>
      </div>
      <p className="font-heading text-2xl font-bold text-slate-800">{value}</p>
    </CardContent>
  </Card>
);

export default DaySummaryPage;
