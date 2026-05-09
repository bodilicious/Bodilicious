import { useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface ShippingAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  email?: string;
}

interface LabelProps {
  order: {
    _id: string;
    shippingDetails: ShippingAddress;
    totalAmount: number;
    paymentMethod: string;
    items?: any[];
  } | null;
  onClose: () => void;
}

export default function ShippingLabel({ order, onClose }: LabelProps) {
  const labelRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    const content = labelRef.current?.innerHTML;
    if (!content) return;

    const printWin = window.open('', '_blank', 'width=600,height=400');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shipping Label - #${order._id.slice(-8).toUpperCase()}</title>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          @page { size: 100mm 150mm; margin: 0; }
          .label { width: 100mm; min-height: 150mm; padding: 8mm; box-sizing: border-box; border: 1px solid #000; }
          .header { border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 4mm; display: flex; align-items: center; justify-content: space-between; }
          .brand { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
          .order-id { font-size: 11px; color: #555; }
          .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 1mm; }
          .recipient { margin: 4mm 0; }
          .recipient-name { font-size: 16px; font-weight: bold; }
          .address { font-size: 12px; line-height: 1.6; }
          .footer { border-top: 1px dashed #ccc; padding-top: 3mm; margin-top: 4mm; font-size: 10px; color: #555; display: flex; justify-content: space-between; }
          .barcode-placeholder { text-align: center; margin: 4mm 0; font-size: 9px; border: 1px solid #eee; padding: 2mm; color: #aaa; letter-spacing: 3px; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
  };

  const { shippingDetails: sd } = order;
  const orderId = order._id.slice(-8).toUpperCase();
  const isCOD = order.paymentMethod === 'cod';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Shipping Label Preview</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Label Preview */}
        <div className="p-5">
          <div ref={labelRef} className="label border-2 border-gray-800 rounded-lg p-5 font-mono" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="header flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-3">
              <div>
                <div className="brand text-xl font-bold tracking-widest" style={{ letterSpacing: '3px' }}>BODILICIOUS</div>
                <div className="text-[10px] text-gray-500">bodilicious.com</div>
              </div>
              {isCOD && (
                <div className="text-right">
                  <div className="bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded">COD</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">₹{order.totalAmount.toFixed(0)}</div>
                </div>
              )}
            </div>

            {/* Recipient */}
            <div className="recipient mb-3">
              <div className="section-title text-[9px] text-gray-400 uppercase tracking-widest mb-1">Deliver To</div>
              <div className="recipient-name text-lg font-bold">{sd.name}</div>
              <div className="address text-xs leading-relaxed text-gray-700 mt-1">
                {sd.address}<br />
                {sd.city}, {sd.state} – {sd.pincode}<br />
                📞 {sd.phone}
                {sd.email && <><br />✉️ {sd.email}</>}
              </div>
            </div>

            {/* Barcode placeholder */}
            <div className="barcode-placeholder text-center text-[9px] text-gray-300 border border-dashed border-gray-200 py-2 my-3 tracking-widest">
              ||||| {orderId} |||||
            </div>

            {/* Footer */}
            <div className="footer flex items-center justify-between border-t border-dashed border-gray-300 pt-3 mt-1">
              <div className="text-[9px] text-gray-400">
                <div className="font-bold">Order ID</div>
                <div>#{orderId}</div>
              </div>
              <div className="text-[9px] text-gray-400 text-right">
                <div className="font-bold">Items</div>
                <div>{order.items?.length ?? '—'} item(s)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-dark-red text-white text-sm font-semibold hover:bg-ruby-red transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={15} />
            Print Label
          </button>
        </div>
      </div>
    </div>
  );
}
