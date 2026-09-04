import { ExternalLink, ShoppingCart, Shield, RotateCcw, Zap } from 'lucide-react';

interface AmazonBadgeProps {
  amazonUrl: string;
  productName: string;
}

/**
 * "Also Available on Amazon" trust badge.
 *
 * Renders only when an Amazon listing URL is provided. Designed to sit
 * naturally below the trust bar on the product page without competing
 * with the primary "Add to Bag" CTA.
 *
 * SEO benefit: outbound link to the same product on Amazon reinforces
 * brand entity recognition. The Product schema's `sameAs` does the
 * structured-data half; this is the visible in-page signal.
 */
export default function AmazonBadge({ amazonUrl, productName }: AmazonBadgeProps) {
  return (
    <div className="mb-8">
      {/* Section label — same visual treatment as other labels on this page */}
      <p className="text-[10px] font-sans tracking-[0.2em] uppercase text-grey-beige mb-3">
        Also Available On
      </p>

      <a
        href={amazonUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`Shop ${productName} on Amazon India`}
        className="group relative flex items-center gap-4 w-full border border-[#F5DEB3]/60 bg-gradient-to-r from-[#FFFDF8] to-[#FFF8EE] hover:from-[#FFF8EE] hover:to-[#FFF3DC] hover:border-[#FF9900]/40 transition-all duration-300 rounded-sm px-5 py-4 shadow-sm hover:shadow-md overflow-hidden"
      >
        {/* Subtle Amazon-orange left accent line */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#FF9900] to-[#FF6600] rounded-l-sm"
          aria-hidden="true"
        />

        {/* Amazon logo mark (SVG inline — no external image dependency) */}
        <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-[#FF9900]/10 group-hover:bg-[#FF9900]/20 transition-colors duration-200">
          <ShoppingCart size={18} className="text-[#CC7700]" strokeWidth={1.8} />
        </div>

        {/* Text content */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-dark-red group-hover:text-dark-red/90">
            amazon.in
          </span>
          <span className="font-sans text-xs text-dark-red/60 leading-snug mt-0.5 truncate">
            Fast delivery · Easy returns · Trusted checkout
          </span>
        </div>

        {/* Trust pills */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {[
            { icon: Zap,       label: 'Prime' },
            { icon: Shield,    label: 'Secure' },
            { icon: RotateCcw, label: 'Returns' },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-[#F5DEB3]/80 text-[9px] font-sans font-medium tracking-wide text-dark-red/70 uppercase"
            >
              <Icon size={10} strokeWidth={2} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        {/* Arrow */}
        <ExternalLink
          size={14}
          className="shrink-0 text-dark-red/30 group-hover:text-[#CC7700] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200"
          aria-hidden="true"
        />
      </a>
    </div>
  );
}
