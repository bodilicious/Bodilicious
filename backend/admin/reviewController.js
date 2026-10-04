import mongoose from "mongoose";
import Product from "../products/models.js";
import UserProfile from "../profile/models.js";
import { getSettings } from "../settings/cache.js";
import { recalculateRatings, issueReviewReward } from "../products/reviewModeration.js";
import { sendReviewRewardEmail } from "../email/emailService.js";
import { logAction } from "./controller.js";

const STATUSES = ["pending", "approved", "rejected"];

/**
 * GET /api/v1/admin/reviews?status=pending&page=1&limit=20
 * Reviews across all products, newest first. "approved" includes legacy reviews
 * that predate moderation and have no status.
 */
export const listReviews = async (req, res) => {
  try {
    const status = STATUSES.includes(req.query.status) ? req.query.status : "pending";
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const statusMatch = status === "approved"
      ? { "reviews.status": { $nin: ["pending", "rejected"] } }
      : { "reviews.status": status };

    const [result] = await Product.aggregate([
      { $match: { "reviews.0": { $exists: true } } },
      { $project: { name: 1, pid: 1, images: { $slice: ["$images", 1] }, reviews: 1 } },
      { $unwind: "$reviews" },
      { $match: statusMatch },
      { $sort: { "reviews.createdAt": -1 } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $lookup: { from: "userprofiles", localField: "reviews.user", foreignField: "_id", as: "author" } },
            {
              $project: {
                _id: 0,
                productId: "$_id",
                productName: "$name",
                pid: 1,
                image: { $arrayElemAt: ["$images", 0] },
                reviewId: "$reviews._id",
                rating: "$reviews.rating",
                comment: "$reviews.comment",
                isVerified: "$reviews.isVerified",
                status: { $ifNull: ["$reviews.status", "approved"] },
                rewardCouponCode: "$reviews.rewardCouponCode",
                createdAt: "$reviews.createdAt",
                authorName: { $arrayElemAt: ["$author.name", 0] },
                authorEmail: { $arrayElemAt: ["$author.email", 0] },
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
    ]);

    const total = result?.total?.[0]?.n || 0;
    res.json({ success: true, data: result?.rows || [], total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("ListReviews Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/v1/admin/reviews/:productId/:reviewId   body: { status: "approved" | "rejected" }
 * Approving publishes the review, recomputes the product rating and, when the
 * review incentive is on and the reviewer is a verified buyer, issues + emails
 * the promised coupon (once per review).
 */
export const moderateReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const { status } = req.body || {};
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be "approved" or "rejected"' });
    }
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(reviewId)) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const product = await Product.findById(productId);
    const review = product?.reviews?.id(reviewId);
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    const previous = review.status || "approved";
    review.status = status;
    recalculateRatings(product);

    let reward = null;
    if (status === "approved") {
      const settings = await getSettings();
      reward = await issueReviewReward({ product, review, settings }).catch(err => {
        console.error("[Reviews] Reward coupon failed:", err.message);
        return null;
      });
    }

    await product.save();

    // Email only a freshly issued code — never re-send on a repeat approval.
    if (reward && !reward.alreadyIssued) {
      const author = await UserProfile.findById(review.user).select("name email").lean();
      if (author?.email) {
        sendReviewRewardEmail(author.email, author.name, reward.code, reward.percent, product.name)
          .catch(err => console.error("[Reviews] Reward email failed:", err.message));
      }
    }

    await logAction(req, "review_moderated", "product", product._id.toString(), {
      before: { status: previous },
      after: { status },
      meta: { reviewId, rewardIssued: !!(reward && !reward.alreadyIssued) },
    }).catch(err => console.error("Review moderation audit failed:", err.message));

    res.json({
      success: true,
      data: { reviewId, status, rating: product.rating, ratingCount: product.ratingCount, rewardCode: reward?.code || null },
    });
  } catch (err) {
    console.error("ModerateReview Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
