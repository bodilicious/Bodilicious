import { useState } from 'react';
import { User } from '../../types';
import { Shield, Smartphone, Key, AlertCircle } from 'lucide-react';

interface Props {
    user: User | null;
}

export default function SecuritySection({ user }: Props) {
    const [showComingSoon, setShowComingSoon] = useState<string | null>(null);

    const handleSoon = (feature: string) => {
        setShowComingSoon(feature);
        setTimeout(() => setShowComingSoon(null), 3000);
    };

    if (!user) return <div className="animate-pulse h-48 bg-[#EFE7DF] rounded-xl border border-[#D8C7B8] mb-8"></div>;

    return (
        <div className="bg-[#EFE7DF] p-6 mb-8 border border-[#D8C7B8] rounded-xl shadow-sm">
            <h3 className="font-serif text-[#3E2C23] text-xl mb-6">Security Settings</h3>

            <div className="space-y-4">

                {/* Change Password - Kept Real if Auth Allows */}
                <div className="bg-[#F8F4EF] border border-[#D8C7B8] p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#EFE7DF] flex items-center justify-center text-[#8B5E3C]">
                            <Key size={18} />
                        </div>
                        <div>
                            <h4 className="font-sans font-medium text-[#3E2C23] text-sm mb-1">Change Password</h4>
                            <p className="font-sans text-xs text-[#3E2C23]/70">Update your password to keep your account secure.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => handleSoon('Change Password')}
                        className="text-[#8B5E3C] hover:text-[#3E2C23] font-sans text-sm font-medium transition-colors border border-[#8B5E3C] px-4 py-1.5 rounded"
                    >
                        Update
                    </button>
                </div>

                {/* Two-Factor Auth - Mocked */}
                <div className="bg-[#F8F4EF] border border-[#D8C7B8] p-4 rounded-lg flex items-center justify-between relative overflow-hidden">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#EFE7DF] flex items-center justify-center text-[#8B5E3C]">
                            <Smartphone size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-sans font-medium text-[#3E2C23] text-sm mb-1">Two-Factor Authentication</h4>
                                <span className="bg-[#8B5E3C]/10 text-[#8B5E3C] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Coming Soon</span>
                            </div>
                            <p className="font-sans text-xs text-[#3E2C23]/70">Add an extra layer of security to your account.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-not-allowed opacity-50" title="Coming Soon">
                        <input type="checkbox" disabled className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8B5E3C]"></div>
                    </label>
                </div>

                {/* Logout All Devices - Mocked */}
                <div className="bg-[#F8F4EF] border border-[#D8C7B8] p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#EFE7DF] flex items-center justify-center text-[#8B5E3C]">
                            <Shield size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="font-sans font-medium text-[#3E2C23] text-sm mb-1">Active Sessions</h4>
                            </div>
                            <p className="font-sans text-xs text-[#3E2C23]/70">Sign out from all other browsers and devices.</p>
                        </div>
                    </div>
                    <button
                        disabled
                        className="text-[#3E2C23]/50 cursor-not-allowed font-sans text-sm font-medium transition-colors border border-[#D8C7B8] bg-[#EFE7DF] px-4 py-1.5 rounded relative group"
                        title="Pending backend integration"
                    >
                        Sign Out All
                    </button>
                </div>

            </div>

            {showComingSoon && (
                <div className="mt-4 flex items-center gap-2 text-sm text-[#8B5E3C] bg-[#EFE7DF] border border-[#D8C7B8] p-3 rounded">
                    <AlertCircle size={16} />
                    {showComingSoon} is currently in development and will be available soon.
                </div>
            )}
        </div>
    );
}
