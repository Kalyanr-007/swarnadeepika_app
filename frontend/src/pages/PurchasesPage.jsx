import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Truck, Plus, Trash2, PackagePlus } from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

const PurchasesPage = () => {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());

  const [supplier, setSupplier] = useState("");
  const [productId, setProductId] = useState("none");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("bag");
  const [price, setPrice] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/purchases`, { params: { start_date: start, end_date: end } });
      setPurchases(res.data);
    } catch (e) { console.error(e); }
  }, [start, end]);

  useEffect(() => {
    fetchPurchases();
    axios.get(`${API}/products`).then((r) => setProducts(r.data)).catch(() => {});
  }, [fetchPurchases]);

  const total = purchases.reduce((s, p) => s + p.total_cost, 0);

  const onSelectProduct = (id) => {
    setProductId(id);
    if (id && id !== "none") {
      const p = products.find((x) => x.id === id);
      if (p) { setProductName(p.name); setUnit(p.unit); }
    }
  };

  const addPurchase = async (e) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    const pr = parseFloat(price);
    if (!productName.trim()) return toast.error("Enter a product name");
    if (!qty || qty <= 0) return toast.error("Enter a valid quantity");
    if (!pr || pr <= 0) return toast.error("Enter a valid purchase price");
    setSaving(true);
    try {
      await axios.post(`${API}/purchases`, {
        supplier, product_id: productId === "none" ? null : productId,
        product_name: productName.trim(), quantity: qty, unit,
        purchase_price: pr, batch_no: batchNo,
        date: new Date(date + "T12:00:00").toISOString(),
      });
      toast.success(productId !== "none" ? "Purchase recorded & stock updated" : "Purchase recorded");
      setSupplier(""); setProductId("none"); setProductName(""); setQuantity(""); setPrice(""); setBatchNo("");
      fetchPurchases();
      axios.get(`${API}/products`).then((r) => setProducts(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add purchase");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${API}/purchases/${id}`);
      toast.success("Deleted (stock reversed)");
      fetchPurchases();
    } catch { toast.error("Failed to delete"); }
  };

  const fmtDate = (d) => { try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; } };

  return (
    <div className="p-6" data-testid="purchases-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Purchases / Stock-in</h1>
        <p className="font-telugu text-slate-500">కొనుగోళ్లు</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-green-700" /> Record Purchase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addPurchase} className="space-y-3">
              <div>
                <Label>Supplier</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Supplier name" data-testid="purchase-supplier-input" />
              </div>
              <div>
                <Label>Existing Product (restock)</Label>
                <Select value={productId} onValueChange={onSelectProduct}>
                  <SelectTrigger data-testid="purchase-product-select"><SelectValue placeholder="Select to restock" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— New / not in stock list —</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product Name *</Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)}
                  placeholder="Item purchased" data-testid="purchase-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity *</Label>
                  <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0" data-testid="purchase-qty-input" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)}
                    placeholder="bag / kg" data-testid="purchase-unit-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cost / unit (₹) *</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="0" data-testid="purchase-price-input" />
                </div>
                <div>
                  <Label>Batch No</Label>
                  <Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)}
                    placeholder="Optional" data-testid="purchase-batch-input" />
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
                  data-testid="purchase-date-input" />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-green-700 hover:bg-green-800"
                data-testid="add-purchase-btn">
                {saving ? "Saving..." : "Add Purchase"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-700" /> Purchase History
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-36" data-testid="purchase-start-date" />
              <span className="text-slate-400">to</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-36" data-testid="purchase-end-date" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-3 bg-blue-50 border-y border-blue-100 flex justify-between">
              <span className="text-sm text-slate-600">Total purchases</span>
              <span className="font-bold text-blue-700" data-testid="purchase-total">₹{total.toLocaleString()}</span>
            </div>
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost/unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id} data-testid={`purchase-row-${p.id}`}>
                    <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="text-slate-500">{p.supplier}</TableCell>
                    <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                    <TableCell className="text-right">₹{p.purchase_price.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">₹{p.total_cost.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove(p.id)}
                        className="text-slate-400 hover:text-red-600" data-testid={`delete-purchase-${p.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {purchases.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No purchases in this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PurchasesPage;
