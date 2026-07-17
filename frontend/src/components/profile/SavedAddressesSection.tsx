import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Address } from '../../types';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, CheckCircle, X, MapPin, User as UserIcon, Phone, Map, Building, Loader2, Globe, ChevronRight, Search, ChevronDown } from 'lucide-react';

import { getCountryFlag, COUNTRY_ISO_MAP, COUNTRIES } from '../../utils/countries';

const INDIA_ALIASES = new Set(['india', 'in', 'bharat', 'ind']);
function isIndiaCountry(c: string) {
    return !c.trim() || INDIA_ALIASES.has(c.toLowerCase().trim());
}
const getIsoAlpha2Code = (countryName: string) => {
    return COUNTRY_ISO_MAP[countryName]?.toLowerCase() || '';
};
const pincodeCache: Record<string, { city: string; state: string; areas: string[] }> = {};
interface Props {
    user: User | null;
    addAddress: (addr: Omit<Address, '_id'>) => Promise<void>;
    updateAddress: (id: string, addr: Partial<Address>) => Promise<void>;
    deleteAddress: (id: string) => Promise<void>;
    setDefaultAddress: (id: string) => Promise<void>;
}

export default function SavedAddressesSection({ user, addAddress, updateAddress, deleteAddress, setDefaultAddress }: Props) {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        addressLine: '',
        area: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        isDefault: false
    });
    const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
    const [countrySearchQuery, setCountrySearchQuery] = useState('');

    const inputBase = 'w-full h-11 pr-3 border bg-neutral-50 font-sans text-sm focus:outline-none transition-all rounded-sm placeholder:text-gray-400';
    const inputNormal = 'border-silk focus:border-dark-red focus:ring-2 focus:ring-dark-red/20';
    const fieldCls = (hasIcon = true) => `${inputBase} ${hasIcon ? 'pl-10' : 'pl-3'} ${inputNormal}`;

    const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [pincodeMsg, setPincodeMsg] = useState('');
    const pincodeAbortRef = useRef<AbortController | null>(null);

    const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
    const [areaSearchQuery, setAreaSearchQuery] = useState('');
    const areaDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
                setIsAreaDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const rawPin = formData.pincode.trim();
        const isIndia = isIndiaCountry(formData.country);
        const isoCode = isIndia ? 'in' : getIsoAlpha2Code(formData.country);

        if (!isoCode || (isIndia && rawPin.length < 6) || (!isIndia && rawPin.length < 3)) {
            setPincodeStatus('idle');
            setPincodeMsg('');
            if (isIndia) {
                const cleanPin = rawPin.replace(/\D/g, '').slice(0, 6);
                if (cleanPin !== formData.pincode) {
                    setFormData(prev => ({ ...prev, pincode: cleanPin, area: '' }));
                    setAreaSearchQuery('');
                }
            }
            return;
        }

        let pinToFetch = rawPin;
        if (isIndia) {
            pinToFetch = rawPin.replace(/\D/g, '').slice(0, 6);
            if (pinToFetch !== formData.pincode) {
                setFormData(prev => ({ ...prev, pincode: pinToFetch, area: '' }));
                setAreaSearchQuery('');
            }
            if (pinToFetch.length !== 6) return;
        }

        const cacheKey = `${isoCode}_${pinToFetch.toLowerCase()}`;

        if (pincodeCache[cacheKey]) {
            const c = pincodeCache[cacheKey];
            setFormData(prev => ({
                ...prev,
                city: c.city || prev.city,
                state: c.state || prev.state,
                country: isIndia ? 'India' : prev.country,
            }));
            setPincodeStatus('success');
            if (isIndia && c.areas.length) {
                const areaStr = c.areas.slice(0, 3).join(', ') + (c.areas.length > 3 ? '...' : '');
                setPincodeMsg(`Auto-filled: ${c.city}, ${c.state} (${areaStr})`);
            } else {
                setPincodeMsg(`Auto-filled: ${c.city}, ${c.state}`);
            }
            return;
        }

        pincodeAbortRef.current?.abort();
        const ctrl = new AbortController();
        pincodeAbortRef.current = ctrl;
        setPincodeStatus('loading');
        setPincodeMsg('');

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
                    setFormData(prev => ({
                        ...prev,
                        city: city || prev.city,
                        state: state || prev.state,
                        country: isIndia ? 'India' : prev.country,
                    }));
                    setPincodeStatus('success');
                    
                    if (isIndia && areas.length) {
                        const areaStr = areas.slice(0, 3).join(', ') + (areas.length > 3 ? '...' : '');
                        setPincodeMsg(`Auto-filled: ${city}, ${state} (${areaStr})`);
                    } else {
                        setPincodeMsg(`Auto-filled: ${city}, ${state}`);
                    }
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
    }, [formData.pincode, formData.country]);

    const addresses = user?.addresses || [];

    const openAdd = () => {
        setFormData({ name: '', phone: '', addressLine: '', area: '', city: '', state: '', pincode: '', country: 'India', isDefault: false });
        setEditingId(null);
        setIsModalOpen(true);
    };

    const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const isIndia = isIndiaCountry(formData.country);
        setFormData(prev => ({ ...prev, pincode: isIndia ? val.replace(/\D/g, '') : val }));
    };

    const openEdit = (addr: Address) => {
        setFormData({
            name: addr.name,
            phone: addr.phone,
            addressLine: addr.addressLine,
            area: addr.area || '',
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            country: addr.country || 'India',
            isDefault: addr.isDefault
        });
        setEditingId(addr._id || null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 overflow-hidden`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="ml-3 flex-1 flex flex-col justify-center">
                            <p className="text-sm font-semibold text-gray-900 mb-1">Delete Address?</p>
                            <p className="text-sm text-gray-500">Are you sure you want to remove this address? This action cannot be undone.</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col border-l border-gray-100 bg-gray-50">
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await deleteAddress(id);
                                toast.success('Address deleted successfully');
                            } catch (e: any) {
                                toast.error(e.message || 'Failed to delete address');
                            }
                        }}
                        className="w-full border border-transparent rounded-none p-3 flex items-center justify-center text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500 transition-colors"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="w-full border-t border-gray-200 border-l-0 border-b-0 border-r-0 rounded-none p-3 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: Infinity });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingId) {
                await updateAddress(editingId, formData);
                toast.success("Address updated successfully");
            } else {
                await addAddress(formData);
                toast.success("Address added successfully");
            }
            setIsModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to save address');
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <div className="animate-pulse h-48 bg-[#EFE7DF] rounded-xl border border-[#D8C7B8] mb-8"></div>;

    return (
        <div className="bg-[#EFE7DF] p-6 sm:p-8 mb-8 border border-[#D8C7B8] rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                    <MapPin className="text-[#8B5E3C]" size={24} />
                    <h3 className="font-serif text-[#3E2C23] text-2xl">Saved Addresses</h3>
                </div>
                <button
                    onClick={openAdd}
                    className="group flex items-center gap-2 text-white bg-[#8B5E3C] px-4 py-2 rounded-lg font-sans text-sm font-medium transition-all duration-300 hover:bg-[#3E2C23] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:ring-offset-2 focus:ring-offset-[#EFE7DF]"
                    aria-label="Add New Address"
                >
                    <Plus size={16} className="transition-transform duration-300 group-hover:rotate-90" /> 
                    <span className="hidden sm:inline">Add New</span>
                </button>
            </div>

            {addresses.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[#D8C7B8] rounded-xl bg-[#F8F4EF] transition-colors hover:border-[#8B5E3C]/50">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#EFE7DF] text-[#8B5E3C] mb-4">
                        <MapPin size={24} />
                    </div>
                    <p className="font-sans text-[#3E2C23]/80 mb-4 text-base">You haven't saved any delivery addresses yet.</p>
                    <button
                        onClick={openAdd}
                        className="text-[#8B5E3C] font-semibold text-sm hover:text-[#3E2C23] hover:underline focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:ring-offset-2 rounded px-2 py-1 transition-colors"
                    >
                        + Add your first address
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {addresses.map((addr) => (
                        <div 
                            key={addr._id} 
                            className={`p-6 rounded-xl border bg-[#F8F4EF] transition-all duration-300 relative group flex flex-col justify-between ${
                                addr.isDefault 
                                    ? 'border-[#8B5E3C] shadow-sm ring-1 ring-[#8B5E3C]/20' 
                                    : 'border-[#D8C7B8] hover:border-[#8B5E3C]/60 hover:shadow-md hover:-translate-y-0.5'
                            }`}
                        >
                            <div>
                                {addr.isDefault && (
                                    <span className="absolute top-5 right-5 text-[#8B5E3C] flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider bg-[#EFE7DF] px-2.5 py-1 rounded-md shadow-sm">
                                        <CheckCircle size={14} /> Default
                                    </span>
                                )}

                                <h4 className="font-serif text-[#3E2C23] text-lg font-medium mb-1.5 pr-24 line-clamp-1" title={addr.name}>{addr.name}</h4>
                                <p className="font-sans text-sm text-[#3E2C23]/70 mb-4 font-medium">{addr.phone}</p>

                                <div className="font-sans text-sm text-[#3E2C23]/80 leading-relaxed min-h-[60px] mb-4">
                                    <span className="block mb-1">{addr.addressLine}</span>
                                    <span className="block text-[#3E2C23]/70">{addr.city}, {addr.state} {addr.pincode}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-4 border-t border-[#D8C7B8]/60 mt-auto">
                                <button 
                                    onClick={() => openEdit(addr)} 
                                    className="text-[#8B5E3C] hover:text-[#3E2C23] text-sm font-medium flex items-center gap-1.5 transition-colors focus:outline-none focus:underline whitespace-nowrap"
                                    aria-label={`Edit address for ${addr.name}`}
                                >
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button 
                                    onClick={() => addr._id && handleDelete(addr._id)} 
                                    className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1.5 transition-colors focus:outline-none focus:underline whitespace-nowrap"
                                    aria-label={`Delete address for ${addr.name}`}
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                                {!addr.isDefault && addr._id && (
                                    <button 
                                        onClick={() => setDefaultAddress(addr._id!)} 
                                        className="ml-auto text-xs font-medium text-[#3E2C23]/60 hover:text-[#8B5E3C] transition-colors focus:outline-none focus:underline whitespace-nowrap"
                                    >
                                        Set Default
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Address Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 opacity-100 transition-opacity duration-300">
                    <div 
                        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                        aria-hidden="true"
                    />
                    <div 
                        className="bg-white max-w-xl w-full max-h-[95vh] overflow-y-auto p-6 sm:p-8 relative rounded-sm shadow-2xl border border-silk z-10 transform scale-100 transition-transform duration-300"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-5 right-5 text-gray-400 hover:text-dark-red hover:bg-red-50 p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-dark-red"
                            aria-label="Close modal"
                        >
                            <X size={20} />
                        </button>

                        <h2 id="modal-title" className="font-serif text-3xl text-dark-red mb-8 pr-10">
                            {editingId ? 'Edit Address' : 'Add New Address'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">

                                {/* Name + Phone */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="name" className="sr-only">Full Name</label>
                                        <div className="relative">
                                            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input 
                                                id="name"
                                                required 
                                                type="text" 
                                                value={formData.name} 
                                                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                                className={fieldCls(true)}
                                                placeholder="Full Name"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="phone" className="sr-only">Phone Number</label>
                                        <div className="relative">
                                            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input 
                                                id="phone"
                                                required 
                                                type="tel" 
                                                inputMode="numeric"
                                                pattern="[0-9]{10}" 
                                                title="Please enter a valid 10-digit phone number" 
                                                value={formData.phone} 
                                                onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} 
                                                className={fieldCls(true)}
                                                placeholder="Phone Number"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Country + Postal Code */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Country Dropdown */}
                                    <div className="relative">
                                        <label htmlFor="country" className="sr-only">Country</label>
                                        <div className="relative">
                                            <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <button
                                                id="country"
                                                type="button"
                                                onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                                                className={`${fieldCls(true)} text-left flex items-center justify-between cursor-pointer w-full bg-white`}
                                            >
                                                <span className="truncate flex items-center gap-2">
                                                    {formData.country && getCountryFlag(formData.country) && (
                                                        <span className="text-lg">{getCountryFlag(formData.country)}</span>
                                                    )}
                                                    {formData.country || 'Select Country'}
                                                </span>
                                                <ChevronRight size={16} className={`text-gray-400 transition-transform ${isCountryDropdownOpen ? 'rotate-90' : ''}`} />
                                            </button>
                                        </div>

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
                                                                aria-selected={formData.country === c}
                                                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2 ${formData.country === c ? 'bg-red-50 text-dark-red font-medium' : 'text-gray-700'}`}
                                                                onMouseDown={() => {
                                                                    setFormData(prev => ({ ...prev, country: c }));
                                                                    setIsCountryDropdownOpen(false);
                                                                    setCountrySearchQuery('');
                                                                }}
                                                            >
                                                                {getCountryFlag(c) && <span className="text-lg">{getCountryFlag(c)}</span>}
                                                                {c}
                                                            </li>
                                                        ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Postal Code */}
                                    <div>
                                        <label htmlFor="pincode" className="sr-only">Pincode</label>
                                        <div className="relative">
                                            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input 
                                                id="pincode"
                                                required 
                                                type="text" 
                                                value={formData.pincode} 
                                                onChange={handlePincodeChange} 
                                                className={fieldCls(true)}
                                                placeholder={isIndiaCountry(formData.country) ? "PIN Code (6 digits)" : "Postal Code"}
                                            />
                                            {pincodeStatus === 'loading' && (
                                                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-red animate-spin" />
                                            )}
                                        </div>
                                        {pincodeMsg && (
                                            <p className={`text-xs mt-1 ${pincodeStatus === 'error' ? 'text-red-500' : 'text-green-600 font-medium'}`}>
                                                {pincodeMsg}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Address Details Group */}
                                <div className="space-y-4 p-4 bg-neutral-50/50 border border-gray-100 rounded-sm">
                                    <div>
                                        <label htmlFor="addressLine" className="sr-only">Street Address</label>
                                        <div className="relative">
                                            <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input 
                                                id="addressLine"
                                                required 
                                                type="text" 
                                                value={formData.addressLine} 
                                                onChange={e => setFormData({ ...formData, addressLine: e.target.value })} 
                                                className={fieldCls(true)}
                                                placeholder="House / Flat No., Building, Street Address"
                                            />
                                        </div>
                                    </div>
                                    <div ref={areaDropdownRef}>
                                        <label htmlFor="area" className="sr-only">Area / Locality</label>
                                        <div className="relative">
                                            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input 
                                                id="area"
                                                type="text" 
                                                value={isAreaDropdownOpen ? areaSearchQuery : formData.area} 
                                                onChange={e => {
                                                    if (isAreaDropdownOpen) {
                                                        setAreaSearchQuery(e.target.value);
                                                    } else {
                                                        setFormData(p => ({ ...p, area: e.target.value }));
                                                    }
                                                }}
                                                onFocus={() => {
                                                    if (isIndiaCountry(formData.country) && formData.pincode.length === 6 && pincodeCache[`in_${formData.pincode}`]?.areas?.length) {
                                                        setIsAreaDropdownOpen(true);
                                                        setAreaSearchQuery('');
                                                    }
                                                }}
                                                onBlur={() => {
                                                    if (isAreaDropdownOpen && areaSearchQuery) {
                                                        setFormData(p => ({ ...p, area: areaSearchQuery }));
                                                        setIsAreaDropdownOpen(false);
                                                    }
                                                }}
                                                className={fieldCls(true)}
                                                placeholder="Area / Locality"
                                                autoComplete="address-level3"
                                                role="combobox"
                                                aria-expanded={isAreaDropdownOpen}
                                                aria-controls="area-listbox"
                                            />
                                            {isIndiaCountry(formData.country) && formData.pincode.length === 6 && pincodeStatus === 'success' && (
                                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            )}
                                        </div>
                                        {isAreaDropdownOpen && pincodeCache[`in_${formData.pincode}`]?.areas && (
                                            <div className="absolute z-30 w-full mt-1 bg-white border border-silk shadow-2xl rounded-sm max-h-60 overflow-y-auto">
                                                <ul id="area-listbox" role="listbox">
                                                    {pincodeCache[`in_${formData.pincode}`].areas
                                                        .filter(a => a.toLowerCase().includes(areaSearchQuery.toLowerCase()))
                                                        .map(area => (
                                                            <li
                                                                key={area}
                                                                role="option"
                                                                aria-selected={formData.area === area}
                                                                className={`px-4 py-2 text-sm cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2 ${formData.area === area ? 'bg-red-50 text-dark-red font-medium' : 'text-gray-700'}`}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setFormData(prev => ({ ...prev, area }));
                                                                    setIsAreaDropdownOpen(false);
                                                                    setAreaSearchQuery('');
                                                                }}
                                                            >
                                                                {area}
                                                            </li>
                                                        ))}
                                                    {pincodeCache[`in_${formData.pincode}`].areas
                                                        .filter(a => a.toLowerCase().includes(areaSearchQuery.toLowerCase()))
                                                        .length === 0 && (
                                                            <li 
                                                                className="px-4 py-3 text-sm text-dark-red cursor-pointer hover:bg-neutral-50"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setFormData(prev => ({ ...prev, area: areaSearchQuery }));
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
                                        <label htmlFor="city" className="sr-only">City</label>
                                        <div className="relative">
                                            <Map size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                                            <input 
                                                id="city"
                                                required 
                                                type="text" 
                                                value={formData.city} 
                                                onChange={e => setFormData({ ...formData, city: e.target.value })} 
                                                className={fieldCls(true)}
                                                placeholder="City / District"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="state" className="sr-only">State</label>
                                        <input 
                                            id="state"
                                            required 
                                            type="text" 
                                            value={formData.state} 
                                            onChange={e => setFormData({ ...formData, state: e.target.value })} 
                                            className={fieldCls(false)}
                                            placeholder="State / Province"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-2 px-2">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        id="defaultAddr"
                                        checked={formData.isDefault}
                                        onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                                        className="w-5 h-5 rounded border-silk text-dark-red focus:ring-dark-red focus:ring-2 focus:ring-offset-2 focus:ring-offset-white transition-colors cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="defaultAddr" className="font-sans text-sm font-medium text-gray-700 cursor-pointer select-none">
                                    Set as default delivery address
                                </label>
                            </div>

                            <div className="pt-4 mt-2">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full h-12 bg-dark-red text-white py-3.5 px-4 rounded-sm font-sans text-sm font-bold tracking-widest uppercase hover:bg-rose-900 shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        'Save Address'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
