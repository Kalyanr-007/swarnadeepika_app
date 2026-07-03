import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Wallet, Plus, Trash2, TrendingDown } from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/expenses`, { params: { start_date: start, end_date: end } });
      setExpenses(res.data);
    } catch (e) { console.error(e); }
  }, [start, end]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const addExpense = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!category.trim()) return toast.error("Enter a category");
    setSaving(true);
    try {
      await axios.post(`${API}/expenses`, {
        amount: amt, category: category.trim(), note,
        date: new Date(date + "T12:00:00").toISOString(),
      });
      toast.success("Expense recorded");
      setAmount(""); setCategory(""); setNote("");
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add expense");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${API}/expenses/${id}`);
      toast.success("Deleted");
      fetchExpenses();
    } catch { toast.error("Failed to delete"); }
  };

  const fmtDate = (d) => { try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; } };

  return (
    <div className="p-6" data-testid="expenses-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Expenses</h1>
        <p className="font-telugu text-slate-500">ఖర్చులు</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-700" /> Add Expense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addExpense} className="space-y-4">
              <div>
                <Label>Amount (₹) *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0" data-testid="expense-amount-input" />
              </div>
              <div>
                <Label>Category *</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Rent, Transport, Salary" data-testid="expense-category-input" />
              </div>
              <div>
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional details" data-testid="expense-note-input" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
                  data-testid="expense-date-input" />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-green-700 hover:bg-green-800"
                data-testid="add-expense-btn">
                {saving ? "Saving..." : "Add Expense"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" /> Expense List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36" data-testid="expense-start-date" />
              <span className="text-slate-400">to</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36" data-testid="expense-end-date" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-3 bg-red-50 border-y border-red-100 flex justify-between">
              <span className="text-sm text-slate-600">Total for period</span>
              <span className="font-bold text-red-600" data-testid="expense-total">₹{total.toLocaleString()}</span>
            </div>
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id} data-testid={`expense-row-${e.id}`}>
                    <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(e.date)}</TableCell>
                    <TableCell className="font-medium">{e.category}</TableCell>
                    <TableCell className="text-slate-500">{e.note}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">₹{e.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(e.id)}
                        className="text-slate-400 hover:text-red-600" data-testid={`delete-expense-${e.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {expenses.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No expenses in this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpensesPage;
