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

const router = Router();

router.use("/products", productRoutes);
router.use("/user", profileRoutes);
router.use("/chat", chatRoutes);
router.use("/orders", orderRoutes);
router.use("/payment", paymentRoutes);
router.use("/admin/analytics", analyticsRoutes);
router.use("/admin/returns", returnsRoutes);
router.use("/admin/coupons", couponRoutes);
router.use("/admin", procurementRoutes);
router.use("/admin", adminRoutes); // Moved to the bottom to avoid intercepting other /admin/* routes
router.use("/settings", settingsRoutes);
router.use("/support", supportRoutes);
router.use("/whatsapp", whatsappRoutes);

export default router;


