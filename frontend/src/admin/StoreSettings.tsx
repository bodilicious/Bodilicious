import React, { useEffect, useState, useCallback } from 'react';
import { Settings, Save, AlertCircle, AlertTriangle, Info, X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import Select from '../components/Select';

const API_URL = import.meta.env.VITE_API_URL || '';

// ─── Reusable Toggle Row ─────────────────────────────────────────────────────
function ToggleRow({
  label, description, checked, onChange, danger = false
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 border border-silk-light rounded-xl bg-gray-50">
      <div className="flex-1 pr-4">
        <h4 className={`font-bold ${danger ? 'text-red-700' : 'text-gray-800'}`}>{label}</h4>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${danger ? 'peer-checked:bg-red-600' : 'peer-checked:bg-dark-red'}`}></div>
      </label>
    </div>
  );
}

// ─── Tag Input ───────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');

  const addTag = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput('');
    }
  }, [input, tags, onChange]);

  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[36px]">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 bg-dark-red/10 text-dark-red text-xs font-bold px-2.5 py-1 rounded-full">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-700 transition-colors">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="Type a reason and press Enter..."
          className="flex-1 p-2.5 bg-gray-50 border border-silk-light rounded-xl outline-none text-sm"
        />
        <button type="button" onClick={addTag} className="px-3 py-2 bg-dark-red text-white rounded-xl hover:bg-ruby-red transition-colors">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Callout ─────────────────────────────────────────────────────────────────
function Callout({ type, children }: { type: 'warning' | 'info' | 'danger'; children: React.ReactNode }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  };
  const Icon = type === 'warning' ? AlertTriangle : type === 'danger' ? AlertCircle : Info;
  return (
    <div className={`flex items-start gap-3 border p-4 rounded-xl text-sm ${styles[type]}`}>
      <Icon size={18} className="shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-silk-light shadow-sm">
      <h3 className="font-bold text-lg text-dark-red mb-6 border-b border-silk-light pb-4">{title}</h3>
      {children}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full p-3 bg-gray-50 border border-silk-light rounded-xl outline-none focus:border-dark-red/40 transition-colors";

// ─── Default Form State ───────────────────────────────────────────────────────
const defaultForm = {
  // 1. General
  storeName: 'Bodilicious', supportEmail: 'bodiliciousnaturalproducts@gmail.com', supportPhone: '+91 9894451947', storeAddress: '',
  currency: 'INR', timezone: 'Asia/Kolkata',
  // Notifications (Master Switches)
  waAllEnabled: true, emailAllEnabled: true,
  // Notifications (WhatsApp)
  waOrderPlacedEnabled: true, waStaleCartEnabled: true, waOutForDeliveryEnabled: true,
  waTicketRaisedEnabled: true, waTicketResolvedEnabled: true, waTrendingProductsEnabled: true,
  waReEngagementEnabled: true, waPaymentFailureEnabled: true,
  // Notifications (Email)
  notifyAdminOnOrder: true, sendOrderConfirmationToCustomer: true,
  emailReturnApproved: true, emailReturnRejected: true, emailTicketRaised: true,
  emailTicketReply: true, emailTicketResolved: true, emailTicketCancelled: true,

  // System
  maintenanceMode: false, maintenanceMessage: 'We are currently updating our store. Please check back soon!',
  maintenanceBypassSecret: '', lastUpdatedBy: null as string | null, lastUpdatedAt: null as string | null,

  // 2. Orders & Invoicing
  invoicePrefix: 'BOD-', orderIdStartFrom: 1000, gstNumber: '', panNumber: '', businessType: 'Sole Proprietor',
  codEnabled: true, codExtraCharge: 0, minOrderValueForCOD: 0,
  lowStockThreshold: 10,

  // 3. Shipping
  shippingThreshold: 999, shippingCost: 99, taxRatePercent: 18,
  // Cold Chain
  fragilePackagingSurchargeEnabled: false, fragilePackagingSurcharge: 0,
  showEstimatedDeliveryDate: true, averageDeliveryDays: 5,
  pincodeCheckEnabled: false, pincodeServiceabilitySource: 'manual',
  temperatureSensitiveWarningEnabled: true,

  // 4. Returns & Refunds
  returnWindowDays: 7,
  allowReturnOpened: false, allowReturnUnopened: true,
  requirePhotoForReturn: true,
  adverseReactionReturnEnabled: true, adverseReactionWindowDays: 14,
  refundMethod: 'original' as 'original' | 'store_credit' | 'both',
  returnReasonTags: [
    'Wrong Product', 'Adverse Reaction', 'Damaged in Transit',
    'Product Not as Described', 'Changed Mind', 'Expired / Near Expiry', 'Packaging Defect'
  ] as string[],

  // 5. Best Sellers
  bestSellerPids: [] as string[],

  // 6. Customer Experience
  // Skin Profile
  skinQuizEnabled: true, routineBuilderEnabled: false,
  productCompatibilityWarningsEnabled: true, storeSkinProfileOnAccount: true,
  // Reviews
  reviewSkinTypeTaggingEnabled: true, reviewBeforeAfterPhotosEnabled: true,
  reviewVerifiedBadgeEnabled: true, reviewModerationEnabled: true,
  reviewIncentiveEnabled: false, reviewIncentiveDiscountPercent: 10,

  // 7. Storefront
  announcementBar: { text: '', isActive: false, link: '' },
  launchModal: { isActive: false, badge: '', title: '', description: '', ctaLabel: '', ctaLink: '', image: '' },
  socialLinks: { instagram: '', facebook: '', twitter: '', youtube: '' },
  seoMeta: { title: 'Bodilicious', description: 'Premium skincare and wellness products', ogImage: '' },
};

type FormState = typeof defaultForm;

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'orders', label: 'Orders & Invoicing' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'returns', label: 'Returns & Refunds' },
  { id: 'bestsellers', label: 'Best Sellers' },
  { id: 'experience', label: 'Customer Experience' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'storefront', label: 'Storefront' },
];

export default function StoreSettings() {
  const { getAuthHeaders } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  // Best sellers product search state
  const [allProducts, setAllProducts] = useState<{ pid: string; name: string; images?: string[] }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchAllProducts();
    // eslint-disable-next-line
  }, []);

  const fetchSettings = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings`, { headers });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        const merged: FormState = {
          ...defaultForm,
          ...d,
          announcementBar: { ...defaultForm.announcementBar, ...(d.announcementBar || {}) },
          launchModal: { ...defaultForm.launchModal, ...(d.launchModal || {}) },
          socialLinks: { ...defaultForm.socialLinks, ...(d.socialLinks || {}) },
          seoMeta: { ...defaultForm.seoMeta, ...(d.seoMeta || {}) },
          returnReasonTags: Array.isArray(d.returnReasonTags) ? d.returnReasonTags : defaultForm.returnReasonTags,
          bestSellerPids: Array.isArray(d.bestSellerPids) ? d.bestSellerPids : [],
        };
        setForm(merged);
        setIsDirty(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/products?limit=500`);
      const json = await res.json();
      if (json.data) setAllProducts(json.data);
    } catch (err) {
      console.error('Failed to fetch products for best sellers picker');
    } finally {
      setProductsLoading(false);
    }
  };

  const set = (field: keyof FormState, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const setNested = (parent: keyof FormState, field: string, value: any) => {
    setForm(prev => ({ ...prev, [parent]: { ...(prev[parent] as any), [field]: value } }));
    setIsDirty(true);
  };

  const handleTabChange = (tabId: string) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. They will be preserved across tabs until you save or refresh. Continue?')) return;
    }
    setActiveTab(tabId);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings`, { method: 'PUT', headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings saved!');
        setIsDirty(false);
        fetchSettings();
      } else {
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (err) {
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchModalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const uploadToast = toast.loading('Uploading image...');
    try {
      const headers = await getAuthHeaders();
      delete (headers as any)['Content-Type']; 
      const payload = new FormData();
      payload.append('image', file);
      const res = await fetch(`${API_URL}/api/v1/admin/upload`, { method: 'POST', headers, body: payload });
      const data = await res.json();
      if (res.ok && data.success) {
        setNested('launchModal', 'image', data.path);
        toast.success(`Image uploaded successfully`, { id: uploadToast });
      } else {
        toast.error('Error uploading image', { id: uploadToast });
      }
    } catch (err) {
      toast.error('Error uploading image', { id: uploadToast });
    }
  };

  const handleOGImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const uploadToast = toast.loading('Uploading OG Image...');
    try {
      const headers = await getAuthHeaders();
      delete (headers as any)['Content-Type']; 
      const payload = new FormData();
      payload.append('image', file);
      const res = await fetch(`${API_URL}/api/v1/admin/upload`, { method: 'POST', headers, body: payload });
      const data = await res.json();
      if (res.ok && data.success) {
        setNested('seoMeta', 'ogImage', data.path);
        toast.success(`OG Image uploaded successfully`, { id: uploadToast });
      } else {
        toast.error('Error uploading image', { id: uploadToast });
      }
    } catch (err) {
      toast.error('Error uploading image', { id: uploadToast });
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <span className="text-gray-500 font-sans tracking-wider uppercase text-sm">Loading Settings...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Settings className="text-dark-red" size={28} />
          <h2 className="text-2xl font-serif font-bold text-dark-red">Settings</h2>
        </div>
        {isDirty && (
          <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
            <AlertTriangle size={16} /> Unsaved Changes
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-56 shrink-0 bg-white rounded-3xl p-4 shadow-sm border border-silk-light space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors font-bold text-sm ${
                activeTab === tab.id ? 'bg-dark-red text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full">
          <form onSubmit={handleSave} className="space-y-6">

            {/* ── 1. GENERAL ──────────────────────────────── */}
            {activeTab === 'general' && (
              <div className="space-y-6">


                <Card title="Maintenance Mode">
                  <div className="space-y-4">
                    <ToggleRow label="Maintenance Mode" description="Takes the storefront offline for all non-admin visitors." checked={form.maintenanceMode} onChange={v => set('maintenanceMode', v)} danger />
                    {form.maintenanceMode && (
                      <Callout type="danger">Maintenance mode is ON. Customers cannot access the storefront. The admin panel remains accessible.</Callout>
                    )}
                    <Field label="Maintenance Message"><textarea className={`${inputCls} h-20`} value={form.maintenanceMessage} onChange={e => set('maintenanceMessage', e.target.value)} /></Field>
                    <Field label="Bypass Secret (Query Param)">
                      <input type="text" placeholder="e.g. preview-secret-2024" className={inputCls} value={form.maintenanceBypassSecret} onChange={e => set('maintenanceBypassSecret', e.target.value)} />
                      <p className="text-xs text-gray-500 mt-2">Access the live site via <code className="bg-gray-100 px-1 rounded">/?preview=YOUR_SECRET</code> to bypass the maintenance wall.</p>
                    </Field>
                  </div>
                </Card>

                <div className="bg-gray-50 p-6 rounded-3xl border border-silk-light flex flex-col gap-1 text-sm text-gray-500">
                  <h4 className="font-bold text-gray-800 mb-2">Audit Information</h4>
                  <p><strong>Last Updated At:</strong> {form.lastUpdatedAt ? new Date(form.lastUpdatedAt).toLocaleString() : 'Never'}</p>
                  <p><strong>Last Updated By (UID):</strong> {form.lastUpdatedBy || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* ── 2. ORDERS & INVOICING ────────────────────── */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <Card title="Orders & Invoicing">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Invoice Prefix"><input type="text" className={inputCls} value={form.invoicePrefix} onChange={e => set('invoicePrefix', e.target.value)} placeholder="e.g. BOD-" /></Field>
                    <Field label="Order ID Start From"><input type="number" className={inputCls} value={form.orderIdStartFrom} onChange={e => set('orderIdStartFrom', Number(e.target.value))} /></Field>
                    <Field label="GST Number"><input type="text" className={inputCls} value={form.gstNumber} onChange={e => set('gstNumber', e.target.value)} /></Field>
                    <Field label="PAN Number"><input type="text" className={inputCls} value={form.panNumber} onChange={e => set('panNumber', e.target.value)} /></Field>
                    <Field label="Business Type">
                      <Select
                        value={form.businessType}
                        onChange={val => set('businessType', val as string)}
                        options={[
                          { value: 'Sole Proprietor', label: 'Sole Proprietor' },
                          { value: 'LLP', label: 'LLP' },
                          { value: 'Pvt Ltd', label: 'Pvt Ltd' }
                        ]}
                      />
                    </Field>
                    <Field label="Low Stock Alert Threshold">
                      <input type="number" min="0" className={inputCls} value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', Number(e.target.value))} />
                    </Field>
                  </div>
                </Card>

                <Card title="Cash on Delivery (COD)">
                  <div className="space-y-4">
                    <ToggleRow label="Enable COD" description="Allow customers to pay on delivery." checked={form.codEnabled} onChange={v => set('codEnabled', v)} />
                    {form.codEnabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <Field label="COD Extra Charge (₹)"><input type="number" min="0" className={inputCls} value={form.codExtraCharge} onChange={e => set('codExtraCharge', Number(e.target.value))} /></Field>
                        <Field label="Min Order Value for COD (₹)"><input type="number" min="0" className={inputCls} value={form.minOrderValueForCOD} onChange={e => set('minOrderValueForCOD', Number(e.target.value))} /></Field>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ── 3. SHIPPING ──────────────────────────────── */}
            {activeTab === 'shipping' && (
              <div className="space-y-6">
                <Card title="Shipping & Taxes">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Free Shipping Threshold (₹)"><input type="number" min="0" className={inputCls} value={form.shippingThreshold} onChange={e => set('shippingThreshold', Number(e.target.value))} /></Field>
                    <Field label="Standard Shipping Cost (₹)"><input type="number" min="0" className={inputCls} value={form.shippingCost} onChange={e => set('shippingCost', Number(e.target.value))} /></Field>
                    <Field label="Tax Rate Percent (%)"><input type="number" min="0" max="100" className={inputCls} value={form.taxRatePercent} onChange={e => set('taxRatePercent', Number(e.target.value))} /></Field>
                  </div>
                  <div className="mt-6">
                    <Callout type="warning">Changing these values will immediately affect new orders. Existing orders are unaffected.</Callout>
                  </div>
                </Card>

                <Card title="Cold Chain & Delivery">
                  <div className="space-y-4">
                    <ToggleRow label="Temperature-Sensitive Product Warning" description="Show a summer heat warning banner for heat-sensitive products (Vitamin C serums, retinols)." checked={form.temperatureSensitiveWarningEnabled} onChange={v => set('temperatureSensitiveWarningEnabled', v)} />
                    <ToggleRow label="Show Estimated Delivery Date" description="Display an estimated delivery date on product and checkout pages. Reduces 'where is my order' tickets." checked={form.showEstimatedDeliveryDate} onChange={v => set('showEstimatedDeliveryDate', v)} />
                    {form.showEstimatedDeliveryDate && (
                      <Field label="Average Delivery Days">
                        <input type="number" min="1" className={inputCls} value={form.averageDeliveryDays} onChange={e => set('averageDeliveryDays', Number(e.target.value))} />
                      </Field>
                    )}
                    <ToggleRow label="Fragile Packaging Surcharge" description="Charge extra for items that require special packaging (glass bottles, dropper serums)." checked={form.fragilePackagingSurchargeEnabled} onChange={v => set('fragilePackagingSurchargeEnabled', v)} />
                    {form.fragilePackagingSurchargeEnabled && (
                      <div className="space-y-3">
                        <Field label="Surcharge Amount (₹)"><input type="number" min="0" className={inputCls} value={form.fragilePackagingSurcharge} onChange={e => set('fragilePackagingSurcharge', Number(e.target.value))} /></Field>
                        <Callout type="info">This surcharge requires a product-level <code className="font-mono text-xs bg-blue-100 px-1 rounded">isFragile</code> flag on individual products to take effect. Add this to the product schema before enabling.</Callout>
                      </div>
                    )}
                    <ToggleRow label="Pincode Serviceability Check" description="Validate delivery coverage before checkout." checked={form.pincodeCheckEnabled} onChange={v => set('pincodeCheckEnabled', v)} />
                    {form.pincodeCheckEnabled && (
                      <div className="space-y-3">
                        <Field label="Serviceability Data Source">
                          <Select
                            value={form.pincodeServiceabilitySource}
                            onChange={val => set('pincodeServiceabilitySource', val as string)}
                            options={[
                              { value: 'manual', label: 'Manual (upload pincode list)' },
                              { value: 'shiprocket', label: 'Shiprocket API' },
                              { value: 'delhivery', label: 'Delhivery API' }
                            ]}
                          />
                        </Field>
                        <Callout type="info">Pincode checking requires API credentials or a pincode list to be configured separately. Enabling this toggle without a data source will block all checkouts.</Callout>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ── 4. RETURNS & REFUNDS ─────────────────────── */}
            {activeTab === 'returns' && (
              <div className="space-y-6">
                <Card title="Return Policy">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                      <Field label="Standard Return Window (Days)">
                        <input type="number" min="0" className={inputCls} value={form.returnWindowDays} onChange={e => set('returnWindowDays', Number(e.target.value))} />
                      </Field>
                      <Field label="Refund Method">
                        <Select
                          value={form.refundMethod}
                          onChange={val => set('refundMethod', val as any)}
                          options={[
                            { value: 'original', label: 'Refund to Original Payment Source' },
                            { value: 'store_credit', label: 'Store Credit Only' },
                            { value: 'both', label: "Customer's Choice (Original or Store Credit)" }
                          ]}
                        />
                      </Field>
                    </div>
                    <ToggleRow label="Allow Returns on Unopened Products" description="Standard return policy — product must be in original sealed condition." checked={form.allowReturnUnopened} onChange={v => set('allowReturnUnopened', v)} />
                    <ToggleRow label="Allow Returns on Opened Products" description="Skincare-sensitive policy. Enable with caution — opened products carry hygiene risk." checked={form.allowReturnOpened} onChange={v => set('allowReturnOpened', v)} />
                    <ToggleRow label="Require Photo for Return Requests" description="Customers must upload a photo of the product to submit a return. Prevents abuse while protecting legitimate claims." checked={form.requirePhotoForReturn} onChange={v => set('requirePhotoForReturn', v)} />
                  </div>
                </Card>

                <Card title="Adverse Reaction Returns">
                  <div className="space-y-4">
                    <ToggleRow label="Enable Adverse Reaction Fast-Track" description="Customers who experience a reaction get a separate, prioritised resolution path." checked={form.adverseReactionReturnEnabled} onChange={v => set('adverseReactionReturnEnabled', v)} />
                    {form.adverseReactionReturnEnabled && (
                      <div className="space-y-3">
                        <Field label="Adverse Reaction Return Window (Days)">
                          <input type="number" min="0" className={inputCls} value={form.adverseReactionWindowDays} onChange={e => set('adverseReactionWindowDays', Number(e.target.value))} />
                        </Field>
                        {form.adverseReactionWindowDays < 14 && (
                          <Callout type="warning">Adverse reaction return windows shorter than 14 days are not recommended for products with active ingredients. Reactions to retinols, AHAs, and actives can appear after 7–10 days of use.</Callout>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Return Reason Tags">
                  <p className="text-sm text-gray-500 mb-4">These reasons appear on the return request form. Use for QC tracking and reformulation decisions.</p>
                  <TagInput tags={form.returnReasonTags} onChange={tags => { setForm(prev => ({ ...prev, returnReasonTags: tags })); setIsDirty(true); }} />
                </Card>
              </div>
            )}

            {/* ── 5. BEST SELLERS ─────────────────────────── */}
            {activeTab === 'bestsellers' && (() => {
              const selectedProducts = form.bestSellerPids
                .map(pid => allProducts.find(p => p.pid === pid))
                .filter(Boolean) as typeof allProducts;

              const searchResults = productSearch.trim().length > 1
                ? allProducts
                    .filter(p =>
                      p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
                      !form.bestSellerPids.includes(p.pid)
                    )
                    .slice(0, 8)
                : [];

              const addProduct = (pid: string) => {
                if (!form.bestSellerPids.includes(pid)) {
                  setForm(prev => ({ ...prev, bestSellerPids: [...prev.bestSellerPids, pid] }));
                  setIsDirty(true);
                }
                setProductSearch('');
              };

              const removeProduct = (pid: string) => {
                setForm(prev => ({ ...prev, bestSellerPids: prev.bestSellerPids.filter(p => p !== pid) }));
                setIsDirty(true);
              };

              const moveProduct = (pid: string, direction: 'up' | 'down') => {
                const arr = [...form.bestSellerPids];
                const idx = arr.indexOf(pid);
                if (direction === 'up' && idx > 0) [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                if (direction === 'down' && idx < arr.length - 1) [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                setForm(prev => ({ ...prev, bestSellerPids: arr }));
                setIsDirty(true);
              };

              return (
                <div className="space-y-6">
                  <Card title="Best Sellers — Homepage Curation">
                    <p className="text-sm text-gray-500 mb-6">
                      Select up to 8 products to feature in the Best Sellers section on the homepage. Drag to reorder using the up/down arrows. If no products are pinned here, the homepage will fall back to keyword-based selection.
                    </p>

                    {/* Search & Add */}
                    <div className="relative mb-6">
                      <Field label="Search & Add a Product">
                        <input
                          type="text"
                          className={inputCls}
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder={productsLoading ? 'Loading products...' : 'Type a product name to search...'}
                          disabled={productsLoading || form.bestSellerPids.length >= 8}
                        />
                      </Field>
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-silk-light rounded-xl shadow-lg overflow-hidden">
                          {searchResults.map(p => (
                            <button
                              key={p.pid}
                              type="button"
                              onClick={() => addProduct(p.pid)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-silk-light last:border-b-0 text-left"
                            >
                              {p.images?.[0] && (
                                <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-contain rounded-lg bg-gray-50 border border-silk-light shrink-0" />
                              )}
                              <span className="text-sm font-bold text-gray-800 truncate">{p.name}</span>
                              <span className="ml-auto shrink-0">
                                <Plus size={16} className="text-dark-red" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {form.bestSellerPids.length >= 8 && (
                        <p className="text-xs text-amber-600 mt-2 font-bold">Maximum of 8 best sellers reached. Remove one to add another.</p>
                      )}
                    </div>

                    {/* Selected Products */}
                    {selectedProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-silk-light rounded-2xl text-gray-400">
                        <p className="text-sm font-bold">No products pinned yet</p>
                        <p className="text-xs mt-1">Search above to add products to the Best Sellers section</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-grey-beige uppercase tracking-wider mb-3">Pinned Products ({selectedProducts.length}/8) — Displayed left to right on homepage</p>
                        {selectedProducts.map((product, idx) => (
                          <div key={product.pid} className="flex items-center gap-3 p-3 bg-gray-50 border border-silk-light rounded-xl group">
                            <span className="text-xs font-bold text-grey-beige w-5 text-center shrink-0">{idx + 1}</span>
                            {product.images?.[0] && (
                              <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-contain rounded-lg bg-white border border-silk-light shrink-0" />
                            )}
                            <span className="flex-1 text-sm font-bold text-gray-800 truncate">{product.name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveProduct(product.pid, 'up')}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-colors"
                                title="Move up"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveProduct(product.pid, 'down')}
                                disabled={idx === selectedProducts.length - 1}
                                className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition-colors"
                                title="Move down"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeProduct(product.pid)}
                                className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors ml-1"
                                title="Remove"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })()}

            {/* ── 6. CUSTOMER EXPERIENCE ───────────────────── */}
            {activeTab === 'experience' && (
              <div className="space-y-6">
                <Card title="Skin Profile & Personalisation">
                  <div className="space-y-4">
                    <ToggleRow label="Skin Quiz / Ritual Finder" description="Enable the Ritual Finder quiz page. Disabling this route removes the highest-converting personalisation flow." checked={form.skinQuizEnabled} onChange={v => set('skinQuizEnabled', v)} />
                    <ToggleRow label="Store Skin Profile on Customer Account" description="Save quiz results to the user's profile for persistent personalisation." checked={form.storeSkinProfileOnAccount} onChange={v => set('storeSkinProfileOnAccount', v)} />
                    <ToggleRow label="Product Compatibility Warnings" description='Show "do not layer X + Y" warnings on product pages (e.g. Vitamin C + Niacinamide). Major trust signal — reduces adverse reactions and returns.' checked={form.productCompatibilityWarningsEnabled} onChange={v => set('productCompatibilityWarningsEnabled', v)} />
                    <ToggleRow label="Routine Builder Tool (AM/PM Regimen)" description="Cross-sell complementary products by building morning and evening routines. Increases AOV." checked={form.routineBuilderEnabled} onChange={v => set('routineBuilderEnabled', v)} />
                    {form.routineBuilderEnabled && (
                      <Callout type="info">The Routine Builder tool is not yet built. This toggle reserves the configuration for when the feature is implemented.</Callout>
                    )}
                  </div>
                </Card>

                <Card title="Reviews & Social Proof">
                  <div className="space-y-4">
                    <ToggleRow label="Skin Type Tagging on Reviews" description="Customers see skin type (oily, dry, combination) on reviews. Industry standard — customers filter by skin type before buying." checked={form.reviewSkinTypeTaggingEnabled} onChange={v => set('reviewSkinTypeTaggingEnabled', v)} />
                    <ToggleRow label="Before & After Photo Uploads in Reviews" description="The single most persuasive content type in skincare. Allow customers to upload results photos." checked={form.reviewBeforeAfterPhotosEnabled} onChange={v => set('reviewBeforeAfterPhotosEnabled', v)} />
                    <ToggleRow label="Verified Purchase Badge" description='Show a "Verified Purchase" badge on reviews from confirmed buyers.' checked={form.reviewVerifiedBadgeEnabled} onChange={v => set('reviewVerifiedBadgeEnabled', v)} />
                    <ToggleRow label="Review Moderation Queue" description="Hold reviews for admin approval before they go live. Recommended for brand management." checked={form.reviewModerationEnabled} onChange={v => set('reviewModerationEnabled', v)} />
                    <ToggleRow label="Review Incentive (Discount for Review)" description="Offer a discount coupon to customers who leave a review." checked={form.reviewIncentiveEnabled} onChange={v => set('reviewIncentiveEnabled', v)} />
                    {form.reviewIncentiveEnabled && (
                      <div className="space-y-3">
                        <Field label="Incentive Discount (%)">
                          <input type="number" min="1" max="100" className={inputCls} value={form.reviewIncentiveDiscountPercent} onChange={e => set('reviewIncentiveDiscountPercent', Number(e.target.value))} />
                        </Field>
                        <Callout type="warning">Incentivised reviews must be marked as such to comply with ASCI (Advertising Standards Council of India) guidelines. Ensure your review display clearly labels these as incentivised.</Callout>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ── NOTIFICATIONS ──────────────────────────── */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <Card title="Master Kill Switches">
                  <div className="space-y-4">
                    <ToggleRow label="Enable ALL WhatsApp Messages" description="If disabled, no WhatsApp messages will be sent by the system regardless of individual settings." checked={form.waAllEnabled} onChange={v => set('waAllEnabled', v)} danger />
                    <ToggleRow label="Enable ALL Automated Emails" description="If disabled, no automated emails will be sent. (Excludes critical account emails like password reset)." checked={form.emailAllEnabled} onChange={v => set('emailAllEnabled', v)} danger />
                  </div>
                </Card>

                <Card title="WhatsApp Triggers">
                  <div className="space-y-4">
                    <ToggleRow label="Order Placed" description="Sent immediately upon successful checkout." checked={form.waOrderPlacedEnabled} onChange={v => set('waOrderPlacedEnabled', v)} />
                    <ToggleRow label="Payment Failure" description="Sent on Razorpay failure with a retry link." checked={form.waPaymentFailureEnabled} onChange={v => set('waPaymentFailureEnabled', v)} />
                    <ToggleRow label="Out for Delivery" description="Sent via Shiprocket webhook when a package is out." checked={form.waOutForDeliveryEnabled} onChange={v => set('waOutForDeliveryEnabled', v)} />
                    <ToggleRow label="Stale Cart" description="Nudge customers to complete a purchase for items sitting >30 days." checked={form.waStaleCartEnabled} onChange={v => set('waStaleCartEnabled', v)} />
                    <ToggleRow label="Trending Products" description="Broadcast to active users when a product enters the top trending list." checked={form.waTrendingProductsEnabled} onChange={v => set('waTrendingProductsEnabled', v)} />
                    <ToggleRow label="Re-engagement" description="Sent to users who haven't ordered in 60 days." checked={form.waReEngagementEnabled} onChange={v => set('waReEngagementEnabled', v)} />
                    <ToggleRow label="Ticket Raised" description="Sent when a customer submits a support query." checked={form.waTicketRaisedEnabled} onChange={v => set('waTicketRaisedEnabled', v)} />
                    <ToggleRow label="Ticket Resolved" description="Sent when an admin closes a support ticket." checked={form.waTicketResolvedEnabled} onChange={v => set('waTicketResolvedEnabled', v)} />
                  </div>
                </Card>

                <Card title="Email Triggers">
                  <div className="space-y-4">
                    <ToggleRow label="Admin Alert: New Order" description="Send an alert to the admin email when a new order is placed." checked={form.notifyAdminOnOrder} onChange={v => set('notifyAdminOnOrder', v)} />
                    <ToggleRow label="Order Confirmation" description="Automatically email a receipt to the customer after successful checkout." checked={form.sendOrderConfirmationToCustomer} onChange={v => set('sendOrderConfirmationToCustomer', v)} />
                    <ToggleRow label="Return Approved" description="Email sent when a return request is approved." checked={form.emailReturnApproved} onChange={v => set('emailReturnApproved', v)} />
                    <ToggleRow label="Return Rejected" description="Email sent when a return request is denied." checked={form.emailReturnRejected} onChange={v => set('emailReturnRejected', v)} />
                    <ToggleRow label="Ticket Raised" description="Acknowledgement email when a customer submits a query." checked={form.emailTicketRaised} onChange={v => set('emailTicketRaised', v)} />
                    <ToggleRow label="Ticket Reply" description="Email sent when support replies to a ticket." checked={form.emailTicketReply} onChange={v => set('emailTicketReply', v)} />
                    <ToggleRow label="Ticket Resolved" description="Email sent when a ticket is closed." checked={form.emailTicketResolved} onChange={v => set('emailTicketResolved', v)} />
                    <ToggleRow label="Ticket Cancelled" description="Email sent when a ticket is cancelled." checked={form.emailTicketCancelled} onChange={v => set('emailTicketCancelled', v)} />
                  </div>
                </Card>
              </div>
            )}

            {/* ── 7. STOREFRONT ────────────────────────────── */}
            {activeTab === 'storefront' && (
              <div className="space-y-6">
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-silk-light shadow-sm">
                  <div className="flex justify-between items-center mb-6 border-b border-silk-light pb-4">
                    <h3 className="font-bold text-lg text-dark-red">Announcement Bar</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-bold text-gray-600">Active</span>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={form.announcementBar.isActive} onChange={e => setNested('announcementBar', 'isActive', e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${form.announcementBar.isActive ? 'bg-dark-red' : 'bg-gray-300'}`} />
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${form.announcementBar.isActive ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  </div>
                  <div className="space-y-4">
                    <Field label="Text"><input type="text" className={inputCls} value={form.announcementBar.text} onChange={e => setNested('announcementBar', 'text', e.target.value)} placeholder="e.g. Free shipping on orders over ₹999!" /></Field>
                    <Field label="Link (Optional)"><input type="text" className={inputCls} value={form.announcementBar.link} onChange={e => setNested('announcementBar', 'link', e.target.value)} placeholder="https://..." /></Field>
                  </div>
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-silk-light shadow-sm">
                  <div className="flex justify-between items-center mb-6 border-b border-silk-light pb-4">
                    <h3 className="font-bold text-lg text-dark-red">Launch Modal (Pop-up)</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-bold text-gray-600">Active</span>
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={form.launchModal?.isActive || false} onChange={e => setNested('launchModal', 'isActive', e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${form.launchModal?.isActive ? 'bg-dark-red' : 'bg-gray-300'}`} />
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${form.launchModal?.isActive ? 'translate-x-4' : ''}`} />
                      </div>
                    </label>
                  </div>
                  <div className="space-y-4">
                    <Field label="Badge Text"><input type="text" className={inputCls} value={form.launchModal?.badge || ''} onChange={e => setNested('launchModal', 'badge', e.target.value)} placeholder="e.g. Just Launched" /></Field>
                    <Field label="Title"><input type="text" className={inputCls} value={form.launchModal?.title || ''} onChange={e => setNested('launchModal', 'title', e.target.value)} placeholder="e.g. New Collection" /></Field>
                    <Field label="Description"><textarea className={`${inputCls} h-20`} value={form.launchModal?.description || ''} onChange={e => setNested('launchModal', 'description', e.target.value)} placeholder="Enter details..." /></Field>
                    <Field label="CTA Button Label"><input type="text" className={inputCls} value={form.launchModal?.ctaLabel || ''} onChange={e => setNested('launchModal', 'ctaLabel', e.target.value)} placeholder="e.g. Explore Collection" /></Field>
                    <Field label="CTA Button Link"><input type="text" className={inputCls} value={form.launchModal?.ctaLink || ''} onChange={e => setNested('launchModal', 'ctaLink', e.target.value)} placeholder="e.g. /shop" /></Field>
                    
                    <div>
                      <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">Popup Image</label>
                      <div className="flex items-center gap-4">
                        {form.launchModal?.image && (
                          <div className="relative group w-24 h-24 rounded-xl border border-silk-light overflow-hidden bg-gray-50 shrink-0">
                            <img src={form.launchModal.image} alt="Popup Graphic" className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                type="button"
                                onClick={() => setNested('launchModal', 'image', '')}
                                className="bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow-md font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                        <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-silk-light rounded-xl hover:bg-gray-50 cursor-pointer transition-colors text-center">
                          <span className="text-dark-red font-bold block mb-1">Click to Upload Image</span>
                          <span className="text-sm text-gray-500">JPG, PNG, WEBP (Transparent background recommended)</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleLaunchModalImageUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <Card title="Social Links">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(['instagram', 'facebook', 'twitter', 'youtube'] as const).map(platform => (
                      <Field key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)}>
                        <input type="url" placeholder="https://..." className={inputCls} value={(form.socialLinks as any)[platform]} onChange={e => setNested('socialLinks', platform, e.target.value)} />
                      </Field>
                    ))}
                  </div>
                </Card>

                <Card title="SEO Meta">
                  <div className="space-y-4">
                    <Field label="Meta Title"><input type="text" className={inputCls} value={form.seoMeta.title} onChange={e => setNested('seoMeta', 'title', e.target.value)} /></Field>
                    <Field label="Meta Description"><textarea className={`${inputCls} h-20`} value={form.seoMeta.description} onChange={e => setNested('seoMeta', 'description', e.target.value)} /></Field>
                    <div>
                      <label className="block text-xs font-bold text-grey-beige uppercase tracking-wider mb-2">OG Image (Social Sharing)</label>
                      <div className="flex items-center gap-4">
                        {form.seoMeta.ogImage && (
                          <div className="relative group w-24 h-24 rounded-xl border border-silk-light overflow-hidden bg-gray-50 shrink-0">
                            <img src={form.seoMeta.ogImage} alt="OG Image" className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                type="button"
                                onClick={() => setNested('seoMeta', 'ogImage', '')}
                                className="bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow-md font-bold"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                        <label className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-silk-light rounded-xl hover:bg-gray-50 cursor-pointer transition-colors text-center">
                          <span className="text-dark-red font-bold block mb-1">Click to Upload OG Image</span>
                          <span className="text-sm text-gray-500">Ideal size: 1200x630 pixels (JPG, PNG)</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleOGImageUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-silk-light">
              <button
                type="submit"
                disabled={saving || !isDirty}
                className="flex items-center gap-2 bg-dark-red text-white px-8 py-3 rounded-xl font-bold hover:bg-ruby-red transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
