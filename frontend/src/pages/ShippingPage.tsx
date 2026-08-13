import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Address } from '../types';
import {
    Check, ChevronRight, MapPin, Loader2, AlertCircle,
    Search, User, Mail, Phone, Map, Building, CheckCircle2, Globe, ChevronDown
} from 'lucide-react';
import Footer from '../components/Footer';
import RequireAuth from '../components/RequireAuth';
import { getCountryFlag, COUNTRIES } from '../utils/countries';
import { formatCurrency } from '../utils/currencies';

import { useCurrency } from '../hooks/useCurrency';
import { getIsoAlpha2Code } from '../utils/countryMapper';
import { useSEO } from '../hooks/useSEO';

// ─── Module-level pincode cache ────────────────────────────────────────────────
const pincodeCache: Record<string, { city: string; state: string; areas: string[] }> = {};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ShippingForm {
    name: string;
    email: string;
    phone: string;
    address: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
}

type AutofillSource = 'none' | 'street' | 'pincode';

const INDIA_ALIASES = new Set(['india', 'in', 'bharat', 'ind']);
const NAME_RE = /^[a-zA-Z\u00C0-\u024F\s'\-]{2,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i;
const US_POSTCODE_RE = /^\d{5}(-\d{4})?$/;
const CA_POSTCODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/i;
const GLOBAL_POSTCODE_RE = /^[a-zA-Z0-9\s\-]{3,12}$/;

function isIndiaCountry(c: string) {
    return !c.trim() || INDIA_ALIASES.has(c.toLowerCase().trim());
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ShippingPage() {
    useSEO({
        title: 'Checkout - Shipping',
        description: 'Enter your shipping details.',
        noIndex: true
    });

    const { cartItems, cartTotal, user, authLoading, cartLoading, storeSettings, fetchShippingQuote, appliedCoupon, setAppliedCoupon } = useApp();
    // Ref so quote effect can read latest settings without re-triggering a fetch
    // every time the settings response arrives from the server.
    const storeSettingsRef = useRef(storeSettings);
    storeSettingsRef.current = storeSettings;
    const { formatPrice, userCurrency } = useCurrency();
    const navigate = useNavigate();

    // ── Coupon state ─────────────────────────────────────────────────────────────
    const [couponInput, setCouponInput] = useState('');
    const [couponError, setCouponError] = useState<string | null>(null);
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

    // ── Form state ───────────────────────────────────────────────────────────────
    const [form, setForm] = useState<ShippingForm>({
        name: user?.displayName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        area: '',
        city: user?.city || '',
        state: user?.state || '',
        pincode: user?.pincode || '',
        country: (user as { country?: string })?.country || 'India',
    });

    const [touched, setTouched] = useState<Partial<Record<keyof ShippingForm, boolean>>>({});
    const touch = (field: keyof ShippingForm) => setTouched(prev => ({ ...prev, [field]: true }));

    // ── UI state ─────────────────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countrySearchQuery, setCountrySearchQuery] = useState('');
    const countryDropdownRef = useRef<HTMLDivElement>(null);

    const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
    const [areaSearchQuery, setAreaSearchQuery] = useState('');
    const areaDropdownRef = useRef<HTMLDivElement>(null);

    const [, setLastAutofillSource] = useState<AutofillSource>('none');
    const lastAutofillSourceRef = useRef<AutofillSource>('none');
    const [autofillSuccess, setAutofillSuccess] = useState(false);

    // ── Pincode lookup state ─────────────────────────────────────────────────────
    const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [pincodeMsg, setPincodeMsg] = useState('');
    const pincodeAbortRef = useRef<AbortController | null>(null);

    // ── Street autocomplete state ────────────────────────────────────────────────
    const [addressQuery, setAddressQuery] = useState(user?.address || '');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState('');
    const [activeIdx, setActiveIdx] = useState(-1);
    const [isAddressLocked, setIsAddressLocked] = useState(false);
    const streetAbortRef = useRef<AbortController | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ── Saved-address selector state ─────────────────────────────────────────────
    const savedAddresses: Address[] = user?.addresses || [];
    const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

    const applyAddress = useCallback((addr: Address) => {
        setForm(prev => ({
            ...prev,
            name: addr.name || prev.name,
            phone: addr.phone || prev.phone,
            address: addr.addressLine,
            area: '',
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            country: (addr as any).country || 'India',
        }));
        setAddressQuery(addr.addressLine);
        setIsAddressLocked(true);
        setSelectedSavedId(addr._id || null);
        setTouched({ name: true, phone: true, address: true, city: true, state: true, pincode: true, country: true });
    }, []);

    // ── Sync user profile once available ────────────────────────────────────────
    useEffect(() => {
        window.scrollTo(0, 0);
        if (!user) return;

        // Auto-apply the default saved address if present
        const defaultAddr = (user.addresses || []).find(a => a.isDefault);
        if (defaultAddr) {
            applyAddress(defaultAddr);
            return;
        }

        // Fallback: populate from legacy flat fields
        setForm(prev => ({
            name: prev.name || user.displayName || '',
            email: prev.email || user.email || '',
            phone: prev.phone || user.phone || '',
            address: prev.address || user.address || '',
            area: prev.area || '',
            city: prev.city || user.city || '',
            state: prev.state || user.state || '',
            pincode: prev.pincode || user.pincode || '',
            country: prev.country || (user as { country?: string })?.country || 'India',
        }));
        if (!addressQuery && user.address) setAddressQuery(user.address);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // ── Cart calculations ────────────────────────────────────────────────────────
    // useMemo gives a stable reference — a plain .filter() creates a new array every render
    // which would cause the quote useEffect to loop infinitely.
    const validCartItems = useMemo(
        () => cartItems.filter(i => i && i.product),
        [cartItems]
    );

    // Dynamic Quote State
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [quoteData, setQuoteData] = useState<{ 
        shippingCost: number; 
        total: number; 
        threshold: number;
        discountAmount?: number;
        isWelcomeOfferApplied?: boolean;
        isFreeShippingCouponApplied?: boolean;
        currency?: string;
        isFallback?: boolean;
        subtotal?: number;
        isFetched?: boolean;
        taxAmount?: number;
        taxRatePercent?: number;
    }>({
        shippingCost: storeSettings.shippingCost,
        total: cartTotal + storeSettings.shippingCost,
        threshold: storeSettings.shippingThreshold,
        currency: 'INR',
        isFetched: false
    });

    useEffect(() => {
        if (validCartItems.length === 0) return;
        let isMounted = true;
        setQuoteError(null);

        // Prepare lightweight items list to send to the API (avoid sending full product objects)
        const itemsForQuote = validCartItems.map((item: any) => ({
            productId: item.product?._id || item.product,
            pid: item.product?.pid,
            quantity: item.quantity,
        }));

        fetchShippingQuote(itemsForQuote, { country: form.country }, appliedCoupon || undefined)
            .then(data => {
                if (isMounted) {
                    setQuoteData({
                        shippingCost: data.shippingCost,
                        total: data.totalAmount,
                        threshold: isIndiaCountry(form.country)
                            ? storeSettings.shippingThreshold
                            : storeSettings.internationalShippingThreshold,
                        discountAmount: data.discountAmount,
                        isWelcomeOfferApplied: data.isWelcomeOfferApplied,
                        isFreeShippingCouponApplied: data.isFreeShippingCouponApplied,
                        currency: data.currency || 'INR',
                        isFallback: !!data.isFallback,
                        subtotal: data.subtotal,
                        taxAmount: data.taxAmount,
                        taxRatePercent: data.taxRatePercent,
                        isFetched: true
                    });

                    if (appliedCoupon && !data.couponCode) {
                        setAppliedCoupon(null);
                        setCouponError("Coupon is no longer valid for this cart.");
                    } else if (!appliedCoupon && data.couponCode) {
                        setAppliedCoupon(data.couponCode);
                    }
                }
            })
            .catch(err => {
                console.error("Quote fetch failed:", err);
                if (!isMounted) return;
                setQuoteError(err.message || "Failed to fetch shipping quote.");
            });

        return () => {
            isMounted = false;
        };
    // storeSettings deliberately omitted — changes there don't need to re-fetch the quote.
    // fetchShippingQuote is a stable useCallback from AppContext so safe to include.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validCartItems, form.country, fetchShippingQuote, appliedCoupon]);

    const handleApplyCoupon = async () => {
        if (!couponInput.trim()) return;
        setIsApplyingCoupon(true);
        setCouponError(null);

        try {
            const itemsForQuote = validCartItems.map((item: any) => ({
                productId: item.product?._id || item.product,
                pid: item.product?.pid,
                quantity: item.quantity,
            }));

            const data = await fetchShippingQuote(itemsForQuote, { country: form.country }, couponInput.trim().toUpperCase());
            
            setQuoteData(prev => ({
                ...prev,
                shippingCost: data.shippingCost,
                total: data.totalAmount,
                discountAmount: data.discountAmount,
                isWelcomeOfferApplied: data.isWelcomeOfferApplied,
                isFreeShippingCouponApplied: data.isFreeShippingCouponApplied,
                currency: data.currency || 'INR',
                isFallback: !!data.isFallback,
                subtotal: data.subtotal,
                isFetched: true
            }));

            setAppliedCoupon(data.couponCode);
            setCouponInput('');
        } catch (err: any) {
            console.error("Coupon application failed:", err);
            setCouponError(err.message || 'Invalid coupon code');
            setAppliedCoupon(null);
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const shippingCost = quoteData.shippingCost;
    const total = quoteData.total;

    // ── Validation ───────────────────────────────────────────────────────────────
    const errors: Partial<Record<keyof ShippingForm, string>> = {};
    if (touched.name) {
        if (!form.name.trim()) errors.name = 'Full name is required.';
        else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';
        else if (!NAME_RE.test(form.name)) errors.name = 'Name contains invalid characters.';
    }
    if (touched.email && !EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address.';
    
    const strippedPhone = form.phone.replace(/\D/g, '');
    if (touched.phone) {
        if (!form.phone.trim()) errors.phone = 'Phone number is required.';
        else if (isIndiaCountry(form.country) && strippedPhone.length < 10) errors.phone = 'Indian phone must have at least 10 digits.';
        else if (strippedPhone.length < 7) errors.phone = 'Enter a valid phone number (min 7 digits).';
    }

    if (touched.address && form.address.trim().length < 3) errors.address = 'Street address is required.';
    if (touched.city && form.city.trim().length < 3) errors.city = 'City is required.';
    
    const stateRequired = ['India', 'United States of America', 'Canada', 'Australia'].some(c => c.toLowerCase() === form.country.trim().toLowerCase());
    if (touched.state && stateRequired && form.state.trim().length < 2) errors.state = 'State is required for this country.';
    if (touched.country && !form.country.trim()) errors.country = 'Country is required.';
    
    if (touched.pincode) {
        if (!form.pincode.trim()) errors.pincode = 'Postal code is required.';
        else {
            const countryLower = form.country.trim().toLowerCase();
            if (isIndiaCountry(form.country) && !/^[1-9][0-9]{5}$/.test(form.pincode)) errors.pincode = 'Indian PIN code must be exactly 6 digits.';
            else if (countryLower === 'united kingdom' && !UK_POSTCODE_RE.test(form.pincode)) errors.pincode = 'Enter a valid UK Postcode.';
            else if (countryLower === 'united states of america' && !US_POSTCODE_RE.test(form.pincode)) errors.pincode = 'Enter a valid US ZIP Code.';
            else if (countryLower === 'canada' && !CA_POSTCODE_RE.test(form.pincode)) errors.pincode = 'Enter a valid Canadian Postal Code.';
            else if (!['india', 'in', 'bharat', 'ind', 'united kingdom', 'united states of america', 'canada'].includes(countryLower) && !GLOBAL_POSTCODE_RE.test(form.pincode)) errors.pincode = 'Enter a valid postal code.';
        }
    }

    const isFormValid =
        NAME_RE.test(form.name) &&
        EMAIL_RE.test(form.email) &&
        strippedPhone.length >= 7 &&
        (!isIndiaCountry(form.country) || strippedPhone.length >= 10) &&
        form.address.trim().length >= 3 &&
        form.city.trim().length >= 3 &&
        (!stateRequired || form.state.trim().length >= 2) &&
        form.country.trim().length > 0 &&
        (
            (isIndiaCountry(form.country) && /^[1-9][0-9]{5}$/.test(form.pincode)) ||
            (form.country.trim().toLowerCase() === 'united kingdom' && UK_POSTCODE_RE.test(form.pincode)) ||
            (form.country.trim().toLowerCase() === 'united states of america' && US_POSTCODE_RE.test(form.pincode)) ||
            (form.country.trim().toLowerCase() === 'canada' && CA_POSTCODE_RE.test(form.pincode)) ||
            (!['india', 'in', 'bharat', 'ind', 'united kingdom', 'united states of america', 'canada'].includes(form.country.trim().toLowerCase()) && GLOBAL_POSTCODE_RE.test(form.pincode))
        );

    // ── Pincode → City/State autofill ────────────────────────────────────────────
    useEffect(() => {
        const rawPin = form.pincode.trim();
        const isIndia = isIndiaCountry(form.country);
        const isoCode = isIndia ? 'in' : getIsoAlpha2Code(form.country);

        // Clear if no valid country/iso code or pin is too short
        if (!isoCode || (isIndia && rawPin.length < 6) || (!isIndia && rawPin.length < 3)) {
            setPincodeStatus('idle');
            setPincodeMsg('');
            if (isIndia) {
                const cleanPin = rawPin.replace(/\D/g, '').slice(0, 6);
                if (cleanPin !== form.pincode) {
                    setForm(prev => ({ ...prev, pincode: cleanPin, area: '' }));
                    setAreaSearchQuery('');
                }
            }
            return;
        }

        let pinToFetch = rawPin;
        if (isIndia) {
            pinToFetch = rawPin.replace(/\D/g, '').slice(0, 6);
            if (pinToFetch !== form.pincode) {
                setForm(prev => ({ ...prev, pincode: pinToFetch, area: '' }));
                setAreaSearchQuery('');
            }
            if (pinToFetch.length !== 6) return;
        }

        const cacheKey = `${isoCode}_${pinToFetch.toLowerCase()}`;

        if (pincodeCache[cacheKey]) {
            const c = pincodeCache[cacheKey];
            const src = lastAutofillSourceRef.current;
            setForm(prev => ({
                ...prev,
                city: src !== 'street' || !prev.city ? c.city : prev.city,
                state: src !== 'street' || !prev.state ? c.state : prev.state,
                country: isIndia ? 'India' : prev.country,
            }));
            lastAutofillSourceRef.current = 'pincode';
            setLastAutofillSource('pincode');
            setPincodeStatus('success');
            if (isIndia && c.areas.length) {
                const areaStr = c.areas.slice(0, 3).join(', ') + (c.areas.length > 3 ? '...' : '');
                setPincodeMsg(`Auto-filled: ${c.city}, ${c.state} (${areaStr})`);
            } else {
                setPincodeMsg(`Auto-filled: ${c.city}, ${c.state}`);
            }
            showAutofillBadge();
            return;
        }

        pincodeAbortRef.current?.abort();
        const ctrl = new AbortController();
        pincodeAbortRef.current = ctrl;
        setPincodeStatus('loading');
        setPincodeMsg('');

        // Use same debounce timeout to avoid excessive calls
        const timerId = setTimeout(async () => {
            try {
                const hardTimeout = setTimeout(() => ctrl.abort(), 7000);
                
                let res;
                if (isIndia) {
                    res = await fetch(`https://api.postalpincode.in/pincode/${pinToFetch}`, { signal: ctrl.signal });
                } else {
                    res = await fetch(`https://api.zippopotam.us/${isoCode}/${encodeURIComponent(pinToFetch)}`, { signal: ctrl.signal });
                }
                
                clearTimeout(hardTimeout);
                if (!res.ok) throw new Error('network');
                const data = await res.json();

                let city = '';
                let state = '';
                let areas: string[] = [];
                let success = false;

                if (isIndia) {
                    if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
                        const po = data[0].PostOffice[0];
                        city = po.District || po.Division || po.Region || '';
                        state = po.State || '';
                        areas = data[0].PostOffice.map((p: any) => p.Name).filter(Boolean);
                        success = true;
                    }
                } else {
                    if (data && data.places && data.places.length > 0) {
                        const place = data.places[0];
                        city = place['place name'] || '';
                        state = place['state abbreviation'] || place['state'] || '';
                        success = true;
                    }
                }

                if (success) {
                    pincodeCache[cacheKey] = { city, state, areas };
                    const src = lastAutofillSourceRef.current;
                    setForm(prev => ({
                        ...prev,
                        city: src !== 'street' || !prev.city ? city : prev.city,
                        state: src !== 'street' || !prev.state ? state : prev.state,
                        country: isIndia ? 'India' : prev.country,
                    }));
                    lastAutofillSourceRef.current = 'pincode';
                    setLastAutofillSource('pincode');
                    setPincodeStatus('success');
                    
                    if (isIndia && areas.length) {
                        const areaStr = areas.slice(0, 3).join(', ') + (areas.length > 3 ? '...' : '');
                        setPincodeMsg(`Auto-filled: ${city}, ${state} (${areaStr})`);
                    } else {
                        setPincodeMsg(`Auto-filled: ${city}, ${state}`);
                    }
                    showAutofillBadge();
                } else {
                    setPincodeStatus('error');
                    setPincodeMsg('Postal code not found. Please fill manually.');
                }
            } catch (err: unknown) {
                if (err instanceof Error && err.name !== 'AbortError') {
                    setPincodeStatus('error');
                    setPincodeMsg('Could not look up postal code. Please fill manually.');
                }
            }
        }, 600);

        return () => { clearTimeout(timerId); ctrl.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.pincode, form.country]);

    // ── Street autocomplete fetch ────────────────────────────────────────────────
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
                const bias = isIndiaCountry(form.country) ? ', India' : '';
                const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q + bias)}&limit=7`;
                const res = await fetch(url, { signal: ctrl.signal });
                if (!res.ok) throw new Error('network');
                const data = await res.json();

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

    // ── Autofill success badge ───────────────────────────────────────────────────
    const showAutofillBadge = useCallback(() => {
        setAutofillSuccess(true);
        const t = setTimeout(() => setAutofillSuccess(false), 2500);
        return () => clearTimeout(t);
    }, []);

    // ── Suggestion selection ─────────────────────────────────────────────────────
    const handleSuggestionClick = (suggestion: any) => {
        const p = suggestion.properties || {};
        const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
        const city = p.city || p.town || p.village || p.county || p.district || '';
        const state = p.state || '';
        const country = p.country || '';
        const postcode = p.postcode || '';
        const displayAddress = street || city || state;

        setAddressQuery(displayAddress);
        setForm(prev => {
            const hasValidPincode = isIndiaCountry(prev.country) && prev.pincode.length === 6 && pincodeStatus === 'success';
            return {
                ...prev,
                address: displayAddress,
                city: hasValidPincode ? prev.city : (city || prev.city),
                state: hasValidPincode ? prev.state : (state || prev.state),
                country: country || prev.country,
                pincode: prev.pincode || postcode,
            };
        });
        lastAutofillSourceRef.current = 'street';
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

    // ── Keyboard navigation ──────────────────────────────────────────────────────
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
                if (suggestions[suggestionIdx]) handleSuggestionClick(suggestions[suggestionIdx]);
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

    // ── Submit ───────────────────────────────────────────────────────────────────
    const handleSubmit = (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        const requiredFields: (keyof ShippingForm)[] = ['name', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'country'];
        setTouched(Object.fromEntries(requiredFields.map(k => [k, true])));
        if (!isFormValid) return;

        setIsSubmitting(true);
        const finalAddress = [form.address, form.area].filter(Boolean).join(', ');
        
        // Simulating minor delay for UX / submission before navigation
        setTimeout(() => {
            navigate('/payment', { state: { shippingDetails: { ...form, address: finalAddress } } });
        }, 300);
    };

    // ── Close country dropdown on click outside ──────────────────────────────────
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
                setIsCountryDropdownOpen(false);
            }
            if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
                setIsAreaDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── Shared input classes ─────────────────────────────────────────────────────
    const inputBase = 'w-full h-11 pr-3 border bg-neutral-50 font-sans text-sm focus:outline-none transition-all rounded-sm placeholder:text-gray-400';
    const inputNormal = 'border-silk focus:border-dark-red focus:ring-2 focus:ring-dark-red/20';
    const inputError = 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200';
    const inputOk = 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200';

    const fieldCls = (field: keyof ShippingForm, hasIcon = true, value?: string) => {
        const v = value ?? form[field];
        const isErr = errors[field];
        const isDone = touched[field] && !isErr && v?.trim();
        return `${inputBase} ${hasIcon ? 'pl-10' : 'pl-3'} ${isErr ? inputError : isDone ? inputOk : inputNormal}`;
    };

    // ── Guards ───────────────────────────────────────────────────────────────────
    if (authLoading || cartLoading) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-dark-red mb-4" />
                <p className="text-xs uppercase tracking-widest font-sans text-dark-red">Preparing your checkout…</p>
            </div>
        );
    }

    if (validCartItems.length === 0) {
        return <Navigate to="/cart" replace />;
    }

    // ── Step indicator ───────────────────────────────────────────────────────────
    const Step = ({ step, title, active, complete }: { step: number; title: string; active: boolean; complete: boolean }) => (
        <div className={`flex items-center gap-2 ${active ? 'text-dark-red' : complete ? 'text-green-700' : 'text-gray-300'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2
                ${active ? 'border-dark-red text-dark-red' : complete ? 'bg-green-700 border-green-700 text-white' : 'border-gray-300 text-gray-300'}`}>
                {complete ? <Check size={12} strokeWidth={3} /> : step}
            </div>
            <span className={`font-sans text-xs tracking-widest uppercase hidden sm:block ${active ? 'font-bold' : ''}`}>{title}</span>
        </div>
    );

    // Whether we're in "saved address selected" mode (form hidden, just the CTA)
    const hasSavedAndSelected = savedAddresses.length > 0 && !!selectedSavedId;
    const selectedAddr = hasSavedAndSelected ? savedAddresses.find(a => a._id === selectedSavedId) : null;

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

                            {/* ─── CASE A: Saved address is selected — show compact card ─── */}
                            {hasSavedAndSelected && selectedAddr && (
                                <div className="mb-6">
                                    <div className="bg-white border border-dark-red/25 rounded-sm p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="mt-0.5 w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                                    <MapPin size={15} className="text-dark-red" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                        <p className="font-sans text-sm font-semibold text-gray-900">{selectedAddr.name}</p>
                                                        {selectedAddr.isDefault && (
                                                            <span className="text-[9px] uppercase tracking-widest font-bold text-dark-red bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">Default</span>
                                                        )}
                                                    </div>
                                                    <p className="font-sans text-xs text-gray-500 mb-1.5">{selectedAddr.phone}</p>
                                                    <p className="font-sans text-sm text-gray-700 leading-relaxed">
                                                        {selectedAddr.addressLine},<br />
                                                        {selectedAddr.city}, {selectedAddr.state} – {selectedAddr.pincode}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSavedId(null)}
                                                className="shrink-0 font-sans text-xs text-dark-red border border-dark-red/30 px-3 py-1.5 rounded-sm hover:bg-red-50 transition-all whitespace-nowrap"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── CASE B: Saved addresses exist but none selected — show list picker ─── */}
                            {savedAddresses.length > 0 && !selectedSavedId && (
                                <div className="mb-6">
                                    <p className="font-sans text-[10px] uppercase tracking-widest text-gray-400 mb-3">Choose a saved address</p>
                                    <div className="space-y-2">
                                        {savedAddresses.map(addr => (
                                            <button
                                                key={addr._id}
                                                type="button"
                                                onClick={() => applyAddress(addr)}
                                                className="w-full text-left p-4 border border-silk bg-white rounded-sm hover:border-dark-red/40 hover:bg-red-50/20 transition-all group focus:outline-none focus:ring-1 focus:ring-dark-red/30"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <MapPin size={15} className="text-gray-300 group-hover:text-dark-red transition-colors shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-sans text-sm font-semibold text-gray-800">{addr.name}</span>
                                                                {addr.isDefault && (
                                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-dark-red bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">Default</span>
                                                                )}
                                                            </div>
                                                            <p className="font-sans text-xs text-gray-500 truncate mt-0.5">
                                                                {addr.addressLine}, {addr.city}, {addr.state} – {addr.pincode}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={15} className="text-gray-300 group-hover:text-dark-red transition-colors shrink-0" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 mt-5">
                                        <div className="flex-1 h-px bg-silk" />
                                        <span className="font-sans text-[10px] uppercase tracking-widest text-gray-400 whitespace-nowrap">or use a different address</span>
                                        <div className="flex-1 h-px bg-silk" />
                                    </div>
                                </div>
                            )}

                            {/* ─── Form: only shown when no saved address is actively selected ─── */}
                            {!hasSavedAndSelected && (
                                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                                    <div className="bg-white border border-silk p-6 sm:p-8 shadow-sm rounded-sm space-y-4">

                                        {/* Name + Email */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="shipping-name" className="sr-only">Full Name</label>
                                                <div className="relative">
                                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                    <input
                                                        id="shipping-name"
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
                                                <label htmlFor="shipping-email" className="sr-only">Email</label>
                                                <div className="relative">
                                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                    <input
                                                        id="shipping-email"
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
                                            <label htmlFor="shipping-phone" className="sr-only">Phone Number</label>
                                            <div className="relative">
                                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                <input
                                                    id="shipping-phone"
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

                                        {/* Country Dropdown */}
                                        <div className="relative" ref={countryDropdownRef}>
                                            <label htmlFor="shipping-country" className="sr-only">Country</label>
                                            <div className="relative">
                                                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                <button
                                                    id="shipping-country"
                                                    type="button"
                                                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                                                    onBlur={() => touch('country')}
                                                    className={`${fieldCls('country')} text-left flex items-center justify-between cursor-pointer`}
                                                    aria-haspopup="listbox"
                                                    aria-expanded={isCountryDropdownOpen}
                                                >
                                                    <span className="truncate flex items-center gap-2">
                                                        {form.country && getCountryFlag(form.country) && (
                                                            <span className="text-lg">{getCountryFlag(form.country)}</span>
                                                        )}
                                                        {form.country || 'Select Country'}
                                                    </span>
                                                    <ChevronRight size={16} className={`text-gray-400 transition-transform ${isCountryDropdownOpen ? 'rotate-90' : ''}`} />
                                                </button>
                                            </div>
                                            {errors.country && <p className="text-xs text-red-500 mt-1">{errors.country}</p>}

                                            {isCountryDropdownOpen && (
                                                <div className="absolute z-40 w-full mt-1 bg-white border border-silk shadow-2xl rounded-sm">
                                                    <div className="p-2 border-b border-gray-100">
                                                        <div className="relative">
                                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search country..."
                                                                value={countrySearchQuery}
                                                                onChange={(e) => setCountrySearchQuery(e.target.value)}
                                                                className="w-full pl-8 pr-3 py-2 text-sm border-none bg-neutral-50 focus:ring-1 focus:ring-dark-red/20 rounded-sm outline-none"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>
                                                    <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
                                                        {COUNTRIES
                                                            .filter((c: string) => c.toLowerCase().includes(countrySearchQuery.toLowerCase()))
                                                            .map((c: string) => (
                                                                <li
                                                                    key={c}
                                                                    role="option"
                                                                    aria-selected={form.country === c}
                                                                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2 ${form.country === c ? 'bg-red-50 text-dark-red font-medium' : 'text-gray-700'}`}
                                                                    onMouseDown={() => {
                                                                        setForm(prev => ({ ...prev, country: c }));
                                                                        setIsCountryDropdownOpen(false);
                                                                        setCountrySearchQuery('');
                                                                    }}
                                                                >
                                                                    {getCountryFlag(c) && <span className="text-lg">{getCountryFlag(c)}</span>}
                                                                    {c}
                                                                </li>
                                                            ))}
                                                        {COUNTRIES
                                                            .filter((c: string) => c.toLowerCase().includes(countrySearchQuery.toLowerCase()))
                                                            .length === 0 && (
                                                                <li className="px-4 py-3 text-sm text-gray-400 text-center">No countries found.</li>
                                                            )}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                                                                {/* Postal Code (Moved up) */}
                                        <div>
                                            <label htmlFor="shipping-pincode" className="sr-only">Postal Code</label>
                                            <div className="relative">
                                                <input
                                                    id="shipping-pincode"
                                                    type="text" required
                                                    placeholder={isIndiaCountry(form.country) ? '6-digit PIN Code' : 
                                                                 form.country.trim().toLowerCase() === 'united states of america' ? 'ZIP Code' :
                                                                 ['united kingdom', 'australia'].includes(form.country.trim().toLowerCase()) ? 'Postcode' :
                                                                 'Postal Code'}
                                                    value={form.pincode}
                                                    onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))}
                                                    onBlur={() => touch('pincode')}
                                                    inputMode={isIndiaCountry(form.country) ? 'numeric' : 'text'}
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

                                        {/* Address Details Group */}
                                        <div className="space-y-4 p-4 bg-neutral-50/50 border border-gray-100 rounded-sm">
                                            {/* Street Autocomplete (Address Line) */}
                                            <div>
                                                <label htmlFor="shipping-street" className="sr-only">Address Line</label>
                                                <div className="relative" ref={dropdownRef}>
                                                    <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                    <input
                                                        id="shipping-street"
                                                        type="text" required
                                                        placeholder="House / Flat No., Building, Street Address"
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
                                            </div>

                                            {/* Area / Locality (Dropdown or free-text depending on Pincode) */}
                                            <div className="relative" ref={areaDropdownRef}>
                                                <label htmlFor="shipping-area" className="sr-only">Area / Locality</label>
                                                <div className="relative">
                                                    <Map size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                    <input
                                                        id="shipping-area"
                                                        type="text"
                                                        placeholder="Area / Locality"
                                                        value={isAreaDropdownOpen ? areaSearchQuery : form.area}
                                                        onChange={e => {
                                                            if (isAreaDropdownOpen) {
                                                                setAreaSearchQuery(e.target.value);
                                                            } else {
                                                                setForm(p => ({ ...p, area: e.target.value }));
                                                            }
                                                        }}
                                                        onFocus={() => {
                                                            if (isIndiaCountry(form.country) && form.pincode.length === 6 && pincodeCache[`in_${form.pincode}`]?.areas?.length) {
                                                                setIsAreaDropdownOpen(true);
                                                                setAreaSearchQuery('');
                                                            }
                                                        }}
                                                        onBlur={() => {
                                                            touch('area');
                                                            // If they leave without selecting from dropdown, save what they typed
                                                            if (isAreaDropdownOpen && areaSearchQuery) {
                                                                setForm(p => ({ ...p, area: areaSearchQuery }));
                                                                setIsAreaDropdownOpen(false);
                                                            }
                                                        }}
                                                        className={fieldCls('area')}
                                                        autoComplete="address-level3"
                                                        role="combobox"
                                                        aria-expanded={isAreaDropdownOpen}
                                                        aria-controls="area-listbox"
                                                    />
                                                    {isIndiaCountry(form.country) && form.pincode.length === 6 && pincodeStatus === 'success' && (
                                                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                                    )}
                                                </div>
                                                {errors.area && <p className="text-xs text-red-500 mt-1">{errors.area}</p>}
                                                
                                                {isAreaDropdownOpen && pincodeCache[`in_${form.pincode}`]?.areas && (
                                                    <div className="absolute z-30 w-full mt-1 bg-white border border-silk shadow-2xl rounded-sm max-h-60 overflow-y-auto">
                                                        <ul id="area-listbox" role="listbox">
                                                            {pincodeCache[`in_${form.pincode}`].areas
                                                                .filter(a => a.toLowerCase().includes(areaSearchQuery.toLowerCase()))
                                                                .map(area => (
                                                                    <li
                                                                        key={area}
                                                                        role="option"
                                                                        aria-selected={form.area === area}
                                                                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2 ${form.area === area ? 'bg-red-50 text-dark-red font-medium' : 'text-gray-700'}`}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            setForm(prev => ({ ...prev, area }));
                                                                            setIsAreaDropdownOpen(false);
                                                                            setAreaSearchQuery('');
                                                                        }}
                                                                    >
                                                                        {area}
                                                                    </li>
                                                                ))}
                                                            {pincodeCache[`in_${form.pincode}`].areas
                                                                .filter(a => a.toLowerCase().includes(areaSearchQuery.toLowerCase()))
                                                                .length === 0 && (
                                                                    <li 
                                                                        className="px-4 py-3 text-sm text-dark-red cursor-pointer hover:bg-neutral-50"
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault();
                                                                            setForm(prev => ({ ...prev, area: areaSearchQuery }));
                                                                            setIsAreaDropdownOpen(false);
                                                                        }}
                                                                    >
                                                                        <span className="font-medium">Use typed area:</span> {areaSearchQuery}
                                                                    </li>
                                                                )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* City + State */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="shipping-city" className="sr-only">City</label>
                                                <div className="relative">
                                                    <Map size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                                    <input
                                                        id="shipping-city"
                                                        type="text" required placeholder="City / District"
                                                        value={form.city}
                                                        onChange={e => {
                                                            setForm(p => ({ ...p, city: e.target.value }));
                                                            lastAutofillSourceRef.current = 'none'; setLastAutofillSource('none');
                                                        }}
                                                        onBlur={() => touch('city')}
                                                        className={fieldCls('city')}
                                                    />
                                                </div>
                                                {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                                            </div>
                                            <div>
                                                <label htmlFor="shipping-state" className="sr-only">State</label>
                                                <input
                                                    id="shipping-state"
                                                    type="text" required placeholder="State / Province"
                                                    value={form.state}
                                                    onChange={e => {
                                                        setForm(p => ({ ...p, state: e.target.value }));
                                                        lastAutofillSourceRef.current = 'none'; setLastAutofillSource('none');
                                                    }}
                                                    onBlur={() => touch('state')}
                                                    className={fieldCls('state', false)}
                                                />
                                                {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                                            </div>
                                        </div>
                                    </div>{/* Form actions */}
                                    {quoteError && <p className="text-xs text-red-500 mb-2 text-center">{quoteError}</p>}
                                    <div className="flex gap-4 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate('/cart')}
                                            className="w-1/3 h-12 border border-silk text-dark-red font-sans text-sm tracking-widest uppercase hover:bg-red-50 transition-all rounded-sm"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!isFormValid || isSubmitting || !!quoteError}
                                            aria-disabled={!isFormValid || isSubmitting || !!quoteError}
                                            className={`w-2/3 h-12 font-sans text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all rounded-sm
                                                ${(!isFormValid || isSubmitting || !!quoteError)
                                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    : 'bg-dark-red text-white hover:bg-rose-900 shadow-md hover:shadow-lg active:scale-[0.99]'}`}
                                        >
                                            {isSubmitting ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <>Continue to Payment <ChevronRight size={16} /></>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Actions when saved address is selected */}
                            {hasSavedAndSelected && (
                                <div className="flex gap-4 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => navigate('/cart')}
                                        className="w-1/3 h-12 border border-silk text-dark-red font-sans text-sm tracking-widest uppercase hover:bg-red-50 transition-all rounded-sm"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        aria-disabled={isSubmitting}
                                        className={`w-2/3 h-12 font-sans text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all rounded-sm ${isSubmitting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-dark-red text-white hover:bg-rose-900 shadow-md hover:shadow-lg active:scale-[0.99]'}`}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <>Continue to Payment <ChevronRight size={16} /></>
                                        )}
                                    </button>
                                </div>
                            )}
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
                                                {item.variant && (
                                                    <p className="font-sans text-[10px] text-dark-red/70 uppercase tracking-wider">Shade: {item.variant}</p>
                                                )}
                                                <p className="font-sans text-xs text-gray-500">Qty: {item.quantity}</p>
                                            </div>
                                            <p className="shrink-0 font-sans text-sm font-semibold text-gray-900 pt-1">
                                                {formatPrice(item.product.price * item.quantity)}
                                                {userCurrency === 'USD' && <span className="text-[10px] ml-0.5 opacity-60">*</span>}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t border-silk pt-4 space-y-2 font-sans text-sm text-gray-600">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span>{quoteData.isFetched && quoteData.subtotal !== undefined ? formatCurrency(quoteData.subtotal, quoteData.currency) : formatPrice(cartTotal)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Shipping</span>
                                        <span className={shippingCost === 0 ? 'text-emerald-700 font-medium' : ''}>
                                            {shippingCost === 0 ? 'Free' : quoteData.isFetched ? formatCurrency(shippingCost, quoteData.currency) : formatPrice(shippingCost)}
                                        </span>
                                    </div>
                                    {(quoteData.discountAmount! > 0 || quoteData.isFreeShippingCouponApplied) && (
                                        <div className="flex justify-between text-emerald-600">
                                            <span>
                                                {quoteData.isWelcomeOfferApplied ? 'Welcome Offer (10%)' : quoteData.isFreeShippingCouponApplied && quoteData.discountAmount === 0 ? 'Free Shipping Coupon' : 'Coupon Applied'}
                                            </span>
                                            <span>{quoteData.discountAmount! > 0 ? `-${quoteData.isFetched ? formatCurrency(quoteData.discountAmount!, quoteData.currency) : formatPrice(quoteData.discountAmount!)}` : 'Applied'}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-silk mt-4 pt-4 flex justify-between font-serif text-xl text-dark-red">
                                    <span>Total</span>
                                    <span>
                                        {quoteData.isFetched ? formatCurrency(total, quoteData.currency) : formatPrice(total)}
                                        {quoteData.isFallback && <span className="text-sm ml-1 opacity-60">*</span>}
                                    </span>
                                </div>

                                {/* Disclosure only — GST is already inside Total. Quote amounts
                                    are pre-converted, hence formatCurrency rather than formatPrice. */}
                                {quoteData.isFetched && (quoteData.taxAmount ?? 0) > 0 && (
                                    <div className="mt-1 text-right font-sans text-[11px] text-grey-beige">
                                        Includes GST{quoteData.taxRatePercent ? ` (${quoteData.taxRatePercent}%)` : ''}{' '}
                                        {formatCurrency(quoteData.taxAmount!, quoteData.currency)}
                                    </div>
                                )}

                                <div className="pt-6">
                                    {!appliedCoupon ? (
                                        <div className="space-y-2">
                                            <div className="flex relative">
                                                <input
                                                    type="text"
                                                    value={couponInput}
                                                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                                    placeholder="Promo code"
                                                    className="w-full bg-neutral-50 border border-silk pl-4 pr-24 py-3 text-sm font-sans text-dark-red placeholder:text-gray-400 focus:outline-none focus:border-dark-red focus:ring-1 focus:ring-dark-red/20 rounded-sm transition-all uppercase"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleApplyCoupon}
                                                    disabled={isApplyingCoupon || !couponInput.trim()}
                                                    className="absolute right-1 top-1 bottom-1 px-4 bg-dark-red text-white font-sans text-xs tracking-widest uppercase hover:bg-rose-900 transition-colors disabled:bg-gray-200 disabled:text-gray-400 rounded-sm cursor-pointer"
                                                >
                                                    {isApplyingCoupon ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Apply'}
                                                </button>
                                            </div>
                                            {couponError && <p className="text-xs text-red-500 font-sans flex items-center gap-1"><AlertCircle size={12} /> {couponError}</p>}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-sm transition-all">
                                            <div className="flex items-center gap-2 text-emerald-700 font-sans font-medium text-sm">
                                                <CheckCircle2 size={16} />
                                                <span className="tracking-wide uppercase text-xs">{appliedCoupon} Applied</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAppliedCoupon(null);
                                                    setCouponInput('');
                                                    setCouponError(null);
                                                }}
                                                className="text-xs text-gray-400 hover:text-red-500 font-sans uppercase tracking-widest transition-colors cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6">
                                    {shippingCost === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-1 text-emerald-700 bg-emerald-50 p-4 rounded-sm border border-emerald-100 text-sm font-medium tracking-wide">
                                            <div className="flex items-center gap-2"><CheckCircle2 size={16} /> You've unlocked Free Shipping!</div>
                                        </div>
                                    ) : (
                                        <div className="bg-neutral-50 p-4 rounded-sm border border-silk space-y-2">
                                            <div className="flex justify-between text-xs font-sans text-gray-600">
                                                <span>Add {formatPrice(quoteData.threshold - cartTotal)} for Free Shipping</span>
                                                <span className="font-medium text-dark-red">{formatPrice(cartTotal)} / {formatPrice(quoteData.threshold)}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className="bg-dark-red h-full rounded-full transition-all duration-500 ease-out"
                                                    style={{ width: `${Math.min(100, (cartTotal / quoteData.threshold) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {quoteError && (
                                    <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs font-sans border border-red-200 rounded text-center">
                                        {quoteError}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
                <Footer />
            </div>
        </RequireAuth>
    );
}
