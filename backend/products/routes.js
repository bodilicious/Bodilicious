import express from "express";
import { validate } from "../middleware/validate.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { cacheResponse } from "../utils/responseCache.js";
import {
  createProductSchema,
  updateProductSchema,
  createReviewSchema,
} from "./schema.js";
import {
  createProduct,
  getAllProducts,
  getProductByPid,
  updateProductByPid,
  deleteProductByPid,
  addReview,
  getProductFilters,
  getTopReviews,
} from "./controller.js";

const router = express.Router();

router.post("/", protect, adminOnly, validate(createProductSchema), createProduct);

// Searches skip the cache so each one still reaches the handler and gets logged.
router.get("/", cacheResponse(60_000, { skip: (req) => !!req.query.search }), getAllProducts);

router.get("/filters", cacheResponse(5 * 60_000), getProductFilters);

router.get("/reviews/top", cacheResponse(10 * 60_000), getTopReviews);

router.get("/:pid", cacheResponse(60_000), getProductByPid);

router.patch("/:pid", protect, adminOnly, validate(updateProductSchema), updateProductByPid);

router.delete("/:pid", protect, adminOnly, deleteProductByPid);

router.post("/:pid/reviews", protect, validate(createReviewSchema), addReview);

export default router;
