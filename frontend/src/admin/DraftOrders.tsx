import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  UserPlus, 
  Link as LinkIcon, 
  Copy, 
  CheckCircle2 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import Select from '../components/Select';
import { formatCurrency } from '../utils/currencies';

const API_URL = import.meta.env.VITE_API_URL || '';

const DraftOrders: React.FC = () => {
  const { getAuthHeaders, storeSettings } = useApp();
  
  // Steps: 1 - Select User, 2 - Add Products, 3 - Details & Generate, 4 - Success/Link
  const [step, setStep] = useState(1);
  
  // Selection States
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [cartItems, setCartItems] = useState<{ product: any, quantity: number, variant?: string | null }[]>([]);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [shippingDetails, setShippingDetails] = useState({
    name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', country: 'India'
  });

  // Search Data
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);

  // Result State
  const [generatedOrder, setGeneratedOrder] = useState<any | null>(null);
  const [paymentLink, setPaymentLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // User Search
  useEffect(() => {
    if (userSearch.length < 3) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/v1/admin/users?search=${userSearch}&limit=5`, { headers });
        const data = await res.json();
        if (data.success) setUsers(data.data);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, getAuthHeaders]);

  // Product Search
  useEffect(() => {
    if (productSearch.length < 2) {
      setProducts([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_URL}/api/v1/admin/products?search=${productSearch}&limit=5`, { headers });
        const data = await res.json();
        if (data.success) setProducts(data.data);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, getAuthHeaders]);

  const selectUser = (u: any) => {
    setSelectedUser(u);
    setShippingDetails({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      address: u.addresses?.[0]?.street || '',
      city: u.addresses?.[0]?.city || '',
      state: u.addresses?.[0]?.state || '',
      pincode: u.addresses?.[0]?.pincode || '',
      country: 'India'
    });
    setStep(2);
  };

  const continueAsGuest = () => {
    setSelectedUser(null);
    setShippingDetails({
      name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', country: 'India'
    });
    setStep(2);
  };

  const addToCart = (product: any) => {
    const defaultVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
    const exists = cartItems.find(item => item.product._id === product._id && item.variant === defaultVariant);
    if (exists) {
      setCartItems(cartItems.map(item => 
        (item.product._id === product._id && item.variant === defaultVariant)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCartItems([...cartItems, { product, quantity: 1, variant: defaultVariant }]);
    }
    setProductSearch('');
    setProducts([]);
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setCartItems(cartItems.map(item => item.product._id === id ? { ...item, quantity: qty } : item));
  };

  const removeItem = (id: string) => {
    setCartItems(cartItems.filter(item => item.product._id !== id));
  };

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
    const shipping = subtotal >= storeSettings.shippingThreshold ? 0 : storeSettings.shippingCost;
    const total = Math.max(0, subtotal + shipping - manualDiscount);
    return { subtotal, shipping, total };
  };

  const handleGenerateOrder = async () => {
    if (!selectedUser && (!shippingDetails.name || !shippingDetails.email)) {
      return toast.error("Name and Email are required for Guest Orders");
    }
    if (cartItems.length === 0) return toast.error("Cart is empty");
    if (!shippingDetails.address || !shippingDetails.pincode) return toast.error("Incomplete shipping details");

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const payload = {
        userId: selectedUser ? (selectedUser._id || selectedUser.uid) : undefined,
        items: cartItems.map(i => ({ productId: i.product._id, pid: i.product.pid, quantity: i.quantity, variant: i.variant || null })),
        shippingDetails,
        manualDiscount,
        notes,
        paymentMethod,
        paymentStatus: alreadyPaid ? 'paid' : 'pending'
      };

      // 1. Create Draft Order
      const res = await fetch(`${API_URL}/api/v1/admin/orders/draft`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      const order = data.data;
      setGeneratedOrder(order);

      // 2. Generate Payment Link
      if (paymentMethod === 'razorpay' && !alreadyPaid) {
        const linkRes = await fetch(`${API_URL}/api/v1/admin/orders/${order._id}/payment-link`, {
          method: 'POST',
          headers
        });
        const linkData = await linkRes.json();
        
        if (linkRes.ok && linkData.success) {
          setPaymentLink(linkData.data.paymentLink);
          toast.success("Draft order and payment link generated!");
        } else {
          toast.error("Order created, but payment link failed to generate.");
        }
      } else {
        toast.success(`Order created successfully! (${alreadyPaid ? 'Paid' : 'Pending'})`);
      }
      
      setStep(4);
    } catch (err: any) {
      toast.error(err.message || "Failed to create draft order");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    toast.success("Payment link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setStep(1);
    setSelectedUser(null);
    setCartItems([]);
    setManualDiscount(0);
    setNotes('');
    setPaymentMethod('razorpay');
    setAlreadyPaid(false);
    setShippingDetails({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', country: 'India' });
    setUserSearch('');
    setGeneratedOrder(null);
    setPaymentLink('');
  };

  const totals = calculateTotal();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif font-bold text-dark-red">Create Draft Order</h2>
        {step > 1 && step < 4 && (
          <button onClick={resetForm} className="text-sm font-bold text-grey-beige hover:text-dark-red">Cancel</button>
        )}
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center justify-between mb-8">
        {[
          { num: 1, label: 'Customer' },
          { num: 2, label: 'Products' },
          { num: 3, label: 'Review' },
          { num: 4, label: 'Link' }
        ].map((s, idx) => (
          <div key={s.num} className="flex flex-col items-center flex-1 relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-10 transition-colors ${
              step === s.num ? 'bg-dark-red text-white' : 
              step > s.num ? 'bg-green-500 text-white' : 'bg-silk-light text-grey-beige'
            }`}>
              {step > s.num ? <CheckCircle2 size={16} /> : s.num}
            </div>
            <span className={`text-xs mt-2 font-bold ${step >= s.num ? 'text-dark-red' : 'text-grey-beige'}`}>{s.label}</span>
            {idx < 3 && <div className={`absolute top-4 left-1/2 w-full h-0.5 ${step > s.num ? 'bg-green-500' : 'bg-silk-light'}`}></div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-silk-light shadow-sm min-h-[400px]">
        {/* STEP 1: Select Customer */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="font-bold text-lg text-dark-red">Select Customer</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text"
                placeholder="Search by name, email, or phone..."
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-silk-light rounded-2xl outline-none focus:border-dark-red/50 transition-colors"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              {users.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-silk-light rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                  {users.map(u => (
                    <div key={u._id} onClick={() => selectUser(u)} className="p-4 hover:bg-silk-light/30 cursor-pointer border-b border-silk-light last:border-0 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-dark-red">{u.name || u.displayName}</div>
                        <div className="text-sm text-grey-beige">{u.email} • {u.phone || 'No phone'}</div>
                      </div>
                      <UserPlus size={20} className="text-gray-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-grey-beige text-center">Type at least 3 characters to search for registered customers.</p>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="h-px bg-silk-light flex-1"></div>
              <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">OR</span>
              <div className="h-px bg-silk-light flex-1"></div>
            </div>

            <button 
              onClick={continueAsGuest}
              className="w-full mt-6 py-4 rounded-2xl border-2 border-dashed border-silk-light text-grey-beige font-bold hover:border-dark-red hover:text-dark-red hover:bg-silk-light/10 transition-colors"
            >
              Continue as Guest Customer
            </button>
          </div>
        )}

        {/* STEP 2: Add Products */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-dark-red">Add Products</h3>
                <p className="text-sm text-grey-beige">Customer: <span className="font-bold">{selectedUser?.name || selectedUser?.email}</span></p>
              </div>
              <button onClick={() => setStep(3)} disabled={cartItems.length === 0} className="px-6 py-2.5 bg-dark-red text-white rounded-xl font-bold hover:bg-ruby-red transition-colors disabled:opacity-50">
                Continue to Review
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Search products to add..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/50"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              {products.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-silk-light rounded-xl shadow-lg z-10 max-h-64 overflow-y-auto">
                  {products.map(p => (
                    <div key={p._id} onClick={() => addToCart(p)} className="p-3 hover:bg-silk-light/30 cursor-pointer border-b border-silk-light last:border-0 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover rounded bg-gray-100" />}
                        <div>
                          <div className="font-bold text-dark-red text-sm">{p.name}</div>
                          <div className="text-xs text-grey-beige">Stock: {p.stock}</div>
                        </div>
                      </div>
                      <div className="font-bold text-dark-red">{formatCurrency(p.price)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 ? (
              <div className="border border-silk-light rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-silk-light">
                    <tr>
                      <th className="p-3 font-bold text-grey-beige uppercase">Product</th>
                      <th className="p-3 font-bold text-grey-beige uppercase w-24">Price</th>
                      <th className="p-3 font-bold text-grey-beige uppercase w-32">Qty</th>
                      <th className="p-3 font-bold text-grey-beige uppercase w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-silk-light">
                    {cartItems.map(item => (
                      <tr key={item.product._id}>
                        <td className="p-3 font-medium text-dark-red">{item.product.name}</td>
                        <td className="p-3">{formatCurrency(item.product.price)}</td>
                        <td className="p-3">
                          <input 
                            type="number" min="1" max={item.product.stock}
                            className="w-16 p-1 border border-silk-light rounded text-center outline-none"
                            value={item.quantity}
                            onChange={e => updateQuantity(item.product._id, parseInt(e.target.value) || 1)}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => removeItem(item.product._id)} className="text-gray-400 hover:text-red-500">
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400 border border-dashed border-silk-light rounded-xl">
                Cart is empty. Search above to add products.
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Review & Details */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="font-bold text-lg text-dark-red mb-4">Review Order Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-grey-beige uppercase tracking-wider">Shipping Address</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input type="text" placeholder="Full Name" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.name} onChange={e => setShippingDetails({...shippingDetails, name: e.target.value})} />
                  </div>
                  <div>
                    <input type="email" placeholder="Email" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.email} onChange={e => setShippingDetails({...shippingDetails, email: e.target.value})} />
                  </div>
                  <div>
                    <input type="tel" placeholder="Phone" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.phone} onChange={e => setShippingDetails({...shippingDetails, phone: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <input type="text" placeholder="Street Address" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.address} onChange={e => setShippingDetails({...shippingDetails, address: e.target.value})} />
                  </div>
                  <div>
                    <input type="text" placeholder="City" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.city} onChange={e => setShippingDetails({...shippingDetails, city: e.target.value})} />
                  </div>
                  <div>
                    <input type="text" placeholder="State" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.state} onChange={e => setShippingDetails({...shippingDetails, state: e.target.value})} />
                  </div>
                  <div>
                    <input type="text" placeholder="Pincode" className="w-full p-2.5 bg-gray-50 border border-silk-light rounded-lg text-sm" value={shippingDetails.pincode} onChange={e => setShippingDetails({...shippingDetails, pincode: e.target.value})} />
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="font-bold text-sm text-grey-beige uppercase tracking-wider mb-2">Admin Notes (Internal)</h4>
                  <textarea className="w-full p-3 bg-gray-50 border border-silk-light rounded-lg text-sm outline-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)}></textarea>
                </div>
                
                <div className="pt-2">
                  <h4 className="font-bold text-sm text-grey-beige uppercase tracking-wider mb-2">Payment Details</h4>
                  <div className={`grid grid-cols-1 ${alreadyPaid ? '' : 'sm:grid-cols-2'} gap-4`}>
                    {!alreadyPaid && (
                      <Select
                        value={paymentMethod}
                        onChange={val => setPaymentMethod(val as string)}
                        options={[
                          { value: 'razorpay', label: 'Razorpay (Send Link)' },
                          { value: 'cash_on_delivery', label: 'Cash on Delivery (COD)' },
                          { value: 'bank_transfer', label: 'Bank Transfer / UPI' }
                        ]}
                      />
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer p-2.5 bg-gray-50 border border-silk-light rounded-lg">
                      <input type="checkbox" checked={alreadyPaid} onChange={e => setAlreadyPaid(e.target.checked)} className="rounded border-gray-300 text-dark-red focus:ring-dark-red" />
                      Mark as Already Paid
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border border-silk-light h-fit">
                <h4 className="font-bold text-sm text-grey-beige uppercase tracking-wider mb-4">Order Summary</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items ({cartItems.length})</span>
                    <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">{totals.shipping === 0 ? 'Free' : formatCurrency(totals.shipping)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-gray-600">Manual Discount (₹)</span>
                    <input 
                      type="number" 
                      min="0"
                      className="w-24 p-1.5 border border-silk-light rounded text-right outline-none bg-white"
                      value={manualDiscount}
                      onChange={e => setManualDiscount(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200 font-bold text-lg text-dark-red">
                    <span>Total</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>

                <button 
                  onClick={handleGenerateOrder}
                  disabled={loading}
                  className="w-full mt-6 py-3 bg-dark-red text-white rounded-xl font-bold hover:bg-ruby-red transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : <><LinkIcon size={18} /> Generate Link & Order</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Success & Payment Link */}
        {step === 4 && generatedOrder && (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-serif font-bold text-dark-red">Draft Order Created!</h3>
              <p className="text-gray-600 mt-2">Order ID: <span className="font-mono font-bold text-dark-red">{generatedOrder._id}</span></p>
              <p className="text-sm text-grey-beige mt-1">
                {alreadyPaid ? 'Order has been marked as paid and inventory is reserved.' : 'Inventory has been reserved. Waiting for payment.'}
              </p>
            </div>

            {paymentMethod === 'razorpay' && !alreadyPaid ? (
              paymentLink ? (
                <div className="max-w-md mx-auto bg-gray-50 border border-silk-light p-6 rounded-2xl mt-8">
                  <p className="text-sm font-bold text-grey-beige mb-3 uppercase tracking-wider">Razorpay Payment Link</p>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={paymentLink} className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-medium" />
                    <button onClick={copyToClipboard} className="p-3 bg-dark-red text-white rounded-xl hover:bg-ruby-red transition-colors" title="Copy Link">
                      {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">This link will expire in 24 hours. A notification may have been sent by Razorpay depending on their settings.</p>
                </div>
              ) : (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium mt-6">
                  Order created, but payment link generation failed. You may need to create it manually in the Razorpay Dashboard.
                </div>
              )
            ) : (
              <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-medium mt-6 border border-green-200">
                Success! The order has been saved successfully without a Razorpay link.
              </div>
            )}

            <button onClick={resetForm} className="mt-8 text-dark-red font-bold hover:underline">
              Create Another Draft Order
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftOrders;
