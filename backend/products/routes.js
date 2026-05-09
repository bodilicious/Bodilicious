import express from "express";
import { validate } from "../middleware/validate.js";
import { protect, adminOnly } from "../middleware/auth.js";
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
} from "./controller.js";

const router = express.Router();

router.post("/", protect, adminOnly, validate(createProductSchema), createProduct);

router.get("/", getAllProducts);

router.get("/filters", getProductFilters);

router.get("/:pid", getProductByPid);

router.patch("/:pid", protect, adminOnly, validate(updateProductSchema), updateProductByPid);

router.delete("/:pid", protect, adminOnly, deleteProductByPid);

router.post("/:pid/reviews", protect, validate(createReviewSchema), addReview);

export default router;
