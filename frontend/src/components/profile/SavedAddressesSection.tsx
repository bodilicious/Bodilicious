/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { User, Address } from '../../types';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, CheckCircle, X } from 'lucide-react';

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
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="ml-3 flex-1 flex flex-col justify-center">
                            <p className="text-sm font-medium text-gray-900 mb-1">Delete Address?</p>
                            <p className="text-sm text-gray-500">Are you sure you want to remove this address?</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col border-l border-gray-200">
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await deleteAddress(id);
                                toast.success('Address deleted');
                            } catch (e: any) {
                                toast.error(e.message || 'Failed to delete');
                            }
                        }}
                        className="w-full border border-transparent rounded-none rounded-tr-lg p-3 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 transition-colors"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="w-full border-t border-gray-200 border-l-0 border-b-0 border-r-0 rounded-none rounded-br-lg p-3 flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-500 transition-colors"
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
                toast.success("Address updated");
            } else {
                await addAddress(formData);
                toast.success("Address added");
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
        <div className="bg-[#EFE7DF] p-6 mb-8 border border-[#D8C7B8] rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-[#3E2C23] text-xl">Saved Addresses</h3>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-1 text-[#8B5E3C] hover:text-[#3E2C23] font-sans text-sm transition-colors"
                >
                    <Plus size={16} /> Add New
                </button>
            </div>

            {addresses.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-[#D8C7B8] rounded-lg bg-[#F8F4EF]">
                    <p className="font-sans text-[#3E2C23]/70 mb-4">You haven't saved any addresses yet.</p>
                    <button
                        onClick={openAdd}
                        className="text-[#8B5E3C] font-semibold text-sm hover:underline"
                    >
                        Add an Address
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                        <div key={addr._id} className={`p-4 rounded-lg border bg-[#F8F4EF] transition-all relative group ${addr.isDefault ? 'border-[#8B5E3C] ring-1 ring-[#8B5E3C]/20' : 'border-[#D8C7B8] hover:border-[#8B5E3C]/50'}`}>

                            {addr.isDefault && (
                                <span className="absolute top-4 right-4 text-[#8B5E3C] flex items-center gap-1 text-xs font-semibold uppercase tracking-wider bg-[#EFE7DF] px-2 py-1 rounded">
                                    <CheckCircle size={12} /> Default
                                </span>
                            )}

                            <h4 className="font-serif text-[#3E2C23] text-lg mb-1 pr-20">{addr.name}</h4>
                            <p className="font-sans text-sm text-[#3E2C23]/80 mb-3">{addr.phone}</p>

                            <div className="font-sans text-sm text-[#3E2C23]/70 leading-relaxed min-h-[60px]">
                                {addr.addressLine}<br />
                                {addr.city}, {addr.state} {addr.pincode}
                            </div>

                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#D8C7B8]/50">
                                <button onClick={() => openEdit(addr)} className="text-[#8B5E3C] hover:text-[#3E2C23] text-sm flex items-center gap-1 transition-colors">
                                    <Edit2 size={14} /> Edit
                                </button>
                                <button onClick={() => addr._id && handleDelete(addr._id)} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 transition-colors">
                                    <Trash2 size={14} /> Delete
                                </button>
                                {!addr.isDefault && addr._id && (
                                    <button onClick={() => setDefaultAddress(addr._id!)} className="ml-auto text-xs text-[#3E2C23]/50 hover:text-[#8B5E3C] transition-colors">
                                        Set Default
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Address Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3E2C23]/40 p-4 backdrop-blur-sm">
                    <div className="bg-[#EFE7DF] max-w-lg w-full p-6 relative rounded-xl shadow-2xl border border-[#D8C7B8]">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-[#3E2C23]/50 hover:text-[#8B5E3C] transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="font-serif text-[#3E2C23] text-2xl mb-6">
                            {editingId ? 'Edit Address' : 'Add New Address'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block font-sans text-xs text-[#3E2C23]/80 mb-1">Full Name</label>
                                    <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 bg-[#F8F4EF] border border-[#D8C7B8] rounded font-sans text-sm outline-none focus:border-[#8B5E3C] text-[#3E2C23]" />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block font-sans text-xs text-[#3E2C23]/80 mb-1">Phone Number</label>
                                    <input required type="tel" pattern="[0-9]{10}" title="10 digit phone number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full p-2.5 bg-[#F8F4EF] border border-[#D8C7B8] rounded font-sans text-sm outline-none focus:border-[#8B5E3C] text-[#3E2C23]" />
                                </div>
                            </div>

                            <div>
                                <label className="block font-sans text-xs text-[#3E2C23]/80 mb-1">Street Address</label>
                                <input required type="text" value={formData.addressLine} onChange={e => setFormData({ ...formData, addressLine: e.target.value })} className="w-full p-2.5 bg-[#F8F4EF] border border-[#D8C7B8] rounded font-sans text-sm outline-none focus:border-[#8B5E3C] text-[#3E2C23]" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-sans text-xs text-[#3E2C23]/80 mb-1">City</label>
                                    <input required type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="w-full p-2.5 bg-[#F8F4EF] border border-[#D8C7B8] rounded font-sans text-sm outline-none focus:border-[#8B5E3C] text-[#3E2C23]" />
                                </div>
                                <div>
                                    <label className="block font-sans text-xs text-[#3E2C23]/80 mb-1">State</label>
                                    <input required type="text" value={formData.state} onChange={e => setFormData({ ...formData, state: e.target.value })} className="w-full p-2.5 bg-[#F8F4EF] border border-[#D8C7B8] rounded font-sans text-sm outline-none focus:border-[#8B5E3C] text-[#3E2C23]" />
                                </div>
                            </div>

                            <div>
                                <label className="block font-sans text-xs text-[#3E2C23]/80 mb-1">Pincode</label>
                                <input required type="text" pattern="[0-9]{6}" title="6 digit pincode" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} className="w-full p-2.5 bg-[#F8F4EF] border border-[#D8C7B8] rounded font-sans text-sm outline-none focus:border-[#8B5E3C] text-[#3E2C23]" />
                            </div>

                            <div className="flex items-center gap-2 mt-4 pt-2">
                                <input
                                    type="checkbox"
                                    id="defaultAddr"
                                    checked={formData.isDefault}
                                    onChange={e => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="w-4 h-4 rounded border-[#D8C7B8] focus:ring-[#8B5E3C] accent-[#8B5E3C]"
                                />
                                <label htmlFor="defaultAddr" className="font-sans text-sm text-[#3E2C23]">Set as default address</label>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full mt-6 bg-[#8B5E3C] text-white py-3 rounded font-sans text-sm tracking-widest uppercase hover:bg-[#3E2C23] transition-colors disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save Address'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
