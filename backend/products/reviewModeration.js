import crypto from "crypto";
import { Coupon } from "../coupons/models.js";

/**
 * Review visibility + rewards, shared by the storefront review endpoint and the
 * admin moderation endpoints.
 *
 * Reviews written before moderation existed have no status; they were published,
 * so "missing" counts as approved everywhere.
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

/**
 * Issues the "review & save" coupon promised on the product page when
 * StoreSettings.reviewIncentiveEnabled is on. Only for verified buyers (a delivered
 * order containing the product) — otherwise anyone could farm a coupon per product
 * by reviewing items they never bought. Idempotent per review: the code is stored
 * on the review, so approving twice never issues two coupons.
 *
 * Mutates `review.rewardCouponCode`; the caller saves the product.
 * Returns { code, percent } or null when no reward applies.
 */
export const issueReviewReward = async ({ product, review, settings }) => {
  if (!settings?.reviewIncentiveEnabled) return null;
  if (!review?.isVerified || !isPublishedReview(review)) return null;
  const percent = Math.min(90, Math.max(1, Math.round(Number(settings.reviewIncentiveDiscountPercent) || 10)));
  if (review.rewardCouponCode) return { code: review.rewardCouponCode, percent, alreadyIssued: true };

  const code = `THANKS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await Coupon.create({
    code,
    type: "percentage",
    value: percent,
    perUserLimit: 1,
    totalCap: 1,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
    description: `Review reward — ${product?.name || "product review"}`,
    isPrivate: true,
  });
  review.rewardCouponCode = code;
  return { code, percent };
};
