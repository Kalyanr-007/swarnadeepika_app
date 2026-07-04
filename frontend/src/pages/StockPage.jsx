import { useState, useEffect } from "react";
import axios from "axios";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Package, Search, Eye, EyeOff, Upload } from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StockPage = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showPurchasePrice, setShowPurchasePrice] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [productForm, setProductForm] = useState({
    name: "",
    name_telugu: "",
    category_id: "",
    batch_no: "",
    mfg_date: "",
    exp_date: "",
    purchase_price: "",
    mrp: "",
    selling_price: "",
    quantity: "",
    unit: "piece",
    bag_size_kg: ""
  });

  const [showSync, setShowSync] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [syncPreview, setSyncPreview] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const endpoint = isAdmin && showPurchasePrice ? "/products/admin" : "/products";
      const [productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}${endpoint}`),
        axios.get(`${API}/categories`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [showPurchasePrice]);

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "all" || p.category_id === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.batch_no.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const resetProductForm = () => {
    setProductForm({
      name: "",
      name_telugu: "",
      category_id: "",
      batch_no: "",
      mfg_date: "",
      exp_date: "",
      purchase_price: "",
      mrp: "",
      selling_price: "",
      quantity: "",
      unit: "piece",
      bag_size_kg: ""
    });
  };

  const buildProductData = () => ({
    ...productForm,
    purchase_price: parseFloat(productForm.purchase_price),
    mrp: parseFloat(productForm.mrp),
    selling_price: parseFloat(productForm.selling_price),
    quantity: parseInt(productForm.quantity),
    bag_size_kg: parseFloat(productForm.bag_size_kg) || 0
  });

  const handleSyncPreview = async () => {
    if (!csvText.trim()) { toast.error("Paste the CSV data first"); return; }
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/subsidy/preview`, { csv: csvText });
      setSyncPreview(res.data.rows);
    } catch {
      toast.error("Could not parse CSV");
    } finally { setSyncing(false); }
  };

  const handleSyncApply = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/subsidy/apply`, { csv: csvText });
      toast.success(`Stock updated for ${res.data.applied} product(s)`);
      setShowSync(false);
      setCsvText("");
      setSyncPreview(null);
      fetchData();
    } catch {
      toast.error("Sync failed");
    } finally { setSyncing(false); }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      toast.error("Category name is required");
      return;
    }
    try {
      await axios.post(`${API}/categories`, newCategory);
      toast.success("Category added!");
      setNewCategory({ name: "", description: "" });
      setShowAddCategory(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to add category");
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await axios.delete(`${API}/categories/${id}`);
      toast.success("Category deleted!");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const handleAddProduct = async () => {
    const { name, category_id, batch_no, mfg_date, exp_date, purchase_price, mrp, selling_price, quantity } = productForm;
    if (!name || !category_id || !batch_no || !mfg_date || !exp_date || !purchase_price || !mrp || !selling_price || !quantity) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      const data = buildProductData();
      await axios.post(`${API}/products`, data);
      toast.success("Product added!");
      resetProductForm();
      setShowAddProduct(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to add product");
    }
  };

  const handleUpdateProduct = async () => {
    try {
      const data = buildProductData();
      await axios.put(`${API}/products/${editingProduct.id}`, data);
      toast.success("Product updated!");
      resetProductForm();
      setEditingProduct(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to update product");
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await axios.delete(`${API}/products/${id}`);
      toast.success("Product deleted!");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "product") {
      await handleDeleteProduct(deleteTarget.id);
    } else if (deleteTarget.type === "category") {
      await handleDeleteCategory(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      name_telugu: product.name_telugu || "",
      category_id: product.category_id,
      batch_no: product.batch_no,
      mfg_date: product.mfg_date,
      exp_date: product.exp_date,
      purchase_price: product.purchase_price || "",
      mrp: product.mrp,
      selling_price: product.selling_price,
      quantity: product.quantity,
      unit: product.unit,
      bag_size_kg: product.bag_size_kg || ""
    });
  };

  const getCategoryName = (id) => {
    const cat = categories.find((c) => c.id === id);
    return cat?.name || "Unknown";
  };

  const getStockStatus = (product) => {
    if (product.quantity < 10) return "stock-low";
    const expDate = new Date(product.exp_date);
    const today = new Date();
    const daysToExpiry = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
    if (daysToExpiry < 30) return "stock-expiring";
    return "stock-good";
  };

  return (
    <div className="p-6" data-testid="stock-page">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Stock Management</h1>
          <p className="font-telugu text-slate-500">స్టాక్ నిర్వహణ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSync(true)} data-testid="sync-csv-btn">
            <Upload className="w-4 h-4 mr-2" />
            Govt CSV Sync
          </Button>
          <Button variant="outline" onClick={() => setShowAddCategory(true)} data-testid="add-category-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
          <Button onClick={() => setShowAddProduct(true)} className="bg-green-700 hover:bg-green-800" data-testid="add-product-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
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
        {isAdmin && (
          <Button
            variant="outline"
            onClick={() => setShowPurchasePrice(!showPurchasePrice)}
            className={showPurchasePrice ? "bg-yellow-50 border-yellow-300" : ""}
          >
            {showPurchasePrice ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPurchasePrice ? "Hide Cost" : "Show Cost"}
          </Button>
        )}
      </div>

      {/* Categories List */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm"
          >
            <span>{cat.name}</span>
            <button
              onClick={() => setDeleteTarget({ type: "category", id: cat.id, name: cat.name })}
              className="text-slate-400 hover:text-red-500"
              data-testid={`delete-category-${cat.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Exp Date</TableHead>
                {showPurchasePrice && isAdmin && <TableHead>Cost</TableHead>}
                <TableHead>MRP</TableHead>
                <TableHead>Sell Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className={getStockStatus(product)}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.name_telugu && (
                        <p className="text-xs text-slate-500 font-telugu">{product.name_telugu}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryName(product.category_id)}</TableCell>
                  <TableCell>{product.batch_no}</TableCell>
                  <TableCell>{product.exp_date}</TableCell>
                  {showPurchasePrice && isAdmin && (
                    <TableCell className="text-yellow-600 font-medium">₹{product.purchase_price}</TableCell>
                  )}
                  <TableCell className="text-slate-500">₹{product.mrp}</TableCell>
                  <TableCell className="text-green-700 font-semibold">₹{product.selling_price}</TableCell>
                  <TableCell>
                    <span className={`font-bold ${product.quantity < 10 ? "text-red-600" : "text-slate-800"}`}>
                      {product.quantity} {product.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => setDeleteTarget({ type: "product", id: product.id, name: product.name })}
                      data-testid={`delete-product-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No products found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Category Modal */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Fertilizers, Pesticides, Seeds"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <Button onClick={handleAddCategory} className="w-full bg-green-700 hover:bg-green-800">
              Add Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Modal */}
      <Dialog open={showAddProduct || !!editingProduct} onOpenChange={(open) => {
        if (!open) {
          setShowAddProduct(false);
          setEditingProduct(null);
          resetProductForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Product Name (English) *</Label>
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Product name"
              />
            </div>
            <div>
              <Label>Product Name (Telugu)</Label>
              <Input
                value={productForm.name_telugu}
                onChange={(e) => setProductForm({ ...productForm, name_telugu: e.target.value })}
                placeholder="తెలుగు పేరు"
                className="font-telugu"
              />
            </div>
            <div>
              <Label>Category *</Label>
              <Select
                value={productForm.category_id}
                onValueChange={(val) => setProductForm({ ...productForm, category_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Batch No *</Label>
              <Input
                value={productForm.batch_no}
                onChange={(e) => setProductForm({ ...productForm, batch_no: e.target.value })}
                placeholder="Batch number"
              />
            </div>
            <div>
              <Label>Mfg Date *</Label>
              <Input
                type="date"
                value={productForm.mfg_date}
                onChange={(e) => setProductForm({ ...productForm, mfg_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Exp Date *</Label>
              <Input
                type="date"
                value={productForm.exp_date}
                onChange={(e) => setProductForm({ ...productForm, exp_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Purchase Price (Hidden) *</Label>
              <Input
                type="number"
                value={productForm.purchase_price}
                onChange={(e) => setProductForm({ ...productForm, purchase_price: e.target.value })}
                placeholder="Cost price"
              />
            </div>
            <div>
              <Label>MRP *</Label>
              <Input
                type="number"
                value={productForm.mrp}
                onChange={(e) => setProductForm({ ...productForm, mrp: e.target.value })}
                placeholder="Maximum retail price"
              />
            </div>
            <div>
              <Label>Selling Price *</Label>
              <Input
                type="number"
                value={productForm.selling_price}
                onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })}
                placeholder="Your selling price"
              />
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={productForm.quantity}
                onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                placeholder="Stock quantity"
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Select
                value={productForm.unit}
                onValueChange={(val) => setProductForm({ ...productForm, unit: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="litre">Litre</SelectItem>
                  <SelectItem value="packet">Packet</SelectItem>
                  <SelectItem value="bottle">Bottle</SelectItem>
                  <SelectItem value="bag">Bag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bag Size (kg)</Label>
              <Input
                type="number"
                value={productForm.bag_size_kg}
                onChange={(e) => setProductForm({ ...productForm, bag_size_kg: e.target.value })}
                placeholder="e.g. 45 or 50 (for govt MT→bags)"
                data-testid="product-bagsize-input"
              />
            </div>
          </div>
          <Button
            onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
            className="w-full bg-green-700 hover:bg-green-800 mt-4"
          >
            {editingProduct ? "Update Product" : "Add Product"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "category" ? "Category" : "Product"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteTarget?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="delete-confirm-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Government CSV Sync */}
      <Dialog open={showSync} onOpenChange={(open) => { setShowSync(open); if (!open) { setCsvText(""); setSyncPreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto" data-testid="sync-dialog">
          <DialogHeader>
            <DialogTitle>Government Subsidy CSV Sync</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Paste the machine's end-of-day CSV. It matches each product by name, converts MT→bags
              using the product's Bag Size when needed, and deducts the "Sold" quantity from local stock.
            </p>
            <textarea
              className="w-full h-40 border rounded-md p-3 text-sm font-mono"
              placeholder={"Product Name,Supplier,Opening (Bags),Received (Bags),Sold (Bags),Closing (Bags)\nUrea (45kg),IFFCO,120,50,140,30"}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              data-testid="sync-csv-textarea"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSyncPreview} disabled={syncing} data-testid="sync-preview-btn">
                Preview
              </Button>
              {syncPreview && syncPreview.some((r) => r.matched && r.sold_bags > 0) && (
                <Button onClick={handleSyncApply} disabled={syncing} className="bg-green-700 hover:bg-green-800" data-testid="sync-apply-btn">
                  Apply & Update Stock
                </Button>
              )}
            </div>

            {syncPreview && (
              <div className="border rounded-md overflow-hidden" data-testid="sync-preview-table">
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Sold</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncPreview.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.product_name}</TableCell>
                        <TableCell className="text-right">{r.sold_bags}</TableCell>
                        <TableCell className="text-right">{r.matched ? r.current_stock : "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{r.matched ? r.new_stock : "-"}</TableCell>
                        <TableCell className={r.matched ? "text-green-600 text-xs" : "text-red-500 text-xs"}>
                          {r.matched ? (r.note || "Ready") : r.note}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockPage;
