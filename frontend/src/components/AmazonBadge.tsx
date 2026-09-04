import { ExternalLink } from 'lucide-react';

export default function AmazonBadge({ 
  className = "", 
  url = "https://www.amazon.in/s?k=bodilicious",
  variant = 'button'
}: { 
  className?: string; 
  url?: string;
  variant?: 'button' | 'badge';
}) {
  if (variant === 'badge') {
    return (
      <a 
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-4 py-2 border border-silk/80 bg-white/60 hover:bg-white hover:border-ruby-red rounded-sm transition-all duration-300 group shadow-sm ${className}`}
      >
        <span className="font-serif lowercase text-lg tracking-normal text-dark-red group-hover:text-ruby-red transition-colors leading-none">amazon.in</span>
        <ExternalLink size={14} className="text-dark-red/40 group-hover:text-ruby-red transition-colors" />
      </a>
    );
  }

  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-[56px] items-center justify-center gap-3 px-6 sm:px-8 bg-white/60 text-dark-red border border-silk/80 rounded-sm font-sans text-[11px] sm:text-xs tracking-[0.22em] uppercase hover:bg-white hover:border-dark-red hover:shadow-sm transition-all duration-300 group ${className}`}
    >
      <span className="opacity-80">Also available on</span>
      <span className="font-serif text-xl tracking-normal lowercase font-semibold text-dark-red group-hover:text-ruby-red transition-colors mt-0.5">amazon</span>
    </a>
  );
}
