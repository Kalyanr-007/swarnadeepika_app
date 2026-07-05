import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Printer, Search, UserPlus } from "lucide-react";
import { format } from "date-fns";
import BillTemplate from "../components/BillTemplate";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BillingPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [shopInfo, setShopInfo] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [cartItems, setCartItems] = useState([]);

  const [customerName, setCustomerName] = useState("");
  const [customerVillage, setCustomerVillage] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash"); // cash | upi | credit
  const [cashPaid, setCashPaid] = useState("");
  const [upiPaid, setUpiPaid] = useState("");

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", village: "", phone: "" });
  
  const [createdBill, setCreatedBill] = useState(null);
  const [showBillPreview, setShowBillPreview] = useState(false);
  
  const billRef = useRef();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes, customersRes, shopRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/customers`),
        axios.get(`${API}/shop-info`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setCustomers(customersRes.data);
      setShopInfo(shopRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.batch_no.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch && p.quantity > 0;
  });

  const addToCart = (product) => {
    const existing = cartItems.find((item) => item.product_id === product.id);
    if (existing) {
      if (existing.quantity < product.quantity) {
        setCartItems(
          cartItems.map((item) =>
            item.product_id === product.id
              ? { ...item, quantity: item.quantity + 1, amount: (item.quantity + 1) * item.rate }
              : item
          )
        );
      } else {
        toast.error("Not enough stock available");
      }
    } else {
      setCartItems([
        ...cartItems,
        {
          product_id: product.id,
          product_name: product.name,
          batch_no: product.batch_no,
          mfg_date: product.mfg_date,
          exp_date: product.exp_date,
          quantity: 1,
          unit: product.unit,
          rate: product.selling_price,
          amount: product.selling_price,
          max_qty: product.quantity
        }
      ]);
    }
  };

  const updateCartQuantity = (productId, newQty) => {
    const item = cartItems.find((i) => i.product_id === productId);
    if (newQty > item.max_qty) {
      toast.error("Not enough stock available");
      return;
    }
    if (newQty < 1) {
      removeFromCart(productId);
      return;
    }
    setCartItems(
      cartItems.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: newQty, amount: newQty * item.rate }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCartItems(cartItems.filter((item) => item.product_id !== productId));
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.amount, 0);

  const selectCustomer = (customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerVillage(customer.village);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.village) {
      toast.error("Name and village are required");
      return;
    }
    try {
      const response = await axios.post(`${API}/customers`, newCustomer);
      setCustomers([...customers, response.data]);
      selectCustomer(response.data);
      setShowCustomerModal(false);
      setNewCustomer({ name: "", village: "", phone: "" });
      toast.success("Customer created!");
    } catch (error) {
      toast.error("Failed to create customer");
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: billRef,
    documentTitle: `Bill_${createdBill?.bill_no}`,
  });

  const handleCreateBill = async () => {
    if (cartItems.length === 0) {
      toast.error("Add items to cart");
      return;
    }
    if (!customerName || !customerVillage) {
      toast.error("Enter customer name and village");
      return;
    }

    const cashAmt = paymentMode === "cash" ? totalAmount
      : paymentMode === "credit" ? (parseFloat(cashPaid) || 0) : 0;
    const upiAmt = paymentMode === "upi" ? totalAmount
      : paymentMode === "credit" ? (parseFloat(upiPaid) || 0) : 0;
    const paid = cashAmt + upiAmt;
    const finalType = (totalAmount - paid) > 0.01 ? "credit" : "cash";

    try {
      const billData = {
        customer_id: selectedCustomerId || null,
        customer_name: customerName,
        village: customerVillage,
        items: cartItems.map(({ max_qty, ...item }) => item),
        total_amount: totalAmount,
        payment_type: finalType,
        cash_amount: cashAmt,
        upi_amount: upiAmt,
      };

      const response = await axios.post(`${API}/bills`, billData);
      setCreatedBill(response.data);
      setShowBillPreview(true);
      toast.success(`Bill #${response.data.bill_no} created!`);

      // Reset form
      setCartItems([]);
      setCustomerName("");
      setCustomerVillage("");
      setSelectedCustomerId("");
      setCashPaid("");
      setUpiPaid("");
      setPaymentMode("cash");
      fetchData(); // Refresh products to update stock
    } catch (error) {
      toast.error("Failed to create bill");
    }
  };

  return (
    <div className="p-6 h-full flex flex-col" data-testid="billing-page">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-bold text-slate-800">Billing</h1>
        <p className="font-telugu text-slate-500">బిల్లింగ్</p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Panel - Product Selection */}
        <div className="w-3/5 flex flex-col">
          {/* Search and Filter */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="product-search"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="product-card cursor-pointer hover:shadow-md border-slate-200"
                  onClick={() => addToCart(product)}
                  data-testid={`product-${product.id}`}
                >
                  <CardContent className="p-4">
                    <h3 className="font-medium text-slate-800 truncate">{product.name}</h3>
                    <p className="text-xs text-slate-500">Batch: {product.batch_no}</p>
                    <div className="flex justify-between items-end mt-2">
                      <div>
                        <p className="text-lg font-bold text-green-700">₹{product.selling_price}</p>
                        {product.mrp > product.selling_price && (
                          <p className="text-xs text-slate-400 line-through">MRP: ₹{product.mrp}</p>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        {product.quantity} {product.unit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No products found
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart & Customer */}
        <div className="w-2/5 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200">
          {/* Customer Section */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <Label className="text-sm font-semibold text-slate-700">Customer Details</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomerModal(true)}
                data-testid="add-customer-btn"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
            <Select
              value={selectedCustomerId}
              onValueChange={(val) => {
                const customer = customers.find((c) => c.id === val);
                if (customer) selectCustomer(customer);
              }}
            >
              <SelectTrigger data-testid="customer-search-input">
                <SelectValue placeholder="Select existing customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} - {customer.village}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Input
                placeholder="Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                data-testid="customer-name-input"
              />
              <Input
                placeholder="Village"
                value={customerVillage}
                onChange={(e) => setCustomerVillage(e.target.value)}
                data-testid="customer-village-input"
              />
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto p-4">
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">
              Cart Items ({cartItems.length})
            </Label>
            {cartItems.length > 0 ? (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-slate-500">₹{item.rate} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="font-semibold text-green-700 w-16 text-right">
                      ₹{item.amount}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => removeFromCart(item.product_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                Click on products to add to cart
              </div>
            )}
          </div>

          {/* Payment Section */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="text-2xl font-bold text-green-700">₹{totalAmount.toLocaleString()}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Button
                variant={paymentMode === "cash" ? "default" : "outline"}
                className={paymentMode === "cash" ? "bg-green-700 hover:bg-green-800" : ""}
                onClick={() => setPaymentMode("cash")}
                data-testid="payment-cash"
              >
                Cash
              </Button>
              <Button
                variant={paymentMode === "upi" ? "default" : "outline"}
                className={paymentMode === "upi" ? "bg-blue-600 hover:bg-blue-700" : ""}
                onClick={() => setPaymentMode("upi")}
                data-testid="payment-upi"
              >
                UPI
              </Button>
              <Button
                variant={paymentMode === "credit" ? "default" : "outline"}
                className={paymentMode === "credit" ? "bg-yellow-600 hover:bg-yellow-700" : ""}
                onClick={() => setPaymentMode("credit")}
                data-testid="payment-credit"
              >
                Credit
              </Button>
            </div>

            {paymentMode === "credit" && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <Label className="text-xs text-slate-500">Cash paid now</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={cashPaid}
                    onChange={(e) => setCashPaid(e.target.value)}
                    data-testid="credit-cash-input"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">UPI paid now</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={upiPaid}
                    onChange={(e) => setUpiPaid(e.target.value)}
                    data-testid="credit-upi-input"
                  />
                </div>
                <p className="col-span-2 text-sm text-red-600 font-medium" data-testid="credit-balance">
                  Balance (Khata): ₹{Math.max(0, totalAmount - ((parseFloat(cashPaid) || 0) + (parseFloat(upiPaid) || 0))).toLocaleString()}
                </p>
              </div>
            )}

            <Button
              className="w-full bg-green-700 hover:bg-green-800 h-12 text-lg font-semibold"
              onClick={handleCreateBill}
              disabled={cartItems.length === 0}
              data-testid="create-bill-btn"
            >
              Create Bill
            </Button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Village *</Label>
              <Input
                value={newCustomer.village}
                onChange={(e) => setNewCustomer({ ...newCustomer, village: e.target.value })}
                placeholder="Village name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Phone number (optional)"
              />
            </div>
            <Button onClick={handleCreateCustomer} className="w-full bg-green-700 hover:bg-green-800">
              Add Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Preview Modal */}
      <Dialog open={showBillPreview} onOpenChange={setShowBillPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>Bill #{createdBill?.bill_no}</span>
              <Button onClick={handlePrint} className="bg-green-700 hover:bg-green-800" data-testid="print-bill-btn">
                <Printer className="w-4 h-4 mr-2" />
                Print Bill
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div ref={billRef} className="print-area">
            {createdBill && shopInfo && (
              <BillTemplate bill={createdBill} shopInfo={shopInfo} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingPage;
