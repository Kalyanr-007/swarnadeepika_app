import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import { Plus, Edit, Trash2, Users, Search, Phone, MapPin } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    village: "",
    phone: "",
    address: ""
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/customers`);
      setCustomers(response.data);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const search = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      c.village.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search)
    );
  });

  const resetForm = () => {
    setCustomerForm({ name: "", village: "", phone: "", address: "" });
  };

  const handleAddCustomer = async () => {
    if (!customerForm.name || !customerForm.village) {
      toast.error("Name and village are required");
      return;
    }
    try {
      await axios.post(`${API}/customers`, customerForm);
      toast.success("Customer added!");
      resetForm();
      setShowAddCustomer(false);
      fetchCustomers();
    } catch (error) {
      toast.error("Failed to add customer");
    }
  };

  const handleUpdateCustomer = async () => {
    try {
      await axios.put(`${API}/customers/${editingCustomer.id}`, customerForm);
      toast.success("Customer updated!");
      resetForm();
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      toast.error("Failed to update customer");
    }
  };

  const handleDeleteCustomer = async (id) => {
    try {
      await axios.delete(`${API}/customers/${id}`);
      toast.success("Customer deleted!");
      fetchCustomers();
    } catch (error) {
      toast.error("Failed to delete customer");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDeleteCustomer(deleteTarget.id);
    setDeleteTarget(null);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      village: customer.village,
      phone: customer.phone || "",
      address: customer.address || ""
    });
  };

  return (
    <div className="p-6" data-testid="customers-page">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Customers</h1>
          <p className="font-telugu text-slate-500">కస్టమర్లు</p>
        </div>
        <Button onClick={() => setShowAddCustomer(true)} className="bg-green-700 hover:bg-green-800">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, village, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Village</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-3 h-3" />
                      {customer.village}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.phone ? (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-slate-500">
                    {customer.address || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(customer)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => setDeleteTarget({ id: customer.id, name: customer.name })}
                      data-testid={`delete-customer-${customer.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No customers found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Customer Modal */}
      <Dialog open={showAddCustomer || !!editingCustomer} onOpenChange={(open) => {
        if (!open) {
          setShowAddCustomer(false);
          setEditingCustomer(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Village *</Label>
              <Input
                value={customerForm.village}
                onChange={(e) => setCustomerForm({ ...customerForm, village: e.target.value })}
                placeholder="Village name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                placeholder="Full address"
              />
            </div>
            <Button
              onClick={editingCustomer ? handleUpdateCustomer : handleAddCustomer}
              className="w-full bg-green-700 hover:bg-green-800"
            >
              {editingCustomer ? "Update Customer" : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent data-testid="delete-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
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
    </div>
  );
};

export default CustomersPage;
