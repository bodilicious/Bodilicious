import { useState, useEffect } from 'react';
import { User } from '../../types';
import toast from 'react-hot-toast';
import Select from '../Select';

interface Props {
    user: User | null;
    onSave: (data: Partial<User>) => Promise<void>;
}

export default function PersonalInfoForm({ user, onSave }: Props) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        displayName: '',
        phone: '',
        gender: 'Prefer not to say',
        dateOfBirth: '',
    });

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || '',
                phone: user.phone || '',
                gender: user.gender || 'Prefer not to say',
                dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
            });
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                displayName: formData.displayName,
                phone: formData.phone,
                gender: formData.gender as any,
                dateOfBirth: formData.dateOfBirth || undefined,
            });
            toast.success("Personal information updated");
            setIsEditing(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to update information");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <div className="animate-pulse h-64 bg-[#EFE7DF] rounded-xl border border-[#D8C7B8] mb-8"></div>;

    return (
        <div className="bg-[#EFE7DF] p-6 mb-8 border border-[#D8C7B8] rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-[#3E2C23] text-xl">Personal Information</h3>
                {!isEditing && (
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-[#8B5E3C] hover:text-[#3E2C23] font-sans text-sm underline underline-offset-4 transition-colors"
                    >
                        Edit
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block font-sans text-sm text-[#3E2C23]/80">Full Name</label>
                        <input
                            disabled={!isEditing}
                            required
                            type="text"
                            value={formData.displayName}
                            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                            className="w-full p-3 border border-[#D8C7B8] bg-[#F8F4EF] rounded-md font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]/20 disabled:opacity-70 transition-all text-[#3E2C23]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block font-sans text-sm text-[#3E2C23]/80">Email Address</label>
                        <input
                            disabled
                            type="email"
                            value={user.email || ''}
                            className="w-full p-3 border border-[#D8C7B8] bg-[#F8F4EF] rounded-md font-sans text-sm outline-none disabled:opacity-60 text-[#3E2C23]/70 cursor-not-allowed"
                            title="Email address cannot be changed directly"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block font-sans text-sm text-[#3E2C23]/80">Phone Number</label>
                        <input
                            disabled={!isEditing}
                            type="tel"
                            pattern="[0-9]{10}"
                            title="Please enter a valid 10-digit phone number"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full p-3 border border-[#D8C7B8] bg-[#F8F4EF] rounded-md font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]/20 disabled:opacity-70 transition-all text-[#3E2C23]"
                            placeholder="10-digit mobile number"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block font-sans text-sm text-[#3E2C23]/80">Gender</label>
                        <Select
                            disabled={!isEditing}
                            value={formData.gender}
                            onChange={(val) => setFormData({ ...formData, gender: val as string })}
                            options={[
                                { value: 'Male', label: 'Male' },
                                { value: 'Female', label: 'Female' },
                                { value: 'Non-binary', label: 'Non-binary' },
                                { value: 'Prefer not to say', label: 'Prefer not to say' }
                            ]}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block font-sans text-sm text-[#3E2C23]/80">Date of Birth</label>
                        <input
                            disabled={!isEditing}
                            type="date"
                            max={new Date().toISOString().split('T')[0]}
                            value={formData.dateOfBirth}
                            onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                            className="w-full p-3 border border-[#D8C7B8] bg-[#F8F4EF] rounded-md font-sans text-sm outline-none focus:border-[#8B5E3C] focus:ring-1 focus:ring-[#8B5E3C]/20 disabled:opacity-70 transition-all text-[#3E2C23]"
                        />
                    </div>
                </div>

                {isEditing && (
                    <div className="flex items-center gap-4 pt-4 border-t border-[#D8C7B8]/50 mt-6">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-[#8B5E3C] text-white px-8 py-2.5 rounded-md font-sans text-sm uppercase tracking-wider hover:bg-[#3E2C23] transition-colors disabled:opacity-60 flex items-center justify-center min-w-[140px]"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(false);
                                setFormData({
                                    displayName: user.displayName || '',
                                    phone: user.phone || '',
                                    gender: user.gender || 'Prefer not to say',
                                    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
                                });
                            }}
                            disabled={isSaving}
                            className="text-[#3E2C23]/70 hover:text-[#3E2C23] font-sans text-sm px-4 py-2 disabled:opacity-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
