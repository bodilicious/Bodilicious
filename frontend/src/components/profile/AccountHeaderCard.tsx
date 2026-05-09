import { useRef, useState } from 'react';
import { User as UserIcon, Camera, Loader2 } from 'lucide-react';
import { User, AuthStatus } from '../../types';
import toast from 'react-hot-toast';

interface AccountHeaderCardProps {
    user: User | null;
    authStatus: AuthStatus;
    onSave?: (data: Partial<User>) => Promise<void>;
}

export default function AccountHeaderCard({ user, authStatus,  onSave }: AccountHeaderCardProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [localAvatar, setLocalAvatar] = useState<string | null>(null);

    const memberSince = user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? new Date(parseInt((user as any).createdAt || Date.now())).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : "January 2026";

    const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image must be smaller than 2MB.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            setLocalAvatar(base64);
            if (onSave) {
                setIsUploadingAvatar(true);
                try {
                    await onSave({ photoURL: base64 });
                    toast.success('Profile picture updated!');
                } catch {
                    toast.error('Failed to update picture. Please try again.');
                    setLocalAvatar(null);
                } finally {
                    setIsUploadingAvatar(false);
                }
            }
        };
        reader.readAsDataURL(file);
    };

    if (authStatus === 'loading') {
        return (
            <div className="bg-gradient-to-br from-[#EFE7DF] to-[#E8DDD4] p-6 mb-8 flex items-center justify-between gap-5 border border-[#D8C7B8] rounded-2xl animate-pulse shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="w-24 h-24 rounded-full bg-[#D8C7B8]" />
                    <div className="space-y-3">
                        <div className="h-6 w-48 bg-[#D8C7B8] rounded" />
                        <div className="h-4 w-32 bg-[#D8C7B8] rounded" />
                        <div className="h-4 w-24 bg-[#D8C7B8] rounded" />
                    </div>
                </div>
            </div>
        );
    }

    const avatarSrc = localAvatar || user?.photoURL;

    return (
        <div className="bg-gradient-to-br from-[#EFE7DF] to-[#E8DDD4] px-6 py-5 mb-6 flex items-center gap-5 border border-[#D8C7B8] rounded-2xl shadow-sm">
            {/* Avatar */}
            <div className="relative shrink-0 group">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-[#D8C7B8] shadow-md">
                    {avatarSrc ? (
                        <img 
                          loading="lazy"
                          src={avatarSrc} 
                          alt="Profile" 
                          className="w-full h-full object-cover" 
                        />
                    ) : (
                        <UserIcon size={28} className="text-[#8B5E3C]/50" />
                    )}
                    {isUploadingAvatar && (
                        <div className="absolute inset-0 bg-[#3E2C23]/50 flex items-center justify-center rounded-full">
                            <Loader2 size={18} className="animate-spin text-white" />
                        </div>
                    )}
                </div>
                {authStatus === 'authenticated' && onSave && !isUploadingAvatar && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Change profile picture"
                        className="absolute bottom-0 right-0 w-6 h-6 bg-[#8B5E3C] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#3E2C23] transition-colors opacity-0 group-hover:opacity-100"
                    >
                        <Camera size={11} />
                    </button>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                />
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
                <h2 className="font-serif text-[#3E2C23] text-xl mb-0.5 truncate">
                    {authStatus === 'authenticated' && user ? user.displayName || 'Beautiful' : 'Welcome Back'}
                </h2>
                <p className="font-sans text-[#3E2C23]/60 text-xs mb-2 truncate">
                    {user?.email || 'Sign in to view your details'}
                </p>
                {authStatus === 'authenticated' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-[#8B5E3C] text-[10px] font-medium tracking-wide bg-[#8B5E3C]/10 px-2.5 py-0.5 rounded-full">
                            Member Since {memberSince}
                        </span>
                        {user?.skinType && (
                            <span className="font-sans text-[#3E2C23]/60 text-[10px] tracking-wide bg-[#F8F4EF] px-2.5 py-0.5 rounded-full border border-[#D8C7B8]">
                                {user.skinType} Skin
                            </span>
                        )}
                    </div>
                )}
            </div>

            
        </div>
    );
}
