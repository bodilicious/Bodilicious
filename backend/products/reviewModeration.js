/**
 * Review visibility + rating maths for the storefront review endpoints.
 *
 * Reviews are no longer moderated; new ones are always "approved". The status check
 * remains so that any review left "pending"/"rejected" by the old moderation queue
 * stays hidden. Reviews with no status (most of them) count as approved.
 */
export const isPublishedReview = (review) =>
  !!review && review.status !== "pending" && review.status !== "rejected";

/** Rating + count from published reviews only — pending/rejected never move the stars. */
export const recalculateRatings = (product) => {
  const published = (product.reviews || []).filter(isPublishedReview);
  product.ratingCount = published.length;
  product.rating = published.length
    ? published.reduce((sum, r) => sum + r.rating, 0) / published.length
    : 0;
};
