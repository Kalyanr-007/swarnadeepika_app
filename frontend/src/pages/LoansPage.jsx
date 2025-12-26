import { useState, useEffect } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { CreditCard, IndianRupee, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LoansPage = () => {
  const [pendingLoans, setPendingLoans] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingLoans();
  }, []);

  const fetchPendingLoans = async () => {
    try {
      const response = await axios.get(`${API}/loans/pending`);
      setPendingLoans(response.data);
    } catch (error) {
      console.error("Failed to fetch pending loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLoans = pendingLoans.filter((loan) => {
    const search = searchTerm.toLowerCase();
    return (
      loan.customer_name.toLowerCase().includes(search) ||
      loan.village.toLowerCase().includes(search) ||
      loan.bill_no.toString().includes(search)
    );
  });

  const totalPending = pendingLoans.reduce((sum, loan) => sum + loan.balance_amount, 0);

  const openPaymentModal = async (bill) => {
    setSelectedBill(bill);
    setPaymentAmount("");
    setPaymentNotes("");
    setShowPaymentModal(true);

    // Fetch payment history
    try {
      const response = await axios.get(`${API}/loans/payments/${bill.id}`);
      setPaymentHistory(response.data);
    } catch (error) {
      console.error("Failed to fetch payment history:", error);
      setPaymentHistory([]);
    }
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > selectedBill.balance_amount) {
      toast.error("Amount exceeds balance");
      return;
    }

    try {
      await axios.post(`${API}/loans/payment`, {
        bill_id: selectedBill.id,
        amount: amount,
        notes: paymentNotes
      });
      toast.success("Payment recorded!");
      setShowPaymentModal(false);
      fetchPendingLoans();
    } catch (error) {
      toast.error("Failed to record payment");
    }
  };

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700"></div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="loans-page">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-800">Loans / Credit</h1>
          <p className="font-telugu text-slate-500">అప్పులు / బకాయి</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Pending Amount</p>
                <p className="font-telugu text-xs text-slate-500">మొత్తం బకాయి</p>
                <p className="font-heading text-3xl font-bold text-slate-800 mt-1">
                  ₹{totalPending.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">{pendingLoans.length} customers</p>
              <p className="font-telugu text-xs text-slate-500">కస్టమర్లు</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, village, or bill number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      {/* Loans Table */}
      <Card>
        <CardContent className="p-0">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Village</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">#{loan.bill_no}</TableCell>
                  <TableCell>{loan.customer_name}</TableCell>
                  <TableCell className="text-slate-600">{loan.village}</TableCell>
                  <TableCell className="text-slate-500">{formatDate(loan.date)}</TableCell>
                  <TableCell className="text-right">₹{loan.total_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">₹{loan.paid_amount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-red-600">₹{loan.balance_amount.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      className="bg-green-700 hover:bg-green-800"
                      onClick={() => openPaymentModal(loan)}
                    >
                      <IndianRupee className="w-4 h-4 mr-1" />
                      Collect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredLoans.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50 text-green-500" />
              <p>No pending loans!</p>
              <p className="font-telugu text-sm">అప్పులు ఏమీ లేవు</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              {/* Bill Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Bill #</span>
                  <span className="font-semibold">{selectedBill.bill_no}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Customer</span>
                  <span className="font-medium">{selectedBill.customer_name}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-600">Village</span>
                  <span>{selectedBill.village}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-red-600 font-semibold">Balance Due</span>
                  <span className="text-red-600 font-bold text-lg">
                    ₹{selectedBill.balance_amount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Payment History */}
              {paymentHistory.length > 0 && (
                <div>
                  <Label className="text-sm text-slate-600">Payment History</Label>
                  <div className="mt-2 max-h-32 overflow-auto space-y-2">
                    {paymentHistory.map((payment, idx) => (
                      <div key={idx} className="flex justify-between text-sm bg-green-50 p-2 rounded">
                        <span>{formatDate(payment.payment_date)}</span>
                        <span className="text-green-700 font-medium">₹{payment.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Form */}
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  max={selectedBill.balance_amount}
                />
              </div>
              <div>
                <Label>Notes (Optional)</Label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Any notes"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPaymentAmount(selectedBill.balance_amount.toString())}
                >
                  Full Amount
                </Button>
                <Button
                  onClick={handleRecordPayment}
                  className="flex-1 bg-green-700 hover:bg-green-800"
                >
                  Record Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoansPage;
