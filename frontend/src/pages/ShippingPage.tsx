import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
    Check, ChevronRight, Truck, MapPin, Loader2, AlertCircle,
    Search, User, Mail, Phone, Map, Building, CheckCircle2, Globe
} from 'lucide-react';
import Footer from '../components/Footer';
import RequireAuth from '../components/RequireAuth';

// ─── Module-level pincode cache (persists across re-renders, reset on page reload) ─────────────────────────
const pincodeCache: Record<string, { city: string; state: string }> = {};

// ─── Types ───────────────────────────────────────────────────────────────────────────────────────────────
interface ShippingForm {
    name: string;
    email: string;
    phone: string;
    houseNumber: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
}

type AutofillSource = 'none' | 'street' | 'pincode';

const INDIA_ALIASES = new Set(['india', 'in', 'bharat', 'ind']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()\u2010-\u2015]{7,20}$/;

// ─── Helper ───────────────────────────────────────────────────────────────────────────────────────────────
function isIndiaCountry(c: string) {
    return !c.trim() || INDIA_ALIASES.has(c.toLowerCase().trim());
}

// ─── Component ───────────────────────────────────────────────────────────────────────────────────────────
export default function ShippingPage() {
    const { cartItems, cartTotal, user, authLoading, cartLoading, storeSettings } = useApp();
    const navigate = useNavigate();

    // ── Form state ────────────────────────────────────────────────────────────────────────────────────────
    const [form, setForm] = useState<ShippingForm>({
        name: user?.displayName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        houseNumber: (user as { houseNumber?: string })?.houseNumber || '',
        address: user?.address || '',
        city: user?.city || '',
        state: user?.state || '',
        pincode: user?.pincode || '',
        country: (user as { country?: string })?.country || 'India',
    });

    // Tracks which fields user has interacted with (for deferred validation)
    const [touched, setTouched] = useState<Partial<Record<keyof ShippingForm, boolean>>>({});
    const touch = (field: keyof ShippingForm) => setTouched(prev => ({ ...prev, [field]: true }));

    // ── Autofill state ────────────────────────────────────────────────────────────────────────────────────
    const [lastAutofillSource, setLastAutofillSource] = useState<AutofillSource>('none');
    const [autofillSuccess, setAutofillSuccess] = useState(false); // show a success badge briefly

    // ── Pincode lookup state ──────────────────────────────────────────────────────────────────────────────
    const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [pincodeMsg, setPincodeMsg] = useState('');
    const pincodeAbortRef = useRef<AbortController | null>(null);

    // ── Street autocomplete state ─────────────────────────────────────────────────────────────────────────
    const [addressQuery, setAddressQuery] = useState(user?.address || '');
     
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState('');
    const [activeIdx, setActiveIdx] = useState(-1);
    const [isAddressLocked, setIsAddressLocked] = useState(false); // locked after selection
    const streetAbortRef = useRef<AbortController | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ── Sync user profile once available ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        window.scrollTo(0, 0);
        if (!user) return;
        setForm(prev => ({
            name: prev.name || user.displayName || '',
            email: prev.email || user.email || '',
            phone: prev.phone || user.phone || '',
            houseNumber: prev.houseNumber || (user as { houseNumber?: string })?.houseNumber || '',
            address: prev.address || user.address || '',
            city: prev.city || user.city || '',
            state: prev.state || user.state || '',
            pincode: prev.pincode || user.pincode || '',
            country: prev.country || (user as { country?: string })?.country || 'India',
        }));
        if (!addressQuery && user.address) setAddressQuery(user.address);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // ── Cart calculations ─────────────────────────────────────────────────────────────────────────────────
    const validCartItems = cartItems.filter(i => i && i.product);

    const shippingCost = cartTotal >= storeSettings.shippingThreshold ? 0 : storeSettings.shippingCost;
    const total = cartTotal + shippingCost;

    // ── Validation ────────────────────────────────────────────────────────────────────────────────────────
    const errors: Partial<Record<keyof ShippingForm, string>> = {};
    if (touched.name && !form.name.trim()) errors.name = 'Full name is required.';
    if (touched.email && !EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address.';
    if (touched.phone && !PHONE_RE.test(form.phone)) errors.phone = 'Enter a valid phone number.';
    if (touched.address && !form.address.trim()) errors.address = 'Street address is required.';
    if (touched.city && !form.city.trim()) errors.city = 'City is required.';
    if (touched.state && !form.state.trim()) errors.state = 'State is required.';
    if (touched.country && !form.country.trim()) errors.country = 'Country is required.';
    if (touched.pincode) {
        if (!form.pincode.trim()) errors.pincode = 'Pincode is required.';
        else if (isIndiaCountry(form.country) && !/^\d{6}$/.test(form.pincode))
            errors.pincode = 'Indian pincode must be exactly 6 digits.';
    }

    const isFormValid =
        EMAIL_RE.test(form.email) &&
        PHONE_RE.test(form.phone) &&
        (['name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'country'] as (keyof ShippingForm)[])
            .every(k => form[k].trim().length > 0);

    // ── Pincode → City/State autofill ──────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const pin = form.pincode.replace(/\D/g, '').slice(0, 6);
        if (pin !== form.pincode) setForm(prev => ({ ...prev, pincode: pin })); // sanitize

        if (pin.length !== 6 || !isIndiaCountry(form.country)) {
            if (pin.length < 6) { setPincodeStatus('idle'); setPincodeMsg(''); }
            return;
        }

        // Serve from cache instantly
        if (pincodeCache[pin]) {
            const c = pincodeCache[pin];
            setForm(prev => ({
                ...prev,
                city: lastAutofillSource !== 'street' || !prev.city ? c.city : prev.city,
                state: lastAutofillSource !== 'street' || !prev.state ? c.state : prev.state,
                country: 'India',
            }));
            setLastAutofillSource('pincode');
            setPincodeStatus('success');
            setPincodeMsg(`Auto-filled from PIN ${pin}`);
            showAutofillBadge();
            return;
        }

        // Cancel stale request
        pincodeAbortRef.current?.abort();
        const ctrl = new AbortController();
        pincodeAbortRef.current = ctrl;

        setPincodeStatus('loading');
        setPincodeMsg('');

        const timerId = setTimeout(async () => {
            try {
                const hardTimeout = setTimeout(() => ctrl.abort(), 7000);
                const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctrl.signal });
                clearTimeout(hardTimeout);

                if (!res.ok) throw new Error('network');
                const data = await res.json();

                if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
                    const po = data[0].PostOffice[0];
                    const city = po.District || po.Division || po.Region || '';
                    const state = po.State || '';

                    pincodeCache[pin] = { city, state };

                    setForm(prev => ({
                        ...prev,
                        city: lastAutofillSource !== 'street' || !prev.city ? city : prev.city,
                        state: lastAutofillSource !== 'street' || !prev.state ? state : prev.state,
                        country: 'India',
                    }));
                    setLastAutofillSource('pincode');
                    setPincodeStatus('success');
                    setPincodeMsg(`Showing results for ${po.Block || po.Name || pin}`);
                    showAutofillBadge();
                } else {
                    setPincodeStatus('error');
                    setPincodeMsg('Pincode not found. Please fill city & state manually.');
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    setPincodeStatus('error');
                    setPincodeMsg('Could not look up pincode. Please fill manually.');
                }
            }
        }, 600);

        return () => { clearTimeout(timerId); ctrl.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.pincode, form.country]);

    // ── Street autocomplete fetch ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const q = addressQuery.trim();
        if (q.length < 3 || isAddressLocked) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        streetAbortRef.current?.abort();
        const ctrl = new AbortController();
        streetAbortRef.current = ctrl;

        const timerId = setTimeout(async () => {
            setIsFetchingSuggestions(true);
            setSuggestionError('');
            try {
                // Bias results to India if applicable
                const bias = isIndiaCountry(form.country) ? ', India' : '';
                const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + bias)}&limit=7`;
                const res = await fetch(url, { signal: ctrl.signal });
                if (!res.ok) throw new Error('network');
                const data = await res.json();

                // Deduplicate by osm_id
                const seen = new Set<string>();
                 
                const unique = (data.features || []).filter((f: any) => {
                    const id = String(f.properties?.osm_id ?? Math.random());
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                setSuggestions(unique);
                setShowSuggestions(true);
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    setSuggestionError('Could not load suggestions. Type your address manually.');
                    setSuggestions([]);
                }
            } finally {
                setIsFetchingSuggestions(false);
            }
        }, 450);

        return () => { clearTimeout(timerId); ctrl.abort(); };
         
    }, [addressQuery, isAddressLocked, form.country]);

    // ── Autofill success flash badge ──────────────────────────────────────────────────────────────────────
    const showAutofillBadge = useCallback(() => {
        setAutofillSuccess(true);
        const t = setTimeout(() => setAutofillSuccess(false), 2500);
        return () => clearTimeout(t);
    }, []);

    // ── Suggestion selection ──────────────────────────────────────────────────────────────────────────────
     
    const handleSuggestionClick = (suggestion: any) => {
        const p = suggestion.properties || {};
        const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
        const city = p.city || p.town || p.village || p.county || p.district || '';
        const state = p.state || '';
        const country = p.country || '';
        const postcode = p.postcode || '';
        const displayAddress = street || city || state;

        setAddressQuery(displayAddress);
        setForm(prev => ({
            ...prev,
            address: displayAddress,
            city: city || prev.city,
            state: state || prev.state,
            country: country || prev.country,
            pincode: postcode || prev.pincode,
        }));
        setLastAutofillSource('street');
        setIsAddressLocked(true);
        setShowSuggestions(false);
        setActiveIdx(-1);
        showAutofillBadge();
        touch('address'); touch('city'); touch('state');
    };

    const handleManualAddressSelect = () => {
        setForm(prev => ({ ...prev, address: addressQuery }));
        setIsAddressLocked(true);
        setShowSuggestions(false);
        setActiveIdx(-1);
        touch('address');
    };

    // ── Keyboard navigation ───────────────────────────────────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const hasManual = addressQuery.trim().length > 0;
        if (!showSuggestions || (!hasManual && suggestions.length === 0)) return;

        const totalItems = suggestions.length + (hasManual ? 1 : 0);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx(i => Math.min(i + 1, totalItems - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            if (hasManual && activeIdx === 0) {
                handleManualAddressSelect();
            } else {
                const suggestionIdx = hasManual ? activeIdx - 1 : activeIdx;
                if (suggestions[suggestionIdx]) {
                    handleSuggestionClick(suggestions[suggestionIdx]);
                }
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
            setActiveIdx(-1);
        }
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setAddressQuery(v);
        setForm(prev => ({ ...prev, address: v }));
        setIsAddressLocked(false);
        setActiveIdx(-1);
        setShowSuggestions(!!v);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Touch all required fields to reveal any remaining errors
        const requiredFields: (keyof ShippingForm)[] = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'country'];
        setTouched(Object.fromEntries(requiredFields.map(k => [k, true])));
        if (!isFormValid) return;

        const finalAddress = [form.houseNumber, form.address, form.country]
            .filter(Boolean)
            .join(', ');

        const finalShippingDetails = {
            ...form,
            address: finalAddress
        };

        navigate('/payment', { state: { shippingDetails: finalShippingDetails } });
    };

    // ── Shared input classes ──────────────────────────────────────────────────────────────────────────────
    const inputBase = 'w-full py-3 pr-3 border bg-neutral-50 font-sans text-sm focus:outline-none transition-all rounded-sm placeholder:text-gray-400';
    const inputNormal = 'border-silk focus:border-dark-red focus:ring-1 focus:ring-dark-red/20';
    const inputError = 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-200';
    const inputOk = 'border-emerald-400 focus:border-emerald-500';

    const fieldCls = (field: keyof ShippingForm, hasIcon = true, value?: string) => {
        const v = value ?? form[field];
        const isErr = errors[field];
        const isDone = touched[field] && !isErr && v?.trim();
        return `${inputBase} ${hasIcon ? 'pl-10' : 'pl-3'} ${isErr ? inputError : isDone ? inputOk : inputNormal}`;
    };

    // Guard 1: Auth or cart is still hydrating — show spinner, never blank
    if (authLoading || cartLoading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-dark-red mb-4" />
                <p className="text-xs uppercase tracking-widest font-sans text-dark-red">Preparing your checkout…</p>
            </div>
        );
    }

    // Guard 2: Fully resolved — cart is empty, redirect cleanly (replace keeps history clean)
    if (validCartItems.length === 0) {
        return <Navigate to="/cart" replace />;
    }

    // ── Step indicator ────────────────────────────────────────────────────────────────────────────────────
    const Step = ({ step, title, active, complete }: { step: number; title: string; active: boolean; complete: boolean }) => (
        <div className={`flex items-center gap-2 ${active ? 'text-dark-red' : complete ? 'text-green-700' : 'text-gray-300'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2
                ${active ? 'border-dark-red text-dark-red' : complete ? 'bg-green-700 border-green-700 text-white' : 'border-gray-300 text-gray-300'}`}>
                {complete ? <Check size={12} strokeWidth={3} /> : step}
            </div>
            <span className={`font-sans text-xs tracking-widest uppercase hidden sm:block ${active ? 'font-bold' : ''}`}>{title}</span>
        </div>
    );

    return (
        <RequireAuth>
            <div className="min-h-screen bg-neutral-50 flex flex-col pt-24">
                <div className="flex-1 max-w-6xl mx-auto w-full px-6 pb-16">

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center mb-12 sm:mb-16">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <Step step={1} title="Bag" active={false} complete />
                            <div className="w-8 sm:w-16 h-[1px] bg-gray-300" />
                            <Step step={2} title="Shipping" active complete={false} />
                            <div className="w-8 sm:w-16 h-[1px] bg-gray-300" />
                            <Step step={3} title="Payment" active={false} complete={false} />
                            <div className="w-8 sm:w-16 h-[1px] bg-gray-300" />
                            <Step step={4} title="Invoice" active={false} complete={false} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                        {/* ── LEFT: Form ── */}
                        <div className="lg:col-span-7">
                            <div className="flex items-center justify-between mb-8">
                                <h1 className="font-serif text-3xl text-dark-red">Shipping Address</h1>
                                {autofillSuccess && (
                                    <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 animate-pulse">
                                        <CheckCircle2 size={12} /> Address auto-filled
                                    </span>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                                <div className="bg-white border border-silk p-6 sm:p-8 shadow-sm rounded-sm space-y-4">

                                    {/* Name + Email */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="relative">
                                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                <input
                                                    type="text" required placeholder="Full Name"
                                                    value={form.name}
                                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                                    onBlur={() => touch('name')}
                                                    className={fieldCls('name')}
                                                    autoComplete="name"
                                                />
                                            </div>
                                            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                                        </div>
                                        <div>
                                            <div className="relative">
                                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                <input
                                                    type="email" required placeholder="Email"
                                                    value={form.email}
                                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                    onBlur={() => touch('email')}
                                                    className={fieldCls('email')}
                                                    autoComplete="email"
                                                />
                                            </div>
                                            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div>
                                        <div className="relative">
                                            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input
                                                type="tel" required placeholder="Phone Number (e.g. +91 98765 43210)"
                                                value={form.phone}
                                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                                onBlur={() => touch('phone')}
                                                className={fieldCls('phone')}
                                                autoComplete="tel"
                                            />
                                        </div>
                                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                                    </div>

                                    {/* House Number (optional) */}
                                    <div className="relative">
                                        <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                        <input
                                            type="text" placeholder="House / Flat No. (Optional)"
                                            value={form.houseNumber}
                                            onChange={e => setForm(p => ({ ...p, houseNumber: e.target.value }))}
                                            className={`${inputBase} pl-10 ${inputNormal}`}
                                            autoComplete="address-line2"
                                        />
                                    </div>

                                    {/* Street Autocomplete */}
                                    <div>
                                        <div className="relative" ref={dropdownRef}>
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input
                                                type="text" required
                                                placeholder="Street, Area, or Landmark"
                                                value={addressQuery}
                                                onChange={handleAddressChange}
                                                onKeyDown={handleKeyDown}
                                                onBlur={() => {
                                                    touch('address');
                                                    setTimeout(() => setShowSuggestions(false), 200);
                                                }}
                                                onFocus={() => {
                                                    if (addressQuery.trim().length >= 3 && !isAddressLocked)
                                                        setShowSuggestions(true);
                                                }}
                                                className={fieldCls('address', true, addressQuery)}
                                                autoComplete="street-address"
                                                aria-autocomplete="list"
                                                aria-expanded={showSuggestions}
                                            />

                                            {/* Dropdown */}
                                            {showSuggestions && (
                                                <div className="absolute z-30 w-full mt-1 bg-white border border-silk shadow-2xl rounded-sm max-h-64 overflow-y-auto">
                                                    {isFetchingSuggestions && (
                                                        <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                                                            <Loader2 size={15} className="animate-spin text-dark-red" /> Searching…
                                                        </div>
                                                    )}
                                                    {!isFetchingSuggestions && suggestionError && (
                                                        <div className="px-4 py-3 text-sm text-orange-600 flex items-center gap-2">
                                                            <AlertCircle size={15} /> {suggestionError}
                                                        </div>
                                                    )}
                                                    {!isFetchingSuggestions && !suggestionError && suggestions.length === 0 && (
                                                        <div className="px-4 py-3 text-sm text-gray-400">No results. Try a different search.</div>
                                                    )}
                                                    {addressQuery.trim().length > 0 && (
                                                        <button
                                                            type="button"
                                                            onMouseDown={handleManualAddressSelect}
                                                            onMouseEnter={() => setActiveIdx(0)}
                                                            className={`w-full text-left px-4 py-3 border-b border-gray-50 flex items-start gap-3 transition-colors
                                                                ${activeIdx === 0 ? 'bg-red-50' : 'hover:bg-neutral-50'}`}
                                                        >
                                                            <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-gray-800 truncate">Use typed address:</p>
                                                                <p className="text-xs text-dark-red truncate font-medium">{addressQuery}</p>
                                                            </div>
                                                        </button>
                                                    )}

                                                    {suggestions.map((s, idx) => {
                                                        const p = s.properties || {};
                                                        const primary = [p.housenumber, p.street || p.name].filter(Boolean).join(' ') || p.city || p.state;
                                                        const secondary = [p.city || p.town || p.village, p.state, p.country].filter(Boolean).join(', ');
                                                        const currentIdx = addressQuery.trim().length > 0 ? idx + 1 : idx;
                                                        return (
                                                            <button
                                                                key={p.osm_id ?? idx}
                                                                type="button"
                                                                onMouseDown={() => handleSuggestionClick(s)}
                                                                onMouseEnter={() => setActiveIdx(currentIdx)}
                                                                className={`w-full text-left px-4 py-3 border-b border-gray-50 flex items-start gap-3 transition-colors
                                                                    ${activeIdx === currentIdx ? 'bg-red-50' : 'hover:bg-neutral-50'}`}
                                                            >
                                                                <MapPin size={16} className="text-dark-red shrink-0 mt-0.5" />
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-gray-800 truncate">{primary}</p>
                                                                    <p className="text-xs text-gray-500 truncate">{secondary}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                                        {!errors.address && (
                                            <p className="text-xs text-gray-400 mt-1">Start typing to see address suggestions.</p>
                                        )}
                                    </div>

                                    {/* City + State */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="relative">
                                                <Map size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                <input
                                                    type="text" required placeholder="City / District"
                                                    value={form.city}
                                                    onChange={e => {
                                                        setForm(p => ({ ...p, city: e.target.value }));
                                                        setLastAutofillSource('none');
                                                    }}
                                                    onBlur={() => touch('city')}
                                                    className={fieldCls('city')}
                                                />
                                            </div>
                                            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                                        </div>
                                        <div>
                                            <input
                                                type="text" required placeholder="State / Province"
                                                value={form.state}
                                                onChange={e => {
                                                    setForm(p => ({ ...p, state: e.target.value }));
                                                    setLastAutofillSource('none');
                                                }}
                                                onBlur={() => touch('state')}
                                                className={fieldCls('state', false)}
                                            />
                                            {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                                        </div>
                                    </div>

                                    {/* Country + Pincode */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <div className="relative">
                                                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                <input
                                                    type="text" required placeholder="Country"
                                                    value={form.country}
                                                    onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                                                    onBlur={() => touch('country')}
                                                    className={fieldCls('country')}
                                                    autoComplete="country-name"
                                                />
                                            </div>
                                            {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}
                                        </div>
                                        <div className="sm:col-span-2">
                                            <div className="relative">
                                                <input
                                                    type="text" required
                                                    placeholder={isIndiaCountry(form.country) ? '6-digit PIN Code' : 'Zip / Postal Code'}
                                                    value={form.pincode}
                                                    onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))}
                                                    onBlur={() => touch('pincode')}
                                                    inputMode="numeric"
                                                    maxLength={isIndiaCountry(form.country) ? 6 : 12}
                                                    className={fieldCls('pincode', false)}
                                                    autoComplete="postal-code"
                                                />
                                                {pincodeStatus === 'loading' && (
                                                    <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                                                )}
                                                {pincodeStatus === 'success' && (
                                                    <CheckCircle2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                                )}
                                                {pincodeStatus === 'error' && touched.pincode && (
                                                    <AlertCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
                                                )}
                                            </div>
                                            {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
                                            {!errors.pincode && pincodeStatus === 'success' && (
                                                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                                    <CheckCircle2 size={11} /> {pincodeMsg}
                                                </p>
                                            )}
                                            {!errors.pincode && pincodeStatus === 'error' && (
                                                <p className="text-xs text-orange-600 mt-1">{pincodeMsg}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-4 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/cart')}
                                        className="w-1/3 py-4 border border-silk text-dark-red font-sans text-sm tracking-widest uppercase hover:bg-red-50 transition-all rounded-sm"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!isFormValid}
                                        className={`w-2/3 py-4 font-sans text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all rounded-sm
                                            ${!isFormValid
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                : 'bg-dark-red text-white hover:bg-rose-900 shadow-md hover:shadow-lg active:scale-[0.99]'}`}
                                    >
                                        Continue to Payment <ChevronRight size={16} />
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* ── RIGHT: Order Summary ── */}
                        <div className="lg:col-span-5">
                            <div className="sticky top-28 bg-white border border-silk p-6 shadow-sm rounded-sm">
                                <h2 className="font-serif text-xl text-dark-red mb-6">Order Summary</h2>

                                <div className="space-y-4 mb-6 max-h-[280px] overflow-y-auto pr-1">
                                    {validCartItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-4 items-start">
                                            <div className="w-16 h-20 bg-silk-light shrink-0 rounded-sm overflow-hidden">
                                                <img 
                                                  loading="lazy"
                                                  src={item.product.images[0]} 
                                                  alt={item.product.name} 
                                                  className="w-full h-full object-contain p-1 mix-blend-multiply" 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                                <p className="font-serif text-sm text-dark-red truncate">{item.product.name}</p>
                                                <p className="font-sans text-xs text-gray-500">Qty: {item.quantity}</p>
                                            </div>
                                            <p className="shrink-0 font-sans text-sm font-semibold text-gray-900 pt-1">
                                                ₹{(item.product.price * item.quantity).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-silk pt-4 space-y-2 font-sans text-sm text-gray-600">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Shipping</span>
                                        <span className={shippingCost === 0 ? 'text-emerald-700 font-medium' : ''}>
                                            {shippingCost === 0 ? 'Free' : `₹${shippingCost}`}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-silk mt-4 pt-4 flex justify-between font-serif text-xl text-dark-red">
                                    <span>Total</span>
                                    <span>₹{total.toLocaleString('en-IN')}</span>
                                </div>

                                <div className="mt-6 flex items-center justify-center gap-2 text-dark-red bg-red-50 p-3 rounded-sm border border-red-100 text-xs font-medium tracking-wide">
                                    <Truck size={16} /> Free shipping on orders over ₹{storeSettings.shippingThreshold}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                <Footer />
            </div>
        </RequireAuth>
    );
}
