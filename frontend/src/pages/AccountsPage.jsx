import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  TrendingUp, TrendingDown, IndianRupee, PiggyBank, Wallet,
  ArrowDownCircle, ArrowUpCircle, Scale, ExternalLink,
  Users as UsersIcon, Store, Globe, Plus,
} from "lucide-react";
import { format } from "date-fns";
import DrillMetricCard from "../components/DrillMetricCard";
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "../components/ui/hover-card";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";
// server side filters do string <= against stored ISO date-times, so extend end date to end-of-day.
const endOfDay = (d) => (d && d.length === 10 ? `${d}T23:59:59` : d);

const AccountsPage = () => {
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [data, setData] = useState(null);
  const [seg, setSeg] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeForm, setIncomeForm] = useState({ amount: "", source: "", note: "" });
  const [savingIncome, setSavingIncome] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, segRes] = await Promise.all([
        axios.get(`${API}/reports/summary`, { params: { start_date: start, end_date: end } }),
        axios.get(`${API}/reports/accounts-segregated`, { params: { start_date: start, end_date: end } }),
      ]);
      setData(sum.data);
      setSeg(segRes.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const handleAddIncome = async () => {
    if (!incomeForm.amount || !incomeForm.source) return toast.error("Amount and source required");
    setSavingIncome(true);
    try {
      await axios.post(`${API}/incomes`, {
        ...incomeForm,
        amount: parseFloat(incomeForm.amount)
      });
      toast.success("Income logged!");
      setShowIncomeModal(false);
      setIncomeForm({ amount: "", source: "", note: "" });
      fetchSummary();
    } catch {
      toast.error("Failed to log income");
    } finally { setSavingIncome(false); }
  };

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
          <Button variant="outline" size="sm" onClick={() => setShowIncomeModal(true)} className="border-green-600 text-green-700 hover:bg-green-50">
            <Plus className="w-4 h-4 mr-1" /> Log Income
          </Button>
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

          {/* Segregated summary — Farmer side vs My side vs Overall */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="border-blue-200 bg-blue-50/50" data-testid="seg-farmer-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
                  <UsersIcon className="w-4 h-4" /> Farmer side
                  <span className="font-telugu text-xs text-blue-600 ml-1">రైతు వైపు</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <SegRow label="Sales Revenue" v={rupee(seg?.farmer_side?.sales)} sub={`${seg?.farmer_side?.bill_count || 0} bills`} />
                <SegRow label="Bill Cash/UPI" v={rupee((seg?.farmer_side?.bill_cash_in || 0) + (seg?.farmer_side?.bill_upi_in || 0))} tone="green" />
                <SegRow label="Dues Collected" v={rupee(seg?.farmer_side?.credit_recovered)} tone="emerald" />
                <div className="pt-1 border-t border-blue-100 flex justify-between items-center">
                  <span className="font-semibold text-blue-800">Total Cash In</span>
                  <span className="font-bold text-blue-800">{rupee(seg?.farmer_side?.cash_in + seg?.farmer_side?.upi_in)}</span>
                </div>
                <SegRow label="Credit given" v={rupee(seg?.farmer_side?.credit_given)} tone="yellow" />
                <a href="/reports" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 pt-1">
                  Open Farmer Report <ExternalLink className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/50" data-testid="seg-my-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                  <Store className="w-4 h-4" /> My side
                  <span className="font-telugu text-xs text-slate-500 ml-1">నా వైపు</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <SegRow label="Purchases" v={rupee(seg?.my_side?.purchases_total)} sub={`${seg?.my_side?.purchase_count || 0} entries`} />
                <SegRow label="Expenses" v={rupee(seg?.my_side?.expenses)} sub={`${seg?.my_side?.expense_count || 0} entries`} tone="red" />
                {seg?.misc_income > 0 && <SegRow label="Misc Income" v={rupee(seg?.misc_income)} tone="green" />}
                <SegRow label="Credit taken" v={rupee(seg?.my_side?.credit_taken)} tone="yellow" />
                {seg?.my_side?.purchases_by_method && Object.keys(seg.my_side.purchases_by_method).length > 0 && (
                  <div className="pt-1 border-t border-slate-200">
                    <p className="text-[10px] uppercase text-slate-400 mb-0.5">Paid by</p>
                    {Object.entries(seg.my_side.purchases_by_method).map(([m, amt]) => (
                      <SegRow key={m} label={m} v={rupee(amt)} />
                    ))}
                  </div>
                )}
                <a href="/purchases" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-slate-700 hover:text-green-700 inline-flex items-center gap-1 pt-1">
                  Open Purchases <ExternalLink className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>

            <Card className={(seg?.overall?.net || 0) >= 0 ? "border-emerald-200 bg-emerald-50/50" : "border-orange-200 bg-orange-50/50"}
              data-testid="seg-overall-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-800">
                  <Globe className="w-4 h-4" /> Overall
                  <span className="font-telugu text-xs text-emerald-600 ml-1">మొత్తం</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <SegRow label="Money in" v={rupee(seg?.overall?.money_in)} tone="green" strong />
                <SegRow label="Money out" v={rupee(seg?.overall?.money_out)} tone="red" strong />
                <div className="pt-1 border-t border-emerald-200">
                  <SegRow label="Net"
                    v={rupee(seg?.overall?.net)}
                    tone={(seg?.overall?.net || 0) >= 0 ? "green" : "red"}
                    big />
                </div>
                <a href="/day-summary" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 pt-1">
                  Open Day Book <ExternalLink className="w-3 h-3" />
                </a>
              </CardContent>
            </Card>
          </div>

          {/* Detailed breakdown cards - hover to see the underlying data, click "Open …" to jump */}
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            Detailed breakdown — hover any card to see underlying rows
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <DrillMetricCard icon={IndianRupee} color="green" label="Revenue (Sales)" te="అమ్మకాలు"
              value={rupee(profit?.revenue)} sub={`${data?.sales.count || 0} bills`} testid="metric-revenue"
              drill={{
                title: "Bills in this period",
                fetcher: async () => (await axios.get(`${API}/bills`, { params: { start_date: start, end_date: endOfDay(end) } })).data,
                renderRow: (b) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">#{b.bill_no} · {b.customer_name}</p>
                      <p className="text-xs text-slate-500">{fmtDay(b.date)} · {b.payment_type}</p>
                    </div>
                    <p className="font-semibold text-green-700 shrink-0">{rupee(b.total_amount)}</p>
                  </div>
                ),
                totalKey: "total_amount", totalFormatter: rupee,
                seeAllHref: "/reports", seeAllLabel: "Open Farmer Report",
                emptyText: "No bills in this range.",
              }}
            />

            <DrillMetricCard icon={PiggyBank} color="slate" label="Cost of Goods" te="వస్తువుల ధర"
              value={rupee(profit?.cogs)} sub="stock sold @ cost" testid="metric-cogs"
              drill={{
                title: "Items sold (COGS lines)",
                fetcher: async () => {
                  const bills = (await axios.get(`${API}/bills`, { params: { start_date: start, end_date: endOfDay(end) } })).data;
                  const prods = (await axios.get(`${API}/products/admin`)).data;
                  const costOf = Object.fromEntries(prods.map((p) => [p.id, p.purchase_price || 0]));
                  const map = {};
                  bills.forEach((b) => (b.items || []).forEach((it) => {
                    const c = (costOf[it.product_id] || 0) * (it.quantity || 0);
                    if (!c) return;
                    map[it.product_name] = (map[it.product_name] || 0) + c;
                  }));
                  return Object.entries(map)
                    .map(([name, cost]) => ({ name, cost }))
                    .sort((a, b) => b.cost - a.cost);
                },
                renderRow: (r) => (
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-slate-800">{r.name}</p>
                    <p className="font-semibold text-slate-700 shrink-0">{rupee(r.cost)}</p>
                  </div>
                ),
                totalKey: "cost", totalFormatter: rupee,
                seeAllHref: "/purchases", seeAllLabel: "Open Purchases",
                emptyText: "No cost data.",
              }}
            />

            <DrillMetricCard icon={TrendingUp} color="blue" label="Gross Profit" te="స్థూల లాభం"
              value={rupee(profit?.gross_profit)} sub="revenue − cost" testid="metric-gross"
              drill={{
                title: "How gross profit was built",
                fetcher: async () => ([
                  { k: "Revenue (bills)", v: profit?.revenue || 0 },
                  { k: "− Cost of Goods", v: -(profit?.cogs || 0) },
                  { k: "= Gross Profit", v: profit?.gross_profit || 0, bold: true },
                ]),
                renderRow: (r) => (
                  <div className={`flex items-center justify-between gap-2 ${r.bold ? "font-semibold" : ""}`}>
                    <p className="truncate text-slate-800">{r.k}</p>
                    <p className={`shrink-0 ${r.v >= 0 ? "text-green-700" : "text-red-600"}`}>{rupee(r.v)}</p>
                  </div>
                ),
                seeAllHref: "/reports", seeAllLabel: "Open Reports",
                emptyText: "No profit data.",
              }}
            />

            <DrillMetricCard icon={TrendingDown} color="red" label="Expenses" te="ఖర్చులు"
              value={rupee(data?.expenses.total)} sub={`${data?.expenses.count || 0} entries`} testid="metric-expenses"
              drill={{
                title: "Expenses in this period",
                fetcher: async () => (await axios.get(`${API}/expenses`, { params: { start_date: start, end_date: endOfDay(end) } })).data,
                renderRow: (r) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-slate-800 truncate">{r.category || "—"}</p>
                      <p className="text-xs text-slate-500 truncate">{fmtDay(r.date)} · {r.note || ""}</p>
                    </div>
                    <p className="font-semibold text-red-600 shrink-0">{rupee(r.amount)}</p>
                  </div>
                ),
                totalKey: "amount", totalFormatter: rupee,
                seeAllHref: "/expenses", seeAllLabel: "Open Expenses",
                emptyText: "No expenses recorded.",
              }}
            />

            <DrillMetricCard icon={ArrowDownCircle} color="emerald" label="Cash In" te="వచ్చిన నగదు"
              value={rupee(seg?.overall?.money_in)} sub="sales + dues + misc" testid="metric-cashin"
              drill={{
                title: "Money that came in",
                fetcher: async () => {
                  const [bills, incomes] = await Promise.all([
                    axios.get(`${API}/bills`, { params: { start_date: start, end_date: endOfDay(end) } }),
                    axios.get(`${API}/incomes`, { params: { start_date: start, end_date: endOfDay(end) } }),
                  ]);
                  const inflow = [];
                  bills.data.forEach((b) => {
                    if ((b.paid_amount || 0) > 0)
                      inflow.push({ label: `Sale Bill #${b.bill_no}`, sub: `${b.customer_name}`, amount: b.paid_amount });
                  });
                  incomes.data.forEach((i) => {
                    inflow.push({ label: `Income: ${i.source}`, sub: i.note || "Misc", amount: i.amount });
                  });
                  return inflow.sort((a, b) => b.amount - a.amount);
                },
                renderRow: (r) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-slate-800">{r.label}</p>
                      <p className="text-xs text-slate-500 truncate">{r.sub}</p>
                    </div>
                    <p className="font-semibold text-emerald-700 shrink-0">{rupee(r.amount)}</p>
                  </div>
                ),
                totalKey: "amount", totalFormatter: rupee,
                seeAllHref: "/billing", seeAllLabel: "Open Billing",
                emptyText: "No inflow recorded.",
              }}
            />

            <DrillMetricCard icon={ArrowUpCircle} color="orange" label="Cash Out" te="వెళ్లిన నగదు"
              value={rupee(cash?.outflow)} sub="purchases + expenses" testid="metric-cashout"
              drill={{
                title: "Money that went out",
                fetcher: async () => {
                  const [pur, exp] = await Promise.all([
                    axios.get(`${API}/purchases`, { params: { start_date: start, end_date: endOfDay(end) } }),
                    axios.get(`${API}/expenses`, { params: { start_date: start, end_date: endOfDay(end) } }),
                  ]);
                  const rows = [];
                  pur.data.forEach((p) => rows.push({
                    label: `Purchase - ${p.product_name}`, sub: `${fmtDay(p.date)} · ${p.supplier || "—"}`, amount: p.total_cost || (p.purchase_price * p.quantity),
                  }));
                  exp.data.forEach((e) => rows.push({
                    label: `Expense - ${e.category}`, sub: `${fmtDay(e.date)} · ${e.note || ""}`, amount: e.amount,
                  }));
                  return rows.sort((a, b) => b.amount - a.amount);
                },
                renderRow: (r) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-slate-800">{r.label}</p>
                      <p className="text-xs text-slate-500 truncate">{r.sub}</p>
                    </div>
                    <p className="font-semibold text-orange-600 shrink-0">{rupee(r.amount)}</p>
                  </div>
                ),
                totalKey: "amount", totalFormatter: rupee,
                seeAllHref: "/purchases", seeAllLabel: "Open Purchases",
                emptyText: "No outflow recorded.",
              }}
            />

            <DrillMetricCard icon={Wallet} color="blue" label="Purchases" te="కొనుగోళ్లు"
              value={rupee(data?.purchases.total)} sub={`${data?.purchases.count || 0} entries`} testid="metric-purchases"
              drill={{
                title: "Purchases in this period",
                fetcher: async () => (await axios.get(`${API}/purchases`, { params: { start_date: start, end_date: endOfDay(end) } })).data,
                renderRow: (p) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-slate-800">{p.product_name}</p>
                      <p className="text-xs text-slate-500 truncate">{fmtDay(p.date)} · {p.supplier || "—"} · qty {p.quantity}</p>
                    </div>
                    <p className="font-semibold text-blue-700 shrink-0">{rupee(p.total_cost || (p.purchase_price * p.quantity))}</p>
                  </div>
                ),
                totalKey: "total_cost", totalFormatter: rupee,
                seeAllHref: "/purchases", seeAllLabel: "Open Purchases",
                emptyText: "No purchases in this range.",
              }}
            />

            <DrillMetricCard icon={IndianRupee} color="yellow" label="Credit Given" te="అప్పు ఇచ్చినది"
              value={rupee(data?.sales.credit_given)} sub="unpaid this period" testid="metric-credit"
              drill={{
                title: "Credit issued in this period",
                fetcher: async () => {
                  const bills = (await axios.get(`${API}/bills`, { params: { start_date: start, end_date: endOfDay(end) } })).data;
                  return bills.filter((b) => (b.balance_amount || 0) > 0);
                },
                renderRow: (b) => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">#{b.bill_no} · {b.customer_name}</p>
                      <p className="text-xs text-slate-500">{fmtDay(b.date)} · balance</p>
                    </div>
                    <p className="font-semibold text-yellow-700 shrink-0">{rupee(b.balance_amount)}</p>
                  </div>
                ),
                totalKey: "balance_amount", totalFormatter: rupee,
                seeAllHref: "/loans", seeAllLabel: "Open Loans",
                emptyText: "No credit issued in this range.",
              }}
            />
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

            {/* Expenses by category (rows are hover-drill; click category to open the Expenses page filtered mentally) */}
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
                      <CategoryDrillRow key={i} c={c} start={start} end={end} rupee={rupee} fmtDay={fmtDay} idx={i} />
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

      {/* Log Income Modal */}
      <Dialog open={showIncomeModal} onOpenChange={setShowIncomeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Miscellaneous Income (Cash In)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (₹) *</Label>
              <Input type="number" value={incomeForm.amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div>
              <Label>Source *</Label>
              <Input value={incomeForm.source}
                onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                placeholder="e.g., Old bags sale, Commission" />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={incomeForm.note}
                onChange={(e) => setIncomeForm({ ...incomeForm, note: e.target.value })}
                placeholder="Optional details" />
            </div>
            <Button onClick={handleAddIncome} disabled={savingIncome} className="w-full bg-green-700 hover:bg-green-800">
              {savingIncome ? "Saving..." : "Log Income"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

// Row-level drill for the Expenses-by-Category card
const CategoryDrillRow = ({ c, start, end, rupee, fmtDay, idx }) => {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (rows !== null || loading) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/expenses`, { params: { start_date: start, end_date: endOfDay(end) } });
      setRows(r.data.filter((e) => (e.category || "") === c.category));
    } catch { setRows([]); } finally { setLoading(false); }
  };
  return (
    <HoverCard openDelay={150} closeDelay={80} onOpenChange={(o) => { if (o) load(); }}>
      <HoverCardTrigger asChild>
        <TableRow className="cursor-help" data-testid={`expense-cat-${idx}`}>
          <TableCell>{c.category}</TableCell>
          <TableCell className="text-right font-medium text-red-600">{rupee(c.amount)}</TableCell>
        </TableRow>
      </HoverCardTrigger>
      <HoverCardContent side="left" align="start" className="w-96 max-w-[95vw] p-0">
        <div className="p-3 border-b border-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-400">{c.category} — items</p>
          <p className="font-heading text-lg font-bold text-slate-800">{rupee(c.amount)}</p>
        </div>
        <div className="max-h-72 overflow-auto">
          {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
          {!loading && rows && rows.length === 0 && (
            <div className="p-4 text-sm text-slate-400 text-center">No entries.</div>
          )}
          {!loading && rows && rows.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {rows.slice(0, 8).map((r) => (
                <li key={r.id} className="px-3 py-2 text-sm flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-slate-800">{r.note || "—"}</p>
                    <p className="text-xs text-slate-500">{fmtDay(r.date)}</p>
                  </div>
                  <p className="font-semibold text-red-600 shrink-0">{rupee(r.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {rows && `${Math.min(rows.length, 8)} of ${rows.length}`}
          </span>
          <a href="/expenses" target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-green-700 hover:text-green-800 inline-flex items-center gap-1">
            Open Expenses <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default AccountsPage;

// Small helper for segregated summary rows
const SegRow = ({ label, v, sub, tone, strong, big }) => {
  const toneCls = tone === "green" ? "text-emerald-700"
    : tone === "red" ? "text-red-600"
    : tone === "yellow" ? "text-yellow-700"
    : "text-slate-800";
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span className="text-slate-600 capitalize">{label}</span>
        {sub && <span className="text-[10px] text-slate-400 ml-1">({sub})</span>}
      </div>
      <span className={`${toneCls} ${strong || big ? "font-semibold" : ""} ${big ? "text-base" : ""}`}>{v}</span>
    </div>
  );
};
