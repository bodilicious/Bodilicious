import { memo } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
}

export default memo(function Logo({ size = 'md', inverted = false }: LogoProps) {
  // Drastically enlarged heights
  const imgSizes = { sm: 'h-20 md:h-24', md: 'h-32 md:h-40', lg: 'h-48 md:h-60' };

  return (
    <div className="flex items-center">
      <img
        src="/logo.webp"
        alt="Bodilicious Logo"
        width={1536}
        height={1024}
        decoding="async"
        loading="eager"
        fetchPriority="high"
        // Increased scale to 1.5/1.6 to pop out of navbar constraints
        className={`${imgSizes[size]} w-auto max-w-none scale-[1.5] md:scale-[1.65] origin-left object-contain transition-transform duration-300 hover:scale-[1.55] md:hover:scale-[1.7]`}
        style={inverted ? { filter: 'brightness(0) invert(1)' } : undefined}
      />
    </div>
  );
});
