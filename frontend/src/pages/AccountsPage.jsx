import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  TrendingUp, TrendingDown, IndianRupee, PiggyBank, Wallet,
  ArrowDownCircle, ArrowUpCircle, Scale,
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

const AccountsPage = () => {
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/reports/summary`, { params: { start_date: start, end_date: end } });
      setData(res.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const rupee = (n) => `₹${(n || 0).toLocaleString()}`;
  const fmtDay = (d) => { try { return format(new Date(d), "dd MMM"); } catch { return d; } };

  const setThisMonth = () => { setStart(monthStart()); setEnd(today()); };
  const setToday = () => { setStart(today()); setEnd(today()); };

  const profit = data?.profit;
  const cash = data?.cash_flow;
  const netProfitPositive = (profit?.net_profit || 0) >= 0;
  const netCashPositive = (cash?.net || 0) >= 0;

  return (
    <div className="p-6" data-testid="accounts-page">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Accounts — Cash Flow & Profit</h1>
          <p className="font-telugu text-slate-500">ఖాతాలు — నగదు & లాభం</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={setToday} data-testid="range-today-btn">Today</Button>
          <Button variant="outline" size="sm" onClick={setThisMonth} data-testid="range-month-btn">This Month</Button>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36" data-testid="accounts-start-date" />
          <span className="text-slate-400">to</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36" data-testid="accounts-end-date" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
        </div>
      ) : (
        <>
          {/* Profit / Loss headline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className={netProfitPositive ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${netProfitPositive ? "bg-green-100" : "bg-red-100"}`}>
                  {netProfitPositive ? <TrendingUp className="w-7 h-7 text-green-600" /> : <TrendingDown className="w-7 h-7 text-red-600" />}
                </div>
                <div>
                  <p className="text-sm text-slate-600">Net Profit / Loss</p>
                  <p className="font-telugu text-xs text-slate-400">నికర లాభం / నష్టం</p>
                  <p className={`font-heading text-3xl font-bold ${netProfitPositive ? "text-green-700" : "text-red-600"}`}
                    data-testid="net-profit-value">{rupee(profit?.net_profit)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className={netCashPositive ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${netCashPositive ? "bg-emerald-100" : "bg-orange-100"}`}>
                  <Scale className={`w-7 h-7 ${netCashPositive ? "text-emerald-600" : "text-orange-600"}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Net Cash Flow (In − Out)</p>
                  <p className="font-telugu text-xs text-slate-400">నికర నగదు ప్రవాహం</p>
                  <p className={`font-heading text-3xl font-bold ${netCashPositive ? "text-emerald-700" : "text-orange-600"}`}
                    data-testid="net-cash-value">{rupee(cash?.net)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard icon={IndianRupee} color="green" label="Revenue (Sales)" te="అమ్మకాలు" value={rupee(profit?.revenue)} sub={`${data?.sales.count || 0} bills`} testid="metric-revenue" />
            <MetricCard icon={PiggyBank} color="slate" label="Cost of Goods" te="వస్తువుల ధర" value={rupee(profit?.cogs)} sub="stock sold @ cost" testid="metric-cogs" />
            <MetricCard icon={TrendingUp} color="blue" label="Gross Profit" te="స్థూల లాభం" value={rupee(profit?.gross_profit)} sub="revenue − cost" testid="metric-gross" />
            <MetricCard icon={TrendingDown} color="red" label="Expenses" te="ఖర్చులు" value={rupee(data?.expenses.total)} sub={`${data?.expenses.count || 0} entries`} testid="metric-expenses" />
            <MetricCard icon={ArrowDownCircle} color="emerald" label="Cash In" te="వచ్చిన నగదు" value={rupee(cash?.inflow)} sub="sales paid + loans collected" testid="metric-cashin" />
            <MetricCard icon={ArrowUpCircle} color="orange" label="Cash Out" te="వెళ్లిన నగదు" value={rupee(cash?.outflow)} sub="purchases + expenses" testid="metric-cashout" />
            <MetricCard icon={Wallet} color="blue" label="Purchases" te="కొనుగోళ్లు" value={rupee(data?.purchases.total)} sub={`${data?.purchases.count || 0} entries`} testid="metric-purchases" />
            <MetricCard icon={IndianRupee} color="yellow" label="Credit Given" te="అప్పు ఇచ్చినది" value={rupee(data?.sales.credit_given)} sub="unpaid this period" testid="metric-credit" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Daily breakdown */}
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle className="text-base">Daily Cash Flow</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Purchases</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Net Cash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.daily.map((d) => (
                      <TableRow key={d.date} data-testid={`daily-row-${d.date}`}>
                        <TableCell className="whitespace-nowrap">{fmtDay(d.date)}</TableCell>
                        <TableCell className="text-right">{rupee(d.sales)}</TableCell>
                        <TableCell className="text-right text-blue-600">{rupee(d.purchases)}</TableCell>
                        <TableCell className="text-right text-red-500">{rupee(d.expenses)}</TableCell>
                        <TableCell className={`text-right font-semibold ${d.net_cash >= 0 ? "text-emerald-600" : "text-orange-600"}`}>{rupee(d.net_cash)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!data?.daily || data.daily.length === 0) && (
                  <div className="text-center py-12 text-slate-400"><p>No activity in this period</p></div>
                )}
              </CardContent>
            </Card>

            {/* Expenses by category */}
            <Card>
              <CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.expenses.by_category.map((c, i) => (
                      <TableRow key={i} data-testid={`expense-cat-${i}`}>
                        <TableCell>{c.category}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">{rupee(c.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!data?.expenses.by_category || data.expenses.by_category.length === 0) && (
                  <div className="text-center py-12 text-slate-400"><p className="text-sm">No expenses</p></div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const colorMap = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-600",
  yellow: "bg-yellow-100 text-yellow-700",
  slate: "bg-slate-100 text-slate-600",
};

const MetricCard = ({ icon: Icon, color, label, te, value, sub, testid }) => (
  <Card data-testid={testid}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 leading-tight">{label}</p>
          <p className="font-telugu text-[11px] text-slate-400">{te}</p>
        </div>
      </div>
      <p className="font-heading text-xl font-bold text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </CardContent>
  </Card>
);

export default AccountsPage;
