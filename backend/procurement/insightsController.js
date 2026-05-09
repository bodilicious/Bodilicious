import Product from "../products/models.js";
import Notification from "./notificationModel.js";

// ─── Summary Counters ─────────────────────────────────────────────────────────
export const getSummary = async (req, res) => {
  try {
    const now = new Date();

    const [
      lowStockCount,
      unreadNotificationCount,
    ] = await Promise.all([
      // Products where stock <= lowStockThreshold
      Product.countDocuments({
        isActive: true,
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      }),
      Notification.countDocuments({ recipientRole: "admin", isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        lowStockCount,
        unreadNotificationCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Low Stock Products ───────────────────────────────────────────────────────
export const getLowStock = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    })
      .select("pid name stock lowStockThreshold images")
      .sort({ stock: 1 })
      .lean();

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

