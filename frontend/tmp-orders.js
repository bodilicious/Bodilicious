const fs = require('fs');
const path = require('path');

// Edit TrackingPage.tsx
const trackingPath = path.join('c:/Users/admin/Desktop/Bodilicious/frontend/src/pages/TrackingPage.tsx');
let tracking = fs.readFileSync(trackingPath, 'utf8');

tracking = tracking.replace(
  "import { Package, ArrowLeft, AlertCircle, RefreshCw, Calendar, CreditCard, FileText, Trash2 } from 'lucide-react';",
  "import { Package, ArrowLeft, AlertCircle, RefreshCw, Calendar, CreditCard, FileText } from 'lucide-react';"
);

tracking = tracking.replace(
  "const { navigateTo, getAuthHeaders, orders, cancelOrder, deleteOrder } = useApp();",
  "const { navigateTo, getAuthHeaders, orders, cancelOrder } = useApp();"
);

tracking = tracking.replace(
  "const [isDeleting, setIsDeleting] = useState(false);",
  ""
);

// Remove handleDeleteOrder block. Using regex to grab exactly what we need
tracking = tracking.replace(/const handleDeleteOrder = async \(\) => {[\s\S]*?setIsDeleting\(false\);\s*};/, "");

// Replace disabled state
tracking = tracking.replace(/disabled=\{isCancelling \|\| isDeleting\}/g, "disabled={isCancelling}");

// Remove Clear Order button
tracking = tracking.replace(/\{\(selectedOrder\.orderStatus === 'cancelled' \|\| selectedOrder\.orderStatus === 'delivered'\) && \([\s\S]*?<\/button>\s*\)\}/, "");

fs.writeFileSync(trackingPath, tracking, 'utf8');
console.log('TrackingPage updated.');

// Edit OrderDetailsPage.tsx
const detailsPath = path.join('c:/Users/admin/Desktop/Bodilicious/frontend/src/pages/OrderDetailsPage.tsx');
let details = fs.readFileSync(detailsPath, 'utf8');

const returnTarget = `{order.orderStatus === 'delivered' && order.returnStatus === 'none' && (
                                    <button onClick={() => setIsReturnModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-sans tracking-widest uppercase text-orange-600 bg-white border border-orange-200 hover:bg-orange-50 transition-colors shadow-sm">
                                        Return Order
                                    </button>
                                )}`;

const returnReplacement = `{(() => {
                                    if (order.orderStatus !== 'delivered' || order.returnStatus !== 'none') return false;
                                    const deliveryDateStr = (order as any).updatedAt || order.estimatedDeliveryDate;
                                    const deliveryDate = deliveryDateStr ? new Date(deliveryDateStr) : new Date(order.createdAt);
                                    const daysSinceDelivery = (Date.now() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
                                    return daysSinceDelivery <= 7;
                                })() && (
                                    <button onClick={() => setIsReturnModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-sans tracking-widest uppercase text-orange-600 bg-white border border-orange-200 hover:bg-orange-50 transition-colors shadow-sm">
                                        Return Order
                                    </button>
                                )}`;

details = details.replace(returnTarget, returnReplacement);
// Need logic for CRLF fallback if pure string match fails
if (!details.includes(returnReplacement)) {
    // Regex fallback for OrderDetails
    const regex = /\{\s*order\.orderStatus === 'delivered' && order\.returnStatus === 'none' && \(\s*<button onClick=\{\(\) => setIsReturnModalOpen\(true\)\} className="flex items-center gap-2 px-4 py-2 text-xs font-sans tracking-widest uppercase text-orange-600 bg-white border border-orange-200 hover:bg-orange-50 transition-colors shadow-sm">\s*Return Order\s*<\/button>\s*\)\s*\}/;
    details = details.replace(regex, returnReplacement);
}

fs.writeFileSync(detailsPath, details, 'utf8');
console.log('OrderDetailsPage updated.');
