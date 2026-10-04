import Notification from "./notificationModel.js";

/**
 * NotificationService.emit
 *
 * Creates an in-app admin notification.
 * Failures are caught and logged — they must never corrupt committed data.
 *
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} opts.type        - info | warning | critical
 * @param {string} opts.sourceModule
 * @param {string} [opts.sourceModel]
 * @param {string} [opts.sourceId]
 */
export async function emit({
  title,
  body,
  type = "info",
  sourceModule,
  sourceModel = null,
  sourceId = null,
}) {
  // The model's enum is info | warning | critical. Callers also pass "error" (the
  // payment, stock-restore and invoice failure alerts) — that failed validation, was
  // swallowed below, and the most important alerts never reached the admin.
  const normalizedType = ["info", "warning", "critical"].includes(type)
    ? type
    : type === "error" ? "critical" : "info";
  try {
    await Notification.create({
      title,
      body,
      type: normalizedType,
      sourceModule,
      sourceModel,
      sourceId: sourceId ? String(sourceId) : null,
      recipientRole: "admin",
      isRead: false,
    });
  } catch (err) {
    // Notification failure must never interrupt the caller
    console.error("[NotificationService] Failed to create notification:", err.message);
  }
}

export default { emit };
