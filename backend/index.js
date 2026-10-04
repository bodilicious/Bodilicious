import { Router } from "express";
import productRoutes from "./products/routes.js";
import profileRoutes from "./profile/routes.js";
import chatRoutes from "./chat/routes.js";
import orderRoutes from "./tracker/routes.js";
import paymentRoutes from "./payment/routes.js";
import adminRoutes from "./admin/routes.js";
import returnsRoutes from "./returns/routes.js";
import couponRoutes from "./coupons/routes.js";
import procurementRoutes from "./procurement/routes.js";
import supportRoutes from "./support/routes.js";
import analyticsRoutes from "./analytics/routes.js";
import settingsRoutes from "./settings/routes.js";
import whatsappRoutes from "./whatsapp/routes.js";
import { adminRouter as blogAdminRoutes, categoryRouter as blogCategoryRoutes, publicRouter as blogPublicRoutes } from "./blog/routes.js";
import { publicOffers } from "./coupons/controller.js";
import { cacheResponse, clearResponseCache } from "./utils/responseCache.js";

const router = Router();

// Any successful write that could change a cached public response (products, stock
// via orders, reviews, homepage, blogs, coupons/offers, settings) clears the response
// cache, so admins and shoppers never wait out a TTL to see a change.
const CACHE_AFFECTING_WRITES = /^\/(admin|settings|products|blogs|orders|payment\/(verify|razorpay))/;
router.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" && CACHE_AFFECTING_WRITES.test(req.path)) {
    res.on("finish", () => { if (res.statusCode < 400) clearResponseCache(); });
  }
  next();
});

router.use("/products", productRoutes);
router.use("/user", profileRoutes);
router.use("/chat", chatRoutes);
router.use("/orders", orderRoutes);
router.use("/payment", paymentRoutes);
router.use("/admin/analytics", analyticsRoutes);
router.use("/admin/returns", returnsRoutes);
router.use("/admin/coupons", couponRoutes);
router.use("/admin/blogs", blogAdminRoutes);
router.use("/admin/blog-categories", blogCategoryRoutes);
router.use("/admin", procurementRoutes);
router.use("/admin", adminRoutes); // Moved to the bottom to avoid intercepting other /admin/* routes
router.use("/settings", settingsRoutes);
router.use("/support", supportRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/blogs", blogPublicRoutes);
router.get("/offers", cacheResponse(5 * 60_000), publicOffers);

export default router;
