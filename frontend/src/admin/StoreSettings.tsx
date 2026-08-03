import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import {
  Save, Loader2, Store, Truck, Bell, CreditCard,
  RotateCcw, Star, Shield, AlertTriangle, Settings2, CheckCircle2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type Tab = 'general' | 'storefront' | 'shipping' | 'payments' | 'notifications' | 'returns' | 'reviews' | 'system';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'storefront', label: 'Storefront', icon: Settings2 },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'returns', label: 'Returns', icon: RotateCcw },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'system', label: 'System', icon: Shield },
];

/* --- UI Components --- */

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors -mx-4 px-4 sm:mx-0 sm:px-0 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-red/30 focus-visible:ring-offset-2 ${checked ? 'bg-dark-red' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-out ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors -mx-4 px-4 sm:mx-0 sm:px-0 rounded-lg">
      <div>
        <label className="text-sm font-medium text-slate-800 block">{label}</label>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '', className = '', ...props }: any) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white transition-shadow ${className}`}
      {...props}
    />
  );
}

function SettingsCard({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 md:p-8 scroll-mt-36">
      <div className="mb-6 pb-4 border-b border-slate-100">
        <h3 className="text-lg font-serif text-dark-red">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      <div className="space-y-0">
        {children}
      </div>
    </section>
  );
}

function SettingsHeader({ isDirty, isSaving, isPrimaryAdmin, onSave }: any) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm -mx-4 sm:mx-0 sm:rounded-t-xl">
      <div>
        <h2 className="text-xl font-serif text-dark-red hidden sm:block">Store Settings</h2>
        <h2 className="text-lg font-serif text-dark-red sm:hidden">Settings</h2>
      </div>
      <div className="flex items-center gap-3">
        {!isPrimaryAdmin && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
            <AlertTriangle size={12} /> View-only
          </span>
        )}
        
        {isPrimaryAdmin && (
          <div className="text-xs font-medium mr-2 hidden sm:block">
            {isSaving ? (
              <span className="text-slate-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Saving...</span>
            ) : isDirty ? (
              <span className="text-amber-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Unsaved changes</span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> All changes saved</span>
            )}
          </div>
        )}

        <button
          onClick={onSave}
          disabled={!isDirty || isSaving || !isPrimaryAdmin}
          className="flex items-center gap-2 px-5 py-2 bg-dark-red text-white text-xs font-sans font-medium uppercase tracking-widest rounded-lg hover:bg-ruby-red disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          <span className="hidden sm:inline">{isSaving ? 'Saving' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}

function SettingsSidebar({ tabs, activeSection, onSelect }: any) {
  return (
    <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar pb-2 md:pb-0">
      {tabs.map((tab: any) => {
        const Icon = tab.icon;
        const isActive = activeSection === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap md:whitespace-normal rounded-lg md:rounded-none md:border-l-2 ${
              isActive
                ? 'bg-red-50/50 text-dark-red md:border-dark-red md:bg-red-50/30'
                : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900 md:border-transparent'
            }`}
          >
            <Icon size={16} className={isActive ? 'text-dark-red' : 'text-slate-400'} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

/* --- Main Page Component --- */

export default function StoreSettings() {
  const { getAuthHeaders, isPrimaryAdmin } = useApp();
  
  const [originalState, setOriginalState] = useState<any>(null);
  const [formState, setFormState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const [activeSection, setActiveSection] = useState<Tab>('general');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/`, { headers });
      const data = await res.json();
      if (data.success) {
        setOriginalState(data.data);
        setFormState(JSON.parse(JSON.stringify(data.data)));
      } else {
        toast.error('Failed to load settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading settings');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Setup ScrollSpy for Active Section
  useEffect(() => {
    if (isLoading || !formState) return;
    
    const observer = new IntersectionObserver((entries) => {
      // Find the first intersecting entry
      const visible = entries.find(e => e.isIntersecting);
      if (visible) {
        setActiveSection(visible.target.id as Tab);
      }
    }, { 
      root: null,
      rootMargin: '-100px 0px -60% 0px' 
    });

    TABS.forEach(tab => {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isLoading, formState]);

  const isDirty = formState && originalState ? JSON.stringify(formState) !== JSON.stringify(originalState) : false;

  const handleSave = async () => {
    if (!isPrimaryAdmin) {
      toast.error('Only the primary admin can save settings.');
      return;
    }
    setSaveStatus('saving');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_URL}/api/v1/settings/`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Settings saved successfully!');
        setOriginalState(data.data);
        setFormState(JSON.parse(JSON.stringify(data.data)));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        toast.error(data.message || 'Failed to save settings');
        setSaveStatus('error');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
      setSaveStatus('error');
    }
  };

  const update = (path: string, value: any) => {
    setFormState((prev: any) => {
      const keys = path.split('.');
      const next = JSON.parse(JSON.stringify(prev));
      let curr = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!curr[keys[i]]) curr[keys[i]] = {};
        curr = curr[keys[i]];
      }
      curr[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id as Tab);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin text-dark-red" size={28} />
      </div>
    );
  }

  if (!formState) return null;

  const s = formState;

  return (
    <div className="flex flex-col -m-3 sm:-m-6 lg:-m-8">
      <SettingsHeader 
        isDirty={isDirty} 
        isSaving={saveStatus === 'saving'} 
        isPrimaryAdmin={isPrimaryAdmin} 
        onSave={handleSave} 
      />

      <div className="flex flex-col md:flex-row">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 z-10 p-4 md:py-6 overflow-x-auto md:sticky md:top-[72px] self-start">
          <SettingsSidebar tabs={TABS} activeSection={activeSection} onSelect={scrollToSection} />
        </div>

        {/* Content Area */}
        <div ref={scrollContainerRef} className="flex-1 bg-slate-50/50 p-4 sm:p-8">
          <div className="max-w-4xl mx-auto space-y-8 pb-24">
            
            <SettingsCard id="general" title="General Information" description="Basic details about your business and store profile.">
              <Field label="Store Name"><Input value={s.storeName} onChange={(v: string) => update('storeName', v)} /></Field>
              <Field label="Support Email"><Input value={s.supportEmail} onChange={(v: string) => update('supportEmail', v)} type="email" /></Field>
              <Field label="Support Phone"><Input value={s.supportPhone} onChange={(v: string) => update('supportPhone', v)} /></Field>
              <Field label="Store Address" description="Physical address for invoices"><Input value={s.storeAddress} onChange={(v: string) => update('storeAddress', v)} /></Field>
              
              <div className="pt-6 mt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Tax & Invoicing</h4>
                <Field label="Invoice Prefix"><Input value={s.invoicePrefix} onChange={(v: string) => update('invoicePrefix', v)} placeholder="BOD-" /></Field>
                <Field label="GST Number"><Input value={s.gstNumber} onChange={(v: string) => update('gstNumber', v)} /></Field>
                <Field label="PAN Number"><Input value={s.panNumber} onChange={(v: string) => update('panNumber', v)} /></Field>
                <Field label="Tax Rate (%)" description="Applied to applicable orders"><Input value={s.taxRatePercent} onChange={(v: number) => update('taxRatePercent', v)} type="number" /></Field>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Social Links & SEO</h4>
                <Field label="Instagram"><Input value={s.socialLinks?.instagram} onChange={(v: string) => update('socialLinks.instagram', v)} placeholder="https://instagram.com/..." /></Field>
                <Field label="Facebook"><Input value={s.socialLinks?.facebook} onChange={(v: string) => update('socialLinks.facebook', v)} placeholder="https://facebook.com/..." /></Field>
                <Field label="YouTube"><Input value={s.socialLinks?.youtube} onChange={(v: string) => update('socialLinks.youtube', v)} placeholder="https://youtube.com/..." /></Field>
                <Field label="SEO Title"><Input value={s.seoMeta?.title} onChange={(v: string) => update('seoMeta.title', v)} /></Field>
                <Field label="SEO Description"><Input value={s.seoMeta?.description} onChange={(v: string) => update('seoMeta.description', v)} /></Field>
              </div>
            </SettingsCard>

            <SettingsCard id="storefront" title="Storefront Experience" description="Configure announcement bars, modals, and promotional blocks.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Announcement Bar</h4>
                <Toggle checked={!!s.announcementBar?.isActive} onChange={v => update('announcementBar.isActive', v)} label="Show Announcement Bar" description="Displays a dismissible banner at the top of every page" />
                <Field label="Announcement Text"><Input value={s.announcementBar?.text} onChange={(v: string) => update('announcementBar.text', v)} placeholder="Free shipping on orders over ₹999!" /></Field>
                <Field label="Announcement Link" description="Optional — clicking the bar navigates here"><Input value={s.announcementBar?.link} onChange={(v: string) => update('announcementBar.link', v)} placeholder="/shop" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Launch Modal</h4>
                <Toggle checked={!!s.launchModal?.isActive} onChange={v => update('launchModal.isActive', v)} label="Show Launch Modal" description="Pop-up shown on first visit (email capture / promotion)" />
                <Field label="Badge Text"><Input value={s.launchModal?.badge} onChange={(v: string) => update('launchModal.badge', v)} placeholder="Just Launched" /></Field>
                <Field label="Title"><Input value={s.launchModal?.title} onChange={(v: string) => update('launchModal.title', v)} /></Field>
                <Field label="Description"><Input value={s.launchModal?.description} onChange={(v: string) => update('launchModal.description', v)} /></Field>
                <Field label="CTA Label"><Input value={s.launchModal?.ctaLabel} onChange={(v: string) => update('launchModal.ctaLabel', v)} placeholder="Explore Collection" /></Field>
                <Field label="CTA Link"><Input value={s.launchModal?.ctaLink} onChange={(v: string) => update('launchModal.ctaLink', v)} placeholder="/shop" /></Field>
              </div>
            </SettingsCard>

            <SettingsCard id="shipping" title="Shipping & Delivery" description="Manage shipping thresholds, costs, and international settings.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Domestic Shipping</h4>
                <Field label="Free Shipping Threshold (₹)" description="Orders above this value get free shipping"><Input value={s.shippingThreshold} onChange={(v: number) => update('shippingThreshold', v)} type="number" /></Field>
                <Field label="Shipping Cost (₹)" description="Flat fee for orders below threshold"><Input value={s.shippingCost} onChange={(v: number) => update('shippingCost', v)} type="number" /></Field>
                <Field label="Avg. Delivery Days"><Input value={s.averageDeliveryDays} onChange={(v: number) => update('averageDeliveryDays', v)} type="number" /></Field>
                <Toggle checked={!!s.showEstimatedDeliveryDate} onChange={v => update('showEstimatedDeliveryDate', v)} label="Show Estimated Delivery Date" description="Show estimated delivery on product and cart pages" />
                <Toggle checked={!!s.temperatureSensitiveWarningEnabled} onChange={v => update('temperatureSensitiveWarningEnabled', v)} label="Temperature Sensitive Warning" description="Show warning for summer heat sensitive products" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">International Shipping</h4>
                <Toggle checked={!!s.internationalShippingEnabled} onChange={v => update('internationalShippingEnabled', v)} label="Enable International Shipping" />
                <Toggle checked={!!s.internationalCheckoutEnabled} onChange={v => update('internationalCheckoutEnabled', v)} label="Enable International Checkout" />
                <Toggle checked={!!s.autoCurrencySwitchingEnabled} onChange={v => update('autoCurrencySwitchingEnabled', v)} label="Auto Currency Switching" description="Automatically switch currency based on visitor's country" />
                <Field label="International Shipping Cost (₹)"><Input value={s.internationalShippingCost} onChange={(v: number) => update('internationalShippingCost', v)} type="number" /></Field>
                <Field label="International Free Shipping Threshold (₹)"><Input value={s.internationalShippingThreshold} onChange={(v: number) => update('internationalShippingThreshold', v)} type="number" /></Field>
              </div>
            </SettingsCard>

            <SettingsCard id="payments" title="Payments" description="Configure Cash on Delivery and payment gateways.">
              <Toggle checked={!!s.codEnabled} onChange={v => update('codEnabled', v)} label="Enable Cash on Delivery" />
              <Field label="COD Extra Charge (₹)" description="Additional fee for COD orders (0 = free)"><Input value={s.codExtraCharge} onChange={(v: number) => update('codExtraCharge', v)} type="number" /></Field>
              <Field label="Minimum Order Value for COD (₹)" description="COD not available below this amount"><Input value={s.minOrderValueForCOD} onChange={(v: number) => update('minOrderValueForCOD', v)} type="number" /></Field>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <Toggle
                  checked={!!s.codInternationalEnabled}
                  onChange={v => update('codInternationalEnabled', v)}
                  label="Enable COD for International Orders"
                  description="Offers Cash on Delivery outside India. Requires 'Enable Cash on Delivery' above to also be on."
                />
                {!!s.codInternationalEnabled && (
                  <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                    <span className="text-amber-600 text-sm leading-none mt-0.5">⚠</span>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      International couriers cannot collect cash on delivery. Orders placed
                      this way arrive unpaid, are flagged for manual review, and must be
                      settled before dispatch. Intended for testing.
                    </p>
                  </div>
                )}
              </div>
            </SettingsCard>

            <SettingsCard id="notifications" title="Notifications & Messaging" description="Manage Email and WhatsApp automated triggers.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Master Switches</h4>
                <Toggle checked={!!s.waAllEnabled} onChange={v => update('waAllEnabled', v)} label="WhatsApp Notifications" description="Master switch for all WhatsApp messages" />
                <Toggle checked={!!s.emailAllEnabled} onChange={v => update('emailAllEnabled', v)} label="Email Notifications" description="Master switch for all email communications" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">WhatsApp Triggers</h4>
                <Toggle checked={!!s.waOrderPlacedEnabled} onChange={v => update('waOrderPlacedEnabled', v)} label="Order Placed" description="Send WhatsApp on order confirmation" />
                <Toggle checked={!!s.waOutForDeliveryEnabled} onChange={v => update('waOutForDeliveryEnabled', v)} label="Out for Delivery" />
                <Toggle checked={!!s.waStaleCartEnabled} onChange={v => update('waStaleCartEnabled', v)} label="Abandoned Cart Recovery" />
                <Toggle checked={!!s.waPaymentFailureEnabled} onChange={v => update('waPaymentFailureEnabled', v)} label="Payment Failure" />
                <Toggle checked={!!s.waTicketRaisedEnabled} onChange={v => update('waTicketRaisedEnabled', v)} label="Support Ticket Raised" />
                <Toggle checked={!!s.waTicketResolvedEnabled} onChange={v => update('waTicketResolvedEnabled', v)} label="Support Ticket Resolved" />
                <Toggle checked={!!s.waTrendingProductsEnabled} onChange={v => update('waTrendingProductsEnabled', v)} label="Trending Products" />
                <Toggle checked={!!s.waReEngagementEnabled} onChange={v => update('waReEngagementEnabled', v)} label="Re-engagement Messages" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Admin Email Alerts</h4>
                <Toggle checked={!!s.notifyAdminOnOrder} onChange={v => update('notifyAdminOnOrder', v)} label="Notify Admin on New Order" />
                <Field label="Admin Notification Email"><Input value={s.adminNotificationEmail} onChange={(v: string) => update('adminNotificationEmail', v)} type="email" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Email Triggers</h4>
                <Toggle checked={!!s.sendOrderConfirmationToCustomer} onChange={v => update('sendOrderConfirmationToCustomer', v)} label="Order Confirmation to Customer" />
                <Toggle checked={!!s.emailReturnApproved} onChange={v => update('emailReturnApproved', v)} label="Return Approved" />
                <Toggle checked={!!s.emailReturnRejected} onChange={v => update('emailReturnRejected', v)} label="Return Rejected" />
                <Toggle checked={!!s.emailTicketRaised} onChange={v => update('emailTicketRaised', v)} label="Support Ticket Created" />
                <Toggle checked={!!s.emailTicketReply} onChange={v => update('emailTicketReply', v)} label="Support Ticket Reply" />
                <Toggle checked={!!s.emailTicketResolved} onChange={v => update('emailTicketResolved', v)} label="Support Ticket Resolved" />
                <Toggle checked={!!s.emailTicketCancelled} onChange={v => update('emailTicketCancelled', v)} label="Support Ticket Cancelled" />
              </div>
            </SettingsCard>

            <SettingsCard id="returns" title="Return Policy" description="Configure return windows and refund methods.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <Field label="Return Window (days)"><Input value={s.returnWindowDays} onChange={(v: number) => update('returnWindowDays', v)} type="number" /></Field>
                <Toggle checked={!!s.allowReturnOpened} onChange={v => update('allowReturnOpened', v)} label="Allow Returns on Opened Products" />
                <Toggle checked={!!s.allowReturnUnopened} onChange={v => update('allowReturnUnopened', v)} label="Allow Returns on Unopened Products" />
                <Toggle checked={!!s.requirePhotoForReturn} onChange={v => update('requirePhotoForReturn', v)} label="Require Photo Evidence for Return" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Adverse Reactions</h4>
                <Toggle checked={!!s.adverseReactionReturnEnabled} onChange={v => update('adverseReactionReturnEnabled', v)} label="Enable Adverse Reaction Returns" description="Extends return window for allergic reactions" />
                <Field label="Adverse Reaction Return Window (days)"><Input value={s.adverseReactionWindowDays} onChange={(v: number) => update('adverseReactionWindowDays', v)} type="number" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Refund Processing</h4>
                <Field label="Default Refund Method">
                  <select
                    value={s.refundMethod}
                    onChange={e => update('refundMethod', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white"
                  >
                    <option value="original">Original Payment Source</option>
                    <option value="both">Let Customer Choose (Original / Replacement)</option>
                  </select>
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard id="reviews" title="Reviews & Personalisation" description="Manage product reviews and user skin profiles.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Review Features</h4>
                <Toggle checked={!!s.reviewSkinTypeTaggingEnabled} onChange={v => update('reviewSkinTypeTaggingEnabled', v)} label="Skin Type Tagging" description="Allow reviewers to tag their skin type" />
                <Toggle checked={!!s.reviewBeforeAfterPhotosEnabled} onChange={v => update('reviewBeforeAfterPhotosEnabled', v)} label="Before & After Photos" description="Allow photo uploads with reviews" />
                <Toggle checked={!!s.reviewVerifiedBadgeEnabled} onChange={v => update('reviewVerifiedBadgeEnabled', v)} label="Verified Purchase Badge" description="Show 'Verified' badge on purchases reviews" />
                <Toggle checked={!!s.reviewModerationEnabled} onChange={v => update('reviewModerationEnabled', v)} label="Review Moderation" description="Reviews require admin approval before appearing" />
              </div>
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Review Incentives</h4>
                <Toggle checked={!!s.reviewIncentiveEnabled} onChange={v => update('reviewIncentiveEnabled', v)} label="Discount for Leaving a Review" description="Automatically send a discount code after review submission" />
                <Field label="Discount Percentage (%)"><Input value={s.reviewIncentiveDiscountPercent} onChange={(v: number) => update('reviewIncentiveDiscountPercent', v)} type="number" /></Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Skin Profile & Personalisation</h4>
                <Toggle checked={!!s.skinQuizEnabled} onChange={v => update('skinQuizEnabled', v)} label="Ritual Finder / Skin Quiz" />
                <Toggle checked={!!s.productCompatibilityWarningsEnabled} onChange={v => update('productCompatibilityWarningsEnabled', v)} label="Product Compatibility Warnings" />
                <Toggle checked={!!s.storeSkinProfileOnAccount} onChange={v => update('storeSkinProfileOnAccount', v)} label="Store Skin Profile on Account" />
              </div>
            </SettingsCard>

            <SettingsCard id="system" title="System & Inventory" description="Low-level application settings and maintenance mode.">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <div className={`p-4 rounded-lg border mb-4 transition-colors ${s.maintenanceMode ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <Toggle
                    checked={!!s.maintenanceMode}
                    onChange={v => update('maintenanceMode', v)}
                    label="Maintenance Mode"
                    description="When enabled, the storefront shows a maintenance page to visitors. Admins can still access via bypass secret."
                  />
                </div>
                <Field label="Maintenance Message" description="Shown to visitors when maintenance mode is on">
                  <textarea
                    value={s.maintenanceMessage || ''}
                    onChange={e => update('maintenanceMessage', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-dark-red/20 focus:border-dark-red bg-white resize-none"
                    rows={3}
                  />
                </Field>
                <Field label="Bypass Secret" description="Add ?preview=[secret] to URL to bypass maintenance mode">
                  <Input value={s.maintenanceBypassSecret} onChange={(v: string) => update('maintenanceBypassSecret', v)} placeholder="e.g. admin123" />
                </Field>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Inventory</h4>
                <Field label="Low Stock Alert Threshold" description="Products below this quantity trigger low stock warnings">
                  <Input value={s.lowStockThreshold} onChange={(v: number) => update('lowStockThreshold', v)} type="number" />
                </Field>
              </div>
            </SettingsCard>

          </div>
        </div>
      </div>
    </div>
  );
}
