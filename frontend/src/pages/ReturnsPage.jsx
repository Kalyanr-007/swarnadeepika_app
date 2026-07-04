import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import {
  Undo2, Trash2, PackageMinus, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";
const endOfDay = (d) => (d && d.length === 10 ? `${d}T23:59:59` : d);

const rupee = (n) => `₹${(n || 0).toLocaleString()}`;

const ReturnsPage = () => {
  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());

  // Form state
  const [supplier, setSupplier] = useState("");
  const [supplierMatches, setSupplierMatches] = useState([]);
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [productId, setProductId] = useState("none");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("bag");
  const [price, setPrice] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/purchase-returns`, { params: { start_date: start, end_date: endOfDay(end) } });
      setReturns(res.data);
    } catch (e) { console.error(e); }
  }, [start, end]);

  useEffect(() => {
    fetchReturns();
    axios.get(`${API}/products/admin`).then((r) => setProducts(r.data)).catch(() => {});
    axios.get(`${API}/suppliers`).then((r) => setSuppliers(r.data)).catch(() => {});
  }, [fetchReturns]);

  useEffect(() => {
    if (!supplier) { setSupplierMatches([]); return; }
    const q = supplier.toLowerCase();
    setSupplierMatches(suppliers.filter((s) => (s.name || "").toLowerCase().includes(q)).slice(0, 6));
  }, [supplier, suppliers]);

  const pickSupplier = (s) => {
    setSupplier(s.name);
    setSupplierMatches([]);
    setSupplierFocused(false);
  };

  const onSelectProduct = (id) => {
    setProductId(id);
    if (id && id !== "none") {
      const p = products.find((x) => x.id === id);
      if (p) { 
        setProductName(p.name); 
        setUnit(p.unit); 
        setPrice(p.purchase_price || "");
        setBatchNo(p.batch_no || "");
      }
    } else {
      setProductName("");
    }
  };

  const addReturn = async (e) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    const pr = parseFloat(price);
    if (!productName.trim()) return toast.error("Enter a product name");
    if (!qty || qty <= 0) return toast.error("Enter a valid quantity");
    if (!pr || pr <= 0) return toast.error("Enter a valid return price");
    
    setSaving(true);
    try {
      await axios.post(`${API}/purchase-returns`, {
        supplier: supplier.trim(),
        product_id: productId === "none" ? null : productId,
        product_name: productName.trim(),
        quantity: qty, unit,
        return_price: pr,
        batch_no: batchNo,
        date: new Date(date + "T12:00:00").toISOString(),
        update_stock: true,
      });
      toast.success("Return recorded and stock decreased");
      setSupplier(""); setProductId("none"); setProductName("");
      setQuantity(""); setPrice(""); setBatchNo("");
      fetchReturns();
      axios.get(`${API}/products/admin`).then((r) => setProducts(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to record return");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this return record? Stock will be added back.")) return;
    try {
      await axios.delete(`${API}/purchase-returns/${id}`);
      toast.success("Deleted");
      fetchReturns();
      axios.get(`${API}/products/admin`).then((r) => setProducts(r.data)).catch(() => {});
    } catch { toast.error("Failed to delete"); }
  };

  const fmtDate = (d) => { try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; } };
  const totalRefund = returns.reduce((s, r) => s + r.total_refund, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Purchase Returns</h1>
        <p className="font-telugu text-slate-500">కొనుగోలు రిటర్న్స్ (స్టాక్ వెనక్కి పంపడం)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackageMinus className="w-5 h-5 text-red-600" /> Record Return
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addReturn} className="space-y-3" autoComplete="off">
              <div className="relative">
                <Label>Supplier</Label>
                <Input value={supplier}
                  onChange={(e) => { setSupplier(e.target.value); setSupplierFocused(true); }}
                  onFocus={() => setSupplierFocused(true)}
                  onBlur={() => setTimeout(() => setSupplierFocused(false), 200)}
                  placeholder="Type to search" />
                {supplierFocused && supplierMatches.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-auto">
                    {supplierMatches.map((s) => (
                      <button type="button" key={s.id}
                        onClick={() => pickSupplier(s)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Product from Stock</Label>
                <Select value={productId} onValueChange={onSelectProduct}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Other item —</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product Name *</Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)}
                  placeholder="Item name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity *</Label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)}
                    placeholder="bag / L / kg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Refund / unit (₹) *</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="0" />
                </div>
                <div>
                  <Label>Batch No</Label>
                  <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)}
                    placeholder="Optional" />
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-red-600 hover:bg-red-700">
                {saving ? "Saving..." : "Record Return & Decrease Stock"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-red-600" /> Return History
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36" />
              <span className="text-slate-400">to</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-3 bg-red-50 border-y border-slate-200 flex justify-between">
              <span className="text-slate-600 font-medium">Total Refund Amount</span>
              <span className="font-bold text-red-700">{rupee(totalRefund)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-slate-500">{fmtDate(r.date)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{r.product_name}</p>
                      {r.batch_no && <p className="text-xs text-slate-400">Batch: {r.batch_no}</p>}
                    </TableCell>
                    <TableCell className="text-slate-500">{r.supplier || "—"}</TableCell>
                    <TableCell className="text-right">{r.quantity} {r.unit}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">+{rupee(r.total_refund)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}
                        className="text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {returns.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <RefreshCw className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No returns recorded in this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReturnsPage;
