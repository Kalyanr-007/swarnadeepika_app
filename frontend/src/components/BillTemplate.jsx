import { format } from "date-fns";

const BillTemplate = ({ bill, shopInfo }) => {
  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), "dd-MM-yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bill-template p-6 bg-white max-w-2xl mx-auto" style={{ fontFamily: "'Inter', monospace" }}>
      {/* Header */}
      <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
        {/* Top Info Row */}
        <div className="flex justify-between text-xs mb-2">
          <div className="text-left">
            <p><strong>GSTIN:</strong> {shopInfo.gstin}</p>
            <p><strong>PL.No:</strong> {shopInfo.pl_no}</p>
          </div>
          <div className="text-center">
            <span className={`px-3 py-1 rounded text-white ${bill.payment_type === 'cash' ? 'bg-green-600' : 'bg-yellow-600'}`}>
              {bill.payment_type === 'cash' ? 'Cash Bill' : 'Credit Bill'}
            </span>
          </div>
          <div className="text-right">
            <p><strong>Cell:</strong> {shopInfo.phone1}</p>
            <p>{shopInfo.phone2}</p>
          </div>
        </div>

        {/* Shop Name */}
        <h1 className="font-telugu text-2xl font-bold text-slate-800 mt-3">
          {shopInfo.name_telugu}
        </h1>
        <h2 className="font-heading text-lg font-semibold text-slate-700">
          {shopInfo.name_english}
        </h2>
        <p className="font-telugu text-sm text-slate-600 mt-1">
          {shopInfo.address}
        </p>
      </div>

      {/* Bill Info */}
      <div className="flex justify-between mb-4 text-sm">
        <div>
          <p><strong>Bill No:</strong> <span className="text-red-600 font-bold">{bill.bill_no}</span></p>
          <p><strong>Sri:</strong> {bill.customer_name}</p>
        </div>
        <div className="text-right">
          <p><strong>Date:</strong> {formatDate(bill.date)}</p>
          <p><strong>Village:</strong> {bill.village}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="bill-table w-full border-collapse mb-4">
        <thead>
          <tr>
            <th className="w-8">Sr</th>
            <th>Particulars of Products</th>
            <th className="w-20">Batch/Vat.No</th>
            <th className="w-20">Mfg Date</th>
            <th className="w-20">Exp Date</th>
            <th className="w-12">Pkg</th>
            <th className="w-12">Qty</th>
            <th className="w-16">Rate</th>
            <th className="w-20">Amount Rs. Ps.</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, index) => (
            <tr key={index}>
              <td className="text-center">{index + 1}</td>
              <td>{item.product_name}</td>
              <td className="text-center">{item.batch_no}</td>
              <td className="text-center">{formatDate(item.mfg_date)}</td>
              <td className="text-center">{formatDate(item.exp_date)}</td>
              <td className="text-center">{item.unit}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{item.rate.toFixed(2)}</td>
              <td className="text-right">{item.amount.toFixed(2)}</td>
            </tr>
          ))}
          {/* Empty rows to maintain table height */}
          {[...Array(Math.max(0, 8 - bill.items.length))].map((_, i) => (
            <tr key={`empty-${i}`}>
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total Section */}
      <div className="border-t-2 border-slate-800 pt-3">
        <div className="flex justify-end">
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="pr-4 text-right font-semibold">GST Including Total Amount:</td>
                <td className="text-right font-bold text-lg">₹ {bill.total_amount.toFixed(2)}</td>
              </tr>
              {bill.payment_type === 'credit' && (
                <>
                  <tr>
                    <td className="pr-4 text-right">Amount Paid:</td>
                    <td className="text-right">₹ {bill.paid_amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td className="pr-4 text-right font-semibold text-red-600">Balance Due:</td>
                    <td className="text-right font-bold text-red-600">₹ {bill.balance_amount.toFixed(2)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-300">
        <p className="font-telugu text-xs text-center text-slate-600">
          అమ్మిన సరుకు వాపసు తీసుకోబడదు
        </p>
        <p className="font-telugu text-xs text-center text-slate-600">
          పై మందులు నా వ్యవసాయ నిమిత్తమై ఖరీదు చేసితిని.
        </p>
        
        <div className="flex justify-between mt-6 text-sm">
          <div>
            <p className="font-semibold">Customer's Signature</p>
            <div className="w-32 border-b border-slate-400 mt-8"></div>
          </div>
          <div className="text-right">
            <p className="font-semibold">Signature</p>
            <div className="w-32 border-b border-slate-400 mt-8 ml-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillTemplate;
