import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { Handshake, Plus, Trash2, Edit2, Phone, MapPin } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ITEM_TYPES = ["Seeds", "Fertilizers", "Pesticides", "Other"];

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", items_supplied: [], notes: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/suppliers`, { params: query ? { q: query } : {} });
      setSuppliers(res.data);
    } catch { toast.error("Failed to load suppliers"); }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const toggleItem = (item) => {
    setForm((f) => ({
      ...f,
      items_supplied: f.items_supplied.includes(item)
        ? f.items_supplied.filter((i) => i !== item)
        : [...f.items_supplied, item],
    }));
  };

  const reset = () => { setForm({ name: "", phone: "", address: "", items_supplied: [], notes: "" }); setEditing(null); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Supplier name required");
    if (form.phone && !/^\d{10}$/.test(form.phone)) return toast.error("Phone must be 10 digits");
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`${API}/suppliers/${editing}`, form);
        toast.success("Supplier updated");
      } else {
        await axios.post(`${API}/suppliers`, form);
        toast.success("Supplier added");
      }
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  const startEdit = (s) => {
    setEditing(s.id);
    setForm({
      name: s.name || "", phone: s.phone || "", address: s.address || "",
      items_supplied: s.items_supplied || [], notes: s.notes || "",
    });
  };

  const doDelete = async (id) => {
    try {
      await axios.delete(`${API}/suppliers/${id}`);
      toast.success("Deleted");
      setConfirmDel(null);
      load();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="p-6" data-testid="suppliers-page">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Suppliers</h1>
          <p className="font-telugu text-slate-500">సప్లయర్లు</p>
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…" className="w-64"
          data-testid="supplier-search" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-700" />
              {editing ? "Edit Supplier" : "Add Supplier"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. IFFCO Coop" data-testid="supplier-name" />
              </div>
              <div>
                <Label>Phone (10 digits)</Label>
                <Input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="9999999999" data-testid="supplier-phone" />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="City / State" data-testid="supplier-address" />
              </div>
              <div>
                <Label>Items Supplied</Label>
                <div className="flex flex-wrap gap-2 mt-1" data-testid="supplier-items">
                  {ITEM_TYPES.map((t) => {
                    const active = form.items_supplied.includes(t);
                    return (
                      <button type="button" key={t} onClick={() => toggleItem(t)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                          active ? "bg-green-700 text-white border-green-700"
                                 : "bg-white text-slate-600 border-slate-300 hover:border-green-500"}`}
                        data-testid={`supplier-item-${t.toLowerCase()}`}
                      >{t}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Payment terms, contact person…" data-testid="supplier-notes" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-800"
                  data-testid="save-supplier-btn">
                  {saving ? "Saving…" : (editing ? "Update" : "Add Supplier")}
                </Button>
                {editing && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Handshake className="w-5 h-5 text-green-700" /> Directory ({suppliers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} data-testid={`supplier-row-${s.id}`}>
                    <TableCell>
                      <p className="font-medium text-slate-800">{s.name}</p>
                      {s.notes && <p className="text-xs text-slate-500 mt-0.5">{s.notes}</p>}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {s.phone ? (
                        <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:text-green-700">
                          <Phone className="w-3 h-3" />{s.phone}
                        </a>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(s.items_supplied || []).map((it) => (
                          <Badge key={it} variant="secondary" className="text-[10px] py-0.5">{it}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {s.address ? (
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{s.address}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(s)}
                        className="text-slate-400 hover:text-green-700"
                        data-testid={`edit-supplier-${s.id}`}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(s)}
                        className="text-slate-400 hover:text-red-600"
                        data-testid={`delete-supplier-${s.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {suppliers.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Handshake className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No suppliers yet. Add your first one on the left.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <b>{confirmDel?.name}</b> from your directory. Past purchases from
              this supplier are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => doDelete(confirmDel?.id)}
              className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuppliersPage;
