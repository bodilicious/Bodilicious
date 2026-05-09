import Notification from "./notificationModel.js";

// ─── List Notifications ───────────────────────────────────────────────────────
export const listNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = { recipientRole: "admin" };
    if (req.query.unreadOnly === "true") filter.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Unread Count ─────────────────────────────────────────────────────────────
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientRole: "admin",
      isRead: false,
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Mark One Read ────────────────────────────────────────────────────────────
export const markOneRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }
    res.json({ success: true, message: "Marked as read", data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Mark All Read ────────────────────────────────────────────────────────────
export const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipientRole: "admin", isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
