import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import {
  ClipboardList,
  IndianRupee,
  ShoppingBag,
  Wallet,
  CreditCard,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const today = () => new Date().toISOString().slice(0, 10);

const ReportsPage = () => {
  const [date, setDate] = useState(today());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/reports/daily`, { params: { date: d } });
      setReport(res.data);
    } catch (e) {
      console.error("Failed to fetch daily report:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(date);
  }, [date, fetchReport]);

  const shiftDay = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const formatTime = (dateStr) => {
    try {
      return format(new Date(dateStr), "hh:mm a");
    } catch {
      return "";
    }
  };

  const prettyDate = (() => {
    try {
      return format(new Date(date), "dd MMM yyyy (EEEE)");
    } catch {
      return date;
    }
  })();

  const exportCsv = () => {
    if (!report || report.bills.length === 0) return;
    const rows = [["Bill #", "Time", "Customer", "Village", "Items", "Total", "Paid", "Balance", "Type"]];
    report.bills.forEach((b) => {
      const items = b.items.map((it) => `${it.product_name} x${it.quantity}`).join("; ");
      rows.push([
        b.bill_no,
        formatTime(b.date),
        b.customer_name,
        b.village,
        items,
        b.total_amount,
        b.paid_amount,
        b.balance_amount,
        b.payment_type,
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-report-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = report?.summary;

  const stats = [
    { label: "Total Sales", labelTe: "మొత్తం అమ్మకం", value: `₹${(s?.total_sales || 0).toLocaleString()}`, icon: IndianRupee, color: "green" },
    { label: "Bills", labelTe: "బిల్లులు", value: s?.bill_count || 0, icon: ShoppingBag, color: "blue" },
    { label: "Cash Received", labelTe: "నగదు", value: `₹${(s?.total_paid || 0).toLocaleString()}`, icon: Wallet, color: "emerald" },
    { label: "On Credit", labelTe: "అప్పు", value: `₹${(s?.total_credit || 0).toLocaleString()}`, icon: CreditCard, color: "orange" },
  ];

  const colorMap = {
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    orange: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="p-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Daily Report</h1>
          <p className="font-telugu text-slate-500">రోజువారీ నివేదిక</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} data-testid="prev-day-btn">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
            data-testid="report-date-input"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftDay(1)}
            disabled={date >= today()}
            data-testid="next-day-btn"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={exportCsv} data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()} data-testid="print-report-btn">
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-4">{prettyDate}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((st) => (
          <Card key={st.label} data-testid={`stat-${st.label.toLowerCase().replace(/\s/g, "-")}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[st.color]}`}>
                <st.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{st.label}</p>
                <p className="font-telugu text-[11px] text-slate-400">{st.labelTe}</p>
                <p className="font-heading text-xl font-bold text-slate-800">{st.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Transactions */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-green-700" />
                Transactions <span className="font-telugu text-sm text-slate-400">(లావాదేవీలు)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report?.bills.map((b) => (
                    <TableRow key={b.id} data-testid={`bill-row-${b.bill_no}`}>
                      <TableCell className="font-medium">#{b.bill_no}</TableCell>
                      <TableCell className="text-slate-500 whitespace-nowrap">{formatTime(b.date)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-700">{b.customer_name}</div>
                        <div className="text-xs text-slate-400">{b.village}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {b.items.map((it, i) => (
                            <div key={i} className="text-xs text-slate-600">
                              {it.product_name} <span className="text-slate-400">× {it.quantity} {it.unit}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{b.total_amount.toLocaleString()}</TableCell>
                      <TableCell>
                        {b.payment_type === "cash" ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Cash</Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Credit</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {report?.bills.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No sales on this day</p>
                  <p className="font-telugu text-sm">ఈ రోజు అమ్మకాలు లేవు</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items sold summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-green-700" />
                Items Sold <span className="font-telugu text-sm text-slate-400">(అమ్మిన వస్తువులు)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="data-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report?.items_summary.map((it, i) => (
                    <TableRow key={i} data-testid={`item-summary-${i}`}>
                      <TableCell className="text-slate-700">{it.product_name}</TableCell>
                      <TableCell className="text-right">{it.quantity} {it.unit}</TableCell>
                      <TableCell className="text-right font-medium">₹{it.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {report?.items_summary.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">No items sold</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
