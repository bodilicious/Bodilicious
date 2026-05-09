import { memo } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: number;
}

export default memo(function StarRating({ rating, count, size = 14 }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={size}
            className={
              star <= Math.round(rating)
                ? 'text-ruby-red fill-ruby-red'
                : 'text-silk-dark fill-transparent'
            }
          />
        ))}
      </div>
      <span className="text-sm font-sans text-grey-beige">
        {rating.toFixed(1)}
        {count !== undefined && <span className="ml-1">({count})</span>}
      </span>
    </div>
  );
});
