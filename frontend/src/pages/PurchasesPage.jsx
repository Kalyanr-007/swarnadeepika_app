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
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Truck, Trash2, PackagePlus, CheckCircle2, PackageOpen, CreditCard,
} from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";
const endOfDay = (d) => (d && d.length === 10 ? `${d}T23:59:59` : d);

const PAYMENT_METHODS = [
  { v: "cash", label: "Cash", te: "నగదు" },
  { v: "credit", label: "Credit", te: "అప్పు" },
  { v: "upi", label: "UPI", te: "UPI" },
  { v: "account_transfer", label: "Account Transfer", te: "బ్యాంక్" },
];

const rupee = (n) => `₹${(n || 0).toLocaleString()}`;

const PurchasesPage = () => {
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());

  // Form state
  const [supplier, setSupplier] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierMatches, setSupplierMatches] = useState([]);
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [productId, setProductId] = useState("none");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("bag");
  const [price, setPrice] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [refNo, setRefNo] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Declare-in-stock dialog
  const [declareTarget, setDeclareTarget] = useState(null); // purchase being declared
  const [decQty, setDecQty] = useState("");
  const [decCat, setDecCat] = useState("");
  const [decMrp, setDecMrp] = useState("");
  const [decSell, setDecSell] = useState("");
  const [decMfg, setDecMfg] = useState("");
  const [decExp, setDecExp] = useState("");
  const [decBag, setDecBag] = useState("");
  const [decNameTe, setDecNameTe] = useState("");
  const [declaring, setDeclaring] = useState(false);

  const fetchPurchases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/purchases`, { params: { start_date: start, end_date: endOfDay(end) } });
      setPurchases(res.data);
    } catch (e) { console.error(e); }
  }, [start, end]);

  useEffect(() => {
    fetchPurchases();
    axios.get(`${API}/products/admin`).then((r) => setProducts(r.data)).catch(() => {});
    axios.get(`${API}/suppliers`).then((r) => setSuppliers(r.data)).catch(() => {});
    axios.get(`${API}/categories`).then((r) => setCategories(r.data)).catch(() => {});
  }, [fetchPurchases]);

  // Supplier autocomplete: filter as user types
  useEffect(() => {
    if (!supplier) { setSupplierMatches([]); return; }
    const q = supplier.toLowerCase();
    setSupplierMatches(suppliers.filter((s) => (s.name || "").toLowerCase().includes(q)).slice(0, 6));
  }, [supplier, suppliers]);

  const pickSupplier = (s) => {
    setSupplier(s.name);
    setSupplierPhone(s.phone || "");
    setSupplierMatches([]);
    setSupplierFocused(false);
  };

  const total = purchases.reduce((s, p) => s + p.total_cost, 0);
  const notDeclared = purchases.filter((p) => !p.declared_in_stock).length;
  const openCredit = purchases.reduce((s, p) => s + (p.balance_amount || 0), 0);

  const onSelectProduct = (id) => {
    setProductId(id);
    if (id && id !== "none") {
      const p = products.find((x) => x.id === id);
      if (p) { setProductName(p.name); setUnit(p.unit); }
    } else {
      setProductName("");
    }
  };

  const addPurchase = async (e) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    const pr = parseFloat(price);
    if (!productName.trim()) return toast.error("Enter a product name");
    if (!qty || qty <= 0) return toast.error("Enter a valid quantity");
    if (!pr || pr <= 0) return toast.error("Enter a valid purchase price");
    if ((paymentMethod === "upi" || paymentMethod === "account_transfer") && !refNo.trim()) {
      return toast.error("Reference number required for UPI / Bank transfer");
    }
    setSaving(true);
    try {
      const linkedSup = suppliers.find((s) => s.name.toLowerCase() === supplier.trim().toLowerCase());
      const totalCost = pr * qty;
      const paid = paidAmount === "" ? (paymentMethod === "credit" ? 0 : totalCost) : parseFloat(paidAmount);
      await axios.post(`${API}/purchases`, {
        supplier: supplier.trim(),
        supplier_id: linkedSup?.id || null,
        supplier_phone: supplierPhone,
        product_id: productId === "none" ? null : productId,
        product_name: productName.trim(),
        quantity: qty, unit,
        purchase_price: pr,
        batch_no: batchNo,
        date: new Date(date + "T12:00:00").toISOString(),
        payment_method: paymentMethod,
        reference_number: refNo,
        paid_amount: paid,
        update_stock: false,
      });
      toast.success("Purchase recorded. Click 'Declare in Stock' to add it to inventory.");
      setSupplier(""); setSupplierPhone(""); setProductId("none"); setProductName("");
      setQuantity(""); setPrice(""); setBatchNo("");
      setPaymentMethod("cash"); setRefNo(""); setPaidAmount("");
      fetchPurchases();
      // refresh suppliers because backend auto-creates new ones
      axios.get(`${API}/suppliers`).then((r) => setSuppliers(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add purchase");
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this purchase? If it was declared in stock, that stock will be reversed.")) return;
    try {
      await axios.delete(`${API}/purchases/${id}`);
      toast.success("Deleted");
      fetchPurchases();
      axios.get(`${API}/products/admin`).then((r) => setProducts(r.data)).catch(() => {});
    } catch { toast.error("Failed to delete"); }
  };

  const openDeclare = (p) => {
    setDeclareTarget(p);
    setDecQty(p.remaining_quantity !== undefined ? p.remaining_quantity : p.quantity);
    setDecCat(""); setDecMrp(""); setDecSell(""); setDecMfg(""); setDecExp("");
    setDecBag(""); setDecNameTe("");
  };

  const submitDeclare = async () => {
    if (!declareTarget) return;
    const dq = parseInt(decQty);
    if (!dq || dq <= 0) return toast.error("Enter a valid quantity to declare");
    const remaining = declareTarget.remaining_quantity !== undefined ? declareTarget.remaining_quantity : declareTarget.quantity;
    if (dq > remaining) return toast.error(`Cannot declare more than ${remaining}`);

    // Only require category if this is a NEW product
    if (!declareTarget.product_id && !decCat) return toast.error("Category is required for a new product");
    setDeclaring(true);
    try {
      await axios.post(`${API}/purchases/${declareTarget.id}/declare-in-stock`, {
        quantity: dq,
        category_id: decCat || null,
        mrp: decMrp ? parseFloat(decMrp) : null,
        selling_price: decSell ? parseFloat(decSell) : null,
        mfg_date: decMfg || null,
        exp_date: decExp || null,
        bag_size_kg: decBag ? parseFloat(decBag) : 0,
        name_telugu: decNameTe,
      });
      toast.success(`Added ${dq} ${declareTarget.unit} of ${declareTarget.product_name} to stock`);
      setDeclareTarget(null);
      fetchPurchases();
      axios.get(`${API}/products/admin`).then((r) => setProducts(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || "Declare failed");
    } finally { setDeclaring(false); }
  };

  const fmtDate = (d) => { try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; } };

  return (
    <div className="p-6" data-testid="purchases-page">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Purchases / Stock-in</h1>
        <p className="font-telugu text-slate-500">కొనుగోళ్లు</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-green-700" /> Record Purchase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addPurchase} className="space-y-3" autoComplete="off">
              {/* Supplier autocomplete */}
              <div className="relative">
                <Label>Supplier</Label>
                <Input value={supplier}
                  onChange={(e) => { setSupplier(e.target.value); setSupplierFocused(true); }}
                  onFocus={() => setSupplierFocused(true)}
                  onBlur={() => setTimeout(() => setSupplierFocused(false), 200)}
                  placeholder="Type to search or add new"
                  data-testid="purchase-supplier-input" />
                {supplierFocused && supplierMatches.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-56 overflow-auto"
                    data-testid="supplier-autocomplete">
                    {supplierMatches.map((s) => (
                      <button type="button" key={s.id}
                        onClick={() => pickSupplier(s)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                        data-testid={`supplier-suggest-${s.id}`}>
                        <p className="text-sm font-medium text-slate-800">{s.name}</p>
                        <p className="text-xs text-slate-500">
                          {s.phone || "no phone"} · {(s.items_supplied || []).join(", ") || "no items tagged"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Supplier phone</Label>
                <Input value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10 digits (stored for autocomplete)"
                  data-testid="purchase-supplier-phone" />
              </div>

              <div>
                <Label>Existing Product (restock)</Label>
                <Select value={productId} onValueChange={onSelectProduct}>
                  <SelectTrigger data-testid="purchase-product-select"><SelectValue placeholder="Restock or new" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— New / not in stock yet —</SelectItem>
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
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bag">Bag</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="litre">Litre</SelectItem>
                      <SelectItem value="packet">Packet</SelectItem>
                      <SelectItem value="bottle">Bottle</SelectItem>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {unit === "other" && (
                    <Input className="mt-2" placeholder="Specify unit" 
                      onChange={(e) => setUnit(e.target.value)} />
                  )}
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

              {/* Payment */}
              <div>
                <Label>Payment Method *</Label>
                <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); if (v !== "upi" && v !== "account_transfer") setRefNo(""); if (v !== "credit") setPaidAmount(""); }}>
                  <SelectTrigger data-testid="purchase-payment-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.v} value={m.v}>{m.label} · {m.te}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(paymentMethod === "upi" || paymentMethod === "account_transfer") && (
                <div>
                  <Label>Reference Number *</Label>
                  <Input value={refNo} onChange={(e) => setRefNo(e.target.value)}
                    placeholder={paymentMethod === "upi" ? "UPI txn ID" : "UTR / cheque no"}
                    data-testid="purchase-refno" />
                </div>
              )}
              {paymentMethod === "credit" && (
                <div>
                  <Label>Amount paid now (₹, optional)</Label>
                  <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="Partial payment amount"
                    data-testid="purchase-paid-amount" />
                </div>
              )}

              <div>
                <Label>Date</Label>
                <Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
                  data-testid="purchase-date-input" />
              </div>
              <Button type="submit" disabled={saving} className="w-full bg-green-700 hover:bg-green-800"
                data-testid="add-purchase-btn">
                {saving ? "Saving..." : "Save Purchase (does NOT touch stock yet)"}
              </Button>
              <p className="text-[11px] text-slate-500">
                Stock is only updated after you click <b>Declare in Stock</b> in the history table.
              </p>
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
            <div className="grid grid-cols-3 border-y border-slate-200 divide-x divide-slate-200 text-sm">
              <div className="p-3 flex justify-between bg-blue-50">
                <span className="text-slate-600">Total purchases</span>
                <span className="font-bold text-blue-700" data-testid="purchase-total">{rupee(total)}</span>
              </div>
              <div className="p-3 flex justify-between bg-amber-50">
                <span className="text-slate-600">Not yet in stock</span>
                <span className="font-bold text-amber-700" data-testid="purchase-not-declared">{notDeclared}</span>
              </div>
              <div className="p-3 flex justify-between bg-red-50">
                <span className="text-slate-600">Open credit</span>
                <span className="font-bold text-red-700" data-testid="purchase-open-credit">{rupee(openCredit)}</span>
              </div>
            </div>
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id} data-testid={`purchase-row-${p.id}`}>
                    <TableCell className="text-slate-500 whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                    <TableCell>
                      <p className="font-medium">{p.product_name}</p>
                      {p.batch_no && <p className="text-xs text-slate-400">Batch: {p.batch_no}</p>}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {p.supplier || "—"}
                      {p.supplier_phone && <p className="text-xs text-slate-400">{p.supplier_phone}</p>}
                    </TableCell>
                    <TableCell className="text-right">{p.quantity} {p.unit}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">{rupee(p.total_cost)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={p.payment_method === "credit" ? "destructive" : "secondary"} className="w-fit text-[10px]">
                          {p.payment_method || "cash"}
                        </Badge>
                        {p.reference_number && <p className="text-[10px] text-slate-400">Ref: {p.reference_number}</p>}
                        {p.balance_amount > 0 && (
                          <p className="text-[10px] text-red-600 inline-flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> {rupee(p.balance_amount)} due
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.declared_in_stock ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]"
                          data-testid={`declared-${p.id}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> In stock
                        </Badge>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Button size="sm" variant="outline" className="h-7 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => openDeclare(p)}
                            data-testid={`declare-btn-${p.id}`}>
                            <PackageOpen className="w-3 h-3 mr-1" /> {p.remaining_quantity !== undefined && p.remaining_quantity < p.quantity ? "Declare Remaining" : "Declare in Stock"}
                          </Button>
                          {p.remaining_quantity !== undefined && p.remaining_quantity < p.quantity && (
                            <p className="text-[10px] text-amber-600 font-medium">
                              Partial: {p.quantity - p.remaining_quantity} in stock
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
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

      {/* Declare-in-stock dialog */}
      <Dialog open={!!declareTarget} onOpenChange={(o) => { if (!o) setDeclareTarget(null); }}>
        <DialogContent data-testid="declare-dialog">
          <DialogHeader>
            <DialogTitle>Declare in Stock</DialogTitle>
            <DialogDescription>
              {declareTarget?.product_id
                ? `Add stock from purchase of "${declareTarget?.product_name}".`
                : `Create a new product entry for "${declareTarget?.product_name}" and add stock.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 p-3 rounded-md border border-amber-100 mb-2">
              <p className="text-xs text-amber-800">
                Purchase Quantity: <b>{declareTarget?.quantity} {declareTarget?.unit}</b><br/>
                Remaining to declare: <b>{declareTarget?.remaining_quantity !== undefined ? declareTarget?.remaining_quantity : declareTarget?.quantity} {declareTarget?.unit}</b>
              </p>
            </div>
            
            <div>
              <Label>Quantity to declare now *</Label>
              <Input type="number" value={decQty} onChange={(e) => setDecQty(e.target.value)} 
                placeholder="How many units to add to stock?" data-testid="declare-qty-input" />
            </div>

            {!declareTarget?.product_id && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase text-slate-400">Product Details (New Item)</p>
                <div>
                  <Label>Category *</Label>
                  <Select value={decCat} onValueChange={setDecCat}>
                    <SelectTrigger data-testid="declare-category"><SelectValue placeholder="Choose category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>MRP (₹)</Label>
                    <Input type="number" value={decMrp} onChange={(e) => setDecMrp(e.target.value)} placeholder="e.g. 650" data-testid="declare-mrp" />
                  </div>
                  <div>
                    <Label>Selling price (₹)</Label>
                    <Input type="number" value={decSell} onChange={(e) => setDecSell(e.target.value)} placeholder="e.g. 600" data-testid="declare-sell" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Mfg date</Label>
                    <Input type="date" value={decMfg} onChange={(e) => setDecMfg(e.target.value)} data-testid="declare-mfg" />
                  </div>
                  <div>
                    <Label>Expiry date</Label>
                    <Input type="date" value={decExp} onChange={(e) => setDecExp(e.target.value)} data-testid="declare-exp" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Pack size (e.g. 45kg, 1L)</Label>
                    <Input type="number" value={decBag} onChange={(e) => setDecBag(e.target.value)} placeholder="e.g. 45" data-testid="declare-bag" />
                  </div>
                  <div>
                    <Label>Telugu name</Label>
                    <Input value={decNameTe} onChange={(e) => setDecNameTe(e.target.value)} placeholder="Optional" data-testid="declare-tename" />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclareTarget(null)}>Cancel</Button>
            <Button onClick={submitDeclare} disabled={declaring} className="bg-green-700 hover:bg-green-800"
              data-testid="declare-confirm-btn">
              {declaring ? "Declaring..." : "Declare in Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchasesPage;
