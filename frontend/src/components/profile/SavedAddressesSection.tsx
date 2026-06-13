import { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Address } from '../../types';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, CheckCircle, X, MapPin } from 'lucide-react';

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
        city: '',
        state: '',
        pincode: '',
        isDefault: false
    });

    const addresses = user?.addresses || [];

    const openAdd = () => {
        setFormData({ name: '', phone: '', addressLine: '', city: '', state: '', pincode: '', isDefault: false });
        setEditingId(null);
        setIsModalOpen(true);
    };

    const openEdit = (addr: Address) => {
        setFormData({
            name: addr.name,
            phone: addr.phone,
            addressLine: addr.addressLine,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
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
                        className="absolute inset-0 bg-[#3E2C23]/60 backdrop-blur-sm"
                        onClick={() => setIsModalOpen(false)}
                        aria-hidden="true"
                    />
                    <div 
                        className="bg-[#EFE7DF] max-w-xl w-full max-h-[95vh] overflow-y-auto p-6 sm:p-8 relative rounded-2xl shadow-2xl border border-[#D8C7B8] z-10 transform scale-100 transition-transform duration-300"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-5 right-5 text-[#3E2C23]/50 hover:text-[#8B5E3C] hover:bg-[#D8C7B8]/30 p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
                            aria-label="Close modal"
                        >
                            <X size={20} />
                        </button>

                        <h2 id="modal-title" className="font-serif text-[#3E2C23] text-2xl mb-8 pr-10">
                            {editingId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="name" className="block font-sans text-sm font-medium text-[#3E2C23]/90 mb-1.5">Full Name</label>
                                    <input 
                                        id="name"
                                        required 
                                        type="text" 
                                        value={formData.name} 
                                        onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                        className="w-full p-3 bg-[#F8F4EF] border border-[#D8C7B8] rounded-lg font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C] text-[#3E2C23] transition-all placeholder:text-[#3E2C23]/40"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="phone" className="block font-sans text-sm font-medium text-[#3E2C23]/90 mb-1.5">Phone Number</label>
                                    <input 
                                        id="phone"
                                        required 
                                        type="tel" 
                                        inputMode="numeric"
                                        pattern="[0-9]{10}" 
                                        title="Please enter a valid 10-digit phone number" 
                                        value={formData.phone} 
                                        onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} 
                                        className="w-full p-3 bg-[#F8F4EF] border border-[#D8C7B8] rounded-lg font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C] text-[#3E2C23] transition-all placeholder:text-[#3E2C23]/40"
                                        placeholder="9876543210"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="addressLine" className="block font-sans text-sm font-medium text-[#3E2C23]/90 mb-1.5">Street Address</label>
                                <input 
                                    id="addressLine"
                                    required 
                                    type="text" 
                                    value={formData.addressLine} 
                                    onChange={e => setFormData({ ...formData, addressLine: e.target.value })} 
                                    className="w-full p-3 bg-[#F8F4EF] border border-[#D8C7B8] rounded-lg font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C] text-[#3E2C23] transition-all placeholder:text-[#3E2C23]/40"
                                    placeholder="House/Flat No., Building Name, Street"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="city" className="block font-sans text-sm font-medium text-[#3E2C23]/90 mb-1.5">City</label>
                                    <input 
                                        id="city"
                                        required 
                                        type="text" 
                                        value={formData.city} 
                                        onChange={e => setFormData({ ...formData, city: e.target.value })} 
                                        className="w-full p-3 bg-[#F8F4EF] border border-[#D8C7B8] rounded-lg font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C] text-[#3E2C23] transition-all placeholder:text-[#3E2C23]/40"
                                        placeholder="Mumbai"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="state" className="block font-sans text-sm font-medium text-[#3E2C23]/90 mb-1.5">State</label>
                                    <input 
                                        id="state"
                                        required 
                                        type="text" 
                                        value={formData.state} 
                                        onChange={e => setFormData({ ...formData, state: e.target.value })} 
                                        className="w-full p-3 bg-[#F8F4EF] border border-[#D8C7B8] rounded-lg font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C] text-[#3E2C23] transition-all placeholder:text-[#3E2C23]/40"
                                        placeholder="Maharashtra"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="pincode" className="block font-sans text-sm font-medium text-[#3E2C23]/90 mb-1.5">Pincode</label>
                                <input 
                                    id="pincode"
                                    required 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]{6}" 
                                    title="Please enter a valid 6-digit pincode" 
                                    value={formData.pincode} 
                                    onChange={e => setFormData({ ...formData, pincode: e.target.value.replace(/\D/g, '') })} 
                                    className="w-full p-3 bg-[#F8F4EF] border border-[#D8C7B8] rounded-lg font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C] text-[#3E2C23] transition-all placeholder:text-[#3E2C23]/40"
                                    placeholder="400001"
                                />
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-2">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        id="defaultAddr"
                                        checked={formData.isDefault}
                                        onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                                        className="w-5 h-5 rounded border-[#D8C7B8] text-[#8B5E3C] focus:ring-[#8B5E3C] focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#EFE7DF] transition-colors cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="defaultAddr" className="font-sans text-sm font-medium text-[#3E2C23] cursor-pointer select-none">
                                    Set as default delivery address
                                </label>
                            </div>

                            <div className="pt-4 mt-2">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full bg-[#8B5E3C] text-white py-3.5 px-4 rounded-lg font-sans text-sm font-bold tracking-wider uppercase hover:bg-[#3E2C23] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#8B5E3C] focus:ring-offset-2 focus:ring-offset-[#EFE7DF] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving...
                                        </>
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
