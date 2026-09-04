import { ExternalLink } from 'lucide-react';

export default function AmazonBadge({ className = "", url = "https://www.amazon.in/s?k=bodilicious" }: { className?: string; url?: string }) {
  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#0F1111] text-[10px] sm:text-xs font-sans font-bold uppercase tracking-widest rounded shadow-[0_0_0_1px_rgba(15,17,17,0.1)] hover:shadow-md hover:bg-neutral-50 transition-all duration-300 ${className}`}
    >
      Available on
      <span className="font-serif lowercase text-base sm:text-lg tracking-normal leading-none mt-0.5 font-bold text-[#FF9900]">amazon</span>
      <ExternalLink size={14} className="ml-1 text-gray-400" />
    </a>
  );
}
