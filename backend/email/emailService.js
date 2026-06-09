import { Resend } from "resend";
import UserProfile from "../profile/models.js";
import { getSettings } from "../settings/cache.js";

let resendClient = null;

/*
  Create Resend client only once (singleton)
*/
const getResend = () => {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is missing in environment variables");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

// Sender addresses — update the domain once you verify it in Resend
const FROM_DEFAULT  = process.env.EMAIL_FROM        || "Bodilicious <noreply@bodilicious.in>";
const FROM_SUPPORT  = process.env.EMAIL_FROM_SUPPORT || "Bodilicious Support <support@bodilicious.in>";
const FROM_ALERTS   = process.env.EMAIL_FROM_ALERTS  || "Bodilicious Alerts <alerts@bodilicious.in>";

// Helper to get primary admin email
const getPrimaryAdminEmail = async () => {
  try {
    const adminUser = await UserProfile.findOne({ role: "primary_admin" });
    if (adminUser && adminUser.email) return adminUser.email;
    return process.env.ADMIN_ALERT_EMAIL || "bodiliciousnaturalproducts@gmail.com";
  } catch {
    return process.env.ADMIN_ALERT_EMAIL || "bodiliciousnaturalproducts@gmail.com";
  }
};

/*
  Helper: send via Resend and log the result
*/
const sendEmail = async ({ from, to, subject, html, label }) => {
  const { data, error } = await getResend().emails.send({ from, to, subject, html });
  if (error) {
    console.error(`[EmailService] ${label} failed:`, error);
    throw new Error(error.message || "Resend API error");
  }
  console.log(`[EmailService] ${label} sent — id: ${data.id}`);
  return data;
};

/*
  Base email layout wrapper
*/
const buildEmailLayout = (content, data = {}) => {
  const { customerName } = data;

  return `
  <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #f0f0f0; border-radius: 10px; overflow: hidden; background-color: #ffffff;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #8B0000, #B22222); padding: 48px 24px; text-align: center;">
      <img
        src="https://www.bodilicious.in/logo.png"
        alt="Bodilicious"
        style="width: 260px; max-width: 90%; height: auto; display: block; margin: 0 auto;"
      />
      <p style="color: #f8d7da; margin: 16px 0 0; font-size: 15px; line-height: 1.5;">
        Target Oriented Skin Care and Hair Care
      </p>
    </div>

    <!-- Body -->
    <div style="padding: 32px 28px; color: #333333; font-size: 15px; line-height: 1.7;">
      <p style="font-size: 16px; margin: 0 0 18px;">
        Hello${customerName ? ` ${customerName}` : ""},
      </p>

      ${content}
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #eeeeee; background-color: #fafafa; padding: 22px 18px; text-align: center; font-size: 12px; color: #888888;">
      <p style="margin: 0 0 6px;"><strong>Bodilicious Natural Products</strong></p>
      <p style="margin: 0 0 6px;">Premium Herbal Beauty Solutions</p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Bodilicious Natural Products</p>
    </div>

  </div>
  `;
};

/* ─────────────────────────────────────────────
   ORDER CONFIRMATION EMAIL
───────────────────────────────────────────── */
export const sendOrderConfirmationEmail = async (order, userEmail, userName) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.sendOrderConfirmationToCustomer) return;

    const itemsHtml = (order?.items || [])
      .map(
        (item) => `
          <tr>
            <td style="padding:12px 10px; border-bottom:1px solid #eeeeee; vertical-align:top;">
              <strong>${item?.product?.name || item?.name || "Product"}</strong><br>
              <span style="color:#777777; font-size:13px;">Qty: ${item?.quantity || 0}</span>
            </td>
            <td style="padding:12px 10px; border-bottom:1px solid #eeeeee; text-align:right; vertical-align:top;">
              ₹${((item?.priceAtPurchase || item?.price || 0) * (item?.quantity || 0)).toLocaleString("en-IN")}
            </td>
          </tr>
        `
      )
      .join("");

    const orderDate = order?.createdAt ? new Date(order.createdAt) : new Date();
    const fullOrderId = order?._id ? order._id.toString() : "";
    const displayOrderId = fullOrderId ? fullOrderId.slice(-8).toUpperCase() : "ORDER";
    const paymentMethod = order?.paymentMethod ? order.paymentMethod.toUpperCase() : "COD";
    const totalAmount = order?.totalAmount || 0;
    const shippingName = order?.shippingDetails?.name || userName || "Valued Customer";

    const frontendUrl = process.env.FRONTEND_URL || "https://www.bodilicious.in";
    const trackUrl = `${frontendUrl}/track/${fullOrderId}`;

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        Your Order is Confirmed 🎉
      </h2>

      <p style="margin:0 0 14px;">
        Thank you for your purchase. Your order has been successfully placed and is now being processed.
      </p>

      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order ID:</strong> #${displayOrderId}</p>
        <p style="margin:0 0 8px;"><strong>Date:</strong> ${orderDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}</p>
        <p style="margin:0 0 8px;"><strong>Payment Method:</strong> ${paymentMethod}</p>
        ${
          order?.invoiceNumber
            ? `<p style="margin:0;"><strong>Invoice No:</strong> ${order.invoiceNumber}</p>`
            : ""
        }
      </div>

      <h3 style="margin:0 0 12px; color:#222222; font-size:18px;">Order Summary</h3>

      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <thead>
          <tr>
            <th style="text-align:left; padding:10px; border-bottom:2px solid #8B0000; font-size:14px;">Item</th>
            <th style="text-align:right; padding:10px; border-bottom:2px solid #8B0000; font-size:14px;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:12px 10px; text-align:right; font-weight:bold;">Total Paid</td>
            <td style="padding:12px 10px; text-align:right; color:#8B0000; font-weight:bold; font-size:18px;">
              ₹${totalAmount.toLocaleString("en-IN")}
            </td>
          </tr>
        </tfoot>
      </table>

      <h3 style="margin:0 0 12px; color:#222222; font-size:18px;">Delivery Address</h3>
      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin-bottom:24px;">
        <p style="margin:0; line-height:1.7;">
          ${shippingName}<br>
          ${order?.shippingDetails?.address || ""}<br>
          ${order?.shippingDetails?.city || ""}, ${order?.shippingDetails?.state || ""} - ${
      order?.shippingDetails?.pincode || ""
    }<br>
          Phone: ${order?.shippingDetails?.phone || ""}
        </p>
      </div>

      <p style="margin:0 0 16px;">
        You can track your order status anytime using the button below.
      </p>

      <div style="text-align:center; margin:28px 0;">
        <a
          href="${trackUrl}"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          Track Your Order
        </a>
      </div>

      <p style="margin:18px 0 0;">
        We'll notify you again once your order has been shipped.
      </p>

      <div style="text-align:center; margin:28px 0 0;">
        <a
          href="https://www.bodilicious.in"
          style="background:#ffffff; color:#8B0000; text-decoration:none; padding:12px 24px; border-radius:6px; font-size:14px; font-weight:bold; display:inline-block; border:1px solid #8B0000;"
        >
          Visit Our Website
        </a>
      </div>
    `;

    return await sendEmail({
      from: FROM_DEFAULT,
      to: userEmail,
      subject: "Order Confirmed - Bodilicious",
      html: buildEmailLayout(content, { customerName: shippingName }),
      label: "Order confirmation",
    });
  } catch (error) {
    console.error("Order email failed:", error);
    throw error;
  }
};

/**
 * Fires the order confirmation email after a safe delay/non-blocking.
 * Prioritizes shipment email over account email.
 */
export const sendOrderConfirmationAfterInvoice = async (order, accountEmail = "") => {
  const recipientEmail = order?.shippingDetails?.email || accountEmail;

  if (!recipientEmail) {
    console.warn(`[EmailService] No recipient found for order ${order?._id}. Skipping.`);
    return;
  }

  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.sendOrderConfirmationToCustomer) {
      console.log(`[EmailService] Skipping order confirmation email due to store settings`);
      return;
    }

    console.log(`📧 Preparing order confirmation email for: ${recipientEmail}`, {
      orderId: order?._id?.toString(),
      invoiceNo: order?.invoiceNumber,
    });

    await sendOrderConfirmationEmail(
      order,
      recipientEmail,
      order?.shippingDetails?.name || "Customer"
    );

    console.log(`✅ Order confirmation email sent to ${recipientEmail}`);
  } catch (err) {
    console.error(`❌ Order email failed for ${recipientEmail}:`, err.message);
  }
};

/* ─────────────────────────────────────────────
   ADMIN ALERT: NEW ORDER
───────────────────────────────────────────── */
export const sendAdminNewOrderAlert = async (order) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.notifyAdminOnOrder) return;

    const adminEmail = await getPrimaryAdminEmail();
    if (!adminEmail) return;

    const fullOrderId = order?._id ? order._id.toString() : "";
    const displayOrderId = fullOrderId ? fullOrderId.slice(-8).toUpperCase() : "ORDER";
    const paymentMethod = order?.paymentMethod ? order.paymentMethod.toUpperCase() : "COD";
    const totalAmount = order?.totalAmount || 0;
    const shippingName = order?.shippingDetails?.name || "Customer";

    const itemsHtml = (order?.items || [])
      .map(
        (item) => `
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #eeeeee;">
              <strong>${item?.product?.name || item?.name || "Product"}</strong><br>
              <span style="color:#777777; font-size:12px;">Qty: ${item?.quantity || 0} | ₹${((item?.priceAtPurchase || item?.price || 0) * (item?.quantity || 0)).toLocaleString("en-IN")}</span>
            </td>
          </tr>
        `
      )
      .join("");

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        🚨 New Order Received!
      </h2>

      <p style="margin:0 0 14px;">
        A new order has been placed on the website by <strong>${shippingName}</strong>.
      </p>

      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order ID:</strong> #${displayOrderId}</p>
        <p style="margin:0 0 8px;"><strong>Amount:</strong> ₹${totalAmount.toLocaleString("en-IN")}</p>
        <p style="margin:0 0 8px;"><strong>Payment Method:</strong> ${paymentMethod}</p>
        <p style="margin:0;"><strong>Items:</strong> ${(order?.items || []).length}</p>
      </div>
      
      <h3 style="margin:0 0 12px; color:#222222; font-size:16px;">Items Ordered</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p style="margin:18px 0 0;">
        Log in to the admin dashboard to review and process the order.
      </p>
    `;

    return await sendEmail({
      from: FROM_ALERTS,
      to: adminEmail,
      subject: `New Order Alert! [#${displayOrderId}] - ₹${totalAmount.toLocaleString("en-IN")}`,
      html: buildEmailLayout(content, { customerName: "Admin" }),
      label: "Admin new order alert",
    });
  } catch (error) {
    console.error("Admin new order alert failed:", error.message);
  }
};

/* ─────────────────────────────────────────────
   ADMIN ALERT: PAYMENT SUCCESS NO ORDER
───────────────────────────────────────────── */
export const sendAdminPaymentSuccessNoOrderAlert = async (paymentId, orderId, amount) => {
  try {
    const adminEmail = await getPrimaryAdminEmail();
    if (!adminEmail) return;

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        ⚠️ CRITICAL: Payment Received but Order Failed
      </h2>

      <p style="margin:0 0 14px;">
        Razorpay reported a successful payment, but the backend <strong>failed to create an order</strong>. The customer was charged.
      </p>

      <div style="background:#fff5f5; padding:16px 18px; border:1px solid #fecaca; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Razorpay Order ID:</strong> ${orderId}</p>
        <p style="margin:0 0 8px;"><strong>Razorpay Payment ID:</strong> ${paymentId}</p>
        <p style="margin:0;"><strong>Amount Paid:</strong> ₹${amount.toLocaleString("en-IN")}</p>
      </div>

      <p style="margin:18px 0 0;">
        Please log into the Razorpay dashboard immediately to investigate. You may need to manually create the order or issue a refund.
      </p>
    `;

    return await sendEmail({
      from: FROM_ALERTS,
      to: adminEmail,
      subject: `CRITICAL: Orphaned Payment Captured - ₹${amount.toLocaleString("en-IN")}`,
      html: buildEmailLayout(content, { customerName: "Admin" }),
      label: "Admin orphaned payment alert",
    });
  } catch (error) {
    console.error("Admin orphaned payment alert failed:", error.message);
  }
};

/* ─────────────────────────────────────────────
   EMAIL VERIFICATION EMAIL
───────────────────────────────────────────── */
export const sendVerificationEmail = async (userEmail, verificationLink, userName = "") => {
  const content = `
    <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
      Verify Your Email
    </h2>

    <p style="margin:0 0 14px;">
      Welcome to <strong>Bodilicious</strong>!
    </p>

    <p style="margin:0 0 18px;">
      Please verify your email address to activate your account and start shopping with us.
    </p>

    <div style="text-align:center; margin:32px 0;">
      <a
        href="${verificationLink}"
        style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block; text-transform:uppercase;"
      >
        Verify My Email
      </a>
    </div>

    <p style="font-size:13px; color:#777777; margin:0 0 12px;">
      If you didn't create this account, you can safely ignore this email.
    </p>

    <p style="font-size:12px; color:#999999; word-break:break-all; margin:0;">
      Or copy and paste this link into your browser:<br>
      ${verificationLink}
    </p>
  `;

  return await sendEmail({
    from: FROM_DEFAULT,
    to: userEmail,
    subject: "Verify Your Email - Bodilicious",
    html: buildEmailLayout(content, { customerName: userName }),
    label: "Verification email",
  });
};

/* ─────────────────────────────────────────────
   PASSWORD RESET EMAIL
───────────────────────────────────────────── */
export const sendPasswordResetEmail = async (userEmail, resetLink, userName = "") => {
  const content = `
    <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
      Reset Your Password
    </h2>

    <p style="margin:0 0 18px;">
      We received a request to reset the password for your Bodilicious account. 
      Click the button below to choose a new password.
    </p>

    <div style="text-align:center; margin:32px 0;">
      <a
        href="${resetLink}"
        style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block; text-transform:uppercase;"
      >
        Reset Password
      </a>
    </div>

    <p style="font-size:13px; color:#777777; margin:0 0 12px;">
      If you didn't request this password reset, you can safely ignore this email. Your password won't change until you create a new one.
    </p>

    <p style="font-size:12px; color:#999999; word-break:break-all; margin:0;">
      Or copy and paste this link into your browser:<br>
      ${resetLink}
    </p>
  `;

  return await sendEmail({
    from: FROM_DEFAULT,
    to: userEmail,
    subject: "Reset Your Password - Bodilicious",
    html: buildEmailLayout(content, { customerName: userName }),
    label: "Password reset email",
  });
};

/* ─────────────────────────────────────────────
   RETURN APPROVED EMAIL
───────────────────────────────────────────── */
export const sendReturnApprovedEmail = async (order, userEmail, userName) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.emailReturnApproved) return;

    const orderId = order?._id?.toString()?.slice(-8).toUpperCase() || "ORDER";
    const refundMethodLabel = {
      original_payment: "Original Payment Method",
      store_credit: "Store Credit",
      replacement: "Replacement Shipment",
    }[order?.returnRefundMethod] || "Original Payment Method";

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        Return Request Approved ✓
      </h2>

      <p style="margin:0 0 14px;">
        Great news! Your return request for order <strong>#${orderId}</strong> has been approved.
      </p>

      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin:0 0 8px;"><strong>Refund Method:</strong> ${refundMethodLabel}</p>
        <p style="margin:0;"><strong>Return Reason:</strong> ${order?.returnReason || "N/A"}</p>
      </div>

      <p style="margin:0 0 14px;">
        Your refund will be processed via <strong>${refundMethodLabel}</strong> within 5–7 business days once we receive the returned item.
      </p>

      <p style="margin:0 0 14px;">
        Please ship the item(s) back to us using any reliable courier. Keep the tracking number safe for your records.
      </p>

      <p style="margin:18px 0 0;">
        If you have any questions, please don't hesitate to contact our support team.
      </p>

      <div style="text-align:center; margin:28px 0 0;">
        <a
          href="https://www.bodilicious.in"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          Visit Our Website
        </a>
      </div>
    `;

    return await sendEmail({
      from: FROM_DEFAULT,
      to: userEmail,
      subject: `Return Approved - Order #${orderId} | Bodilicious`,
      html: buildEmailLayout(content, { customerName: userName }),
      label: "Return approved email",
    });
  } catch (error) {
    console.error("Return approved email failed:", error);
    throw error;
  }
};

/* ─────────────────────────────────────────────
   RETURN REJECTED EMAIL
───────────────────────────────────────────── */
export const sendReturnRejectedEmail = async (order, userEmail, userName, rejectionReason) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.emailReturnRejected) return;

    const orderId = order?._id?.toString()?.slice(-8).toUpperCase() || "ORDER";

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        Return Request Update
      </h2>

      <p style="margin:0 0 14px;">
        We've reviewed your return request for order <strong>#${orderId}</strong> and unfortunately we are unable to approve it at this time.
      </p>

      <div style="background:#fff5f5; padding:16px 18px; border:1px solid #fecaca; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin:0 0 8px;"><strong>Return Reason Provided:</strong> ${order?.returnReason || "N/A"}</p>
        <p style="margin:0;"><strong>Reason for Rejection:</strong> ${rejectionReason || "Does not meet return policy criteria"}</p>
      </div>

      <p style="margin:0 0 14px;">
        Please review our <a href="https://www.bodilicious.in/shipping-refund" style="color:#8B0000;">Return &amp; Refund Policy</a> for more information.
      </p>

      <p style="margin:0 0 14px;">
        If you believe this decision was made in error or have additional questions, please contact our support team and we'll be happy to assist.
      </p>

      <div style="text-align:center; margin:28px 0 0;">
        <a
          href="https://www.bodilicious.in/contact"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          Contact Support
        </a>
      </div>
    `;

    return await sendEmail({
      from: FROM_DEFAULT,
      to: userEmail,
      subject: `Return Request Update - Order #${orderId} | Bodilicious`,
      html: buildEmailLayout(content, { customerName: userName }),
      label: "Return rejected email",
    });
  } catch (error) {
    console.error("Return rejected email failed:", error);
    throw error;
  }
};

/* ─────────────────────────────────────────────
   TICKET ACKNOWLEDGEMENT EMAIL
───────────────────────────────────────────── */
export const sendTicketAcknowledgementEmail = async (ticket, userEmail, userName) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.emailTicketRaised) return;

    const ticketId = ticket?.ticketId || "TKT-UNKNOWN";
    const typeLabel = ticket?.type ? ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1) : "Support";
    const frontendUrl = process.env.FRONTEND_URL || "https://www.bodilicious.in";
    const ticketsUrl = `${frontendUrl}/account/tickets`;

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        We've Received Your Query 🙏
      </h2>

      <p style="margin:0 0 14px;">
        Thank you for reaching out! We've received your support request and our team will get back to you within <strong>a few hours</strong>.
      </p>

      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticketId}</p>
        <p style="margin:0 0 8px;"><strong>Issue Type:</strong> ${typeLabel}</p>
        <p style="margin:0;"><strong>Your Message:</strong><br/><span style="color:#555555;">${ticket?.description || ""}</span></p>
      </div>

      <p style="margin:0 0 14px;">
        You can track the status of your ticket at any time by clicking the button below. We will also email you as soon as we respond.
      </p>

      <div style="text-align:center; margin:28px 0;">
        <a
          href="${ticketsUrl}"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          View My Tickets
        </a>
      </div>

      <p style="margin:18px 0 0; font-size:13px; color:#666666;">
        Need urgent help? You can also reach us on WhatsApp at
        <a href="https://wa.me/919894451947" style="color:#8B0000;">+91 98944 51947</a>
        or email us at
        <a href="mailto:bodiliciousnaturalproducts@gmail.com" style="color:#8B0000;">bodiliciousnaturalproducts@gmail.com</a>.
      </p>
    `;

    return await sendEmail({
      from: FROM_SUPPORT,
      to: userEmail,
      subject: `We got your query! Ticket #${ticketId} | Bodilicious`,
      html: buildEmailLayout(content, { customerName: userName }),
      label: "Ticket acknowledgement email",
    });
  } catch (error) {
    console.error("Ticket acknowledgement email failed:", error);
    throw error;
  }
};

/* ─────────────────────────────────────────────
   TICKET REPLY EMAIL
───────────────────────────────────────────── */
export const sendTicketReplyEmail = async (ticket, replyText, userEmail, userName) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.emailTicketReply) return;

    const ticketId = ticket?.ticketId || "TKT-UNKNOWN";
    const typeLabel = ticket?.type ? ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1) : "Support";
    const frontendUrl = process.env.FRONTEND_URL || "https://www.bodilicious.in";
    const ticketsUrl = `${frontendUrl}/account/tickets`;
    const contactUrl = `${frontendUrl}/contact`;

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        Support Has Replied to Your Query 💬
      </h2>

      <p style="margin:0 0 14px;">
        Our team has responded to your support ticket <strong>#${ticketId}</strong>. Here's what we said:
      </p>

      <div style="background:#fff8f8; border-left:4px solid #8B0000; padding:16px 20px; border-radius:0 8px 8px 0; margin:22px 0;">
        <p style="margin:0 0 8px; font-size:12px; color:#999999; text-transform:uppercase; letter-spacing:0.05em; font-weight:bold;">Bodilicious Support</p>
        <p style="margin:0; font-size:15px; color:#333333; line-height:1.7; white-space:pre-wrap;">${replyText}</p>
      </div>

      <div style="background:#fafafa; padding:14px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 6px;"><strong>Ticket ID:</strong> ${ticketId}</p>
        <p style="margin:0;"><strong>Issue Type:</strong> ${typeLabel}</p>
      </div>

      <p style="margin:0 0 22px;">
        Log into your account to see the full conversation and check your ticket status.
      </p>

      <div style="text-align:center; margin:28px 0;">
        <a
          href="${ticketsUrl}"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          View My Ticket
        </a>
      </div>

      <p style="margin:22px 0 0; font-size:13px; color:#666666; text-align:center;">
        Still have questions?
        <a href="${contactUrl}" style="color:#8B0000; font-weight:bold;">Raise a new query</a>
        or reply to this email and we'll help you out.
      </p>

      <hr style="border:none; border-top:1px solid #eeeeee; margin:28px 0;" />

      <p style="font-size:12px; color:#aaaaaa; text-align:center; margin:0;">
        You're receiving this email because you raised a support ticket at Bodilicious.<br/>
        <a href="https://wa.me/919894451947" style="color:#8B0000;">WhatsApp Us</a> &nbsp;|&nbsp;
        <a href="https://www.bodilicious.in" style="color:#8B0000;">Visit Our Store</a>
      </p>
    `;

    return await sendEmail({
      from: FROM_SUPPORT,
      to: userEmail,
      replyTo: FROM_SUPPORT,
      subject: `Re: Your Query [#${ticketId}] | Bodilicious Support`,
      html: buildEmailLayout(content, { customerName: userName }),
      label: "Ticket reply email",
    });
  } catch (error) {
    console.error("Ticket reply email failed:", error);
    throw error;
  }
};

/* ─────────────────────────────────────────────
   TICKET RESOLVED EMAIL
───────────────────────────────────────────── */
export const sendTicketResolvedEmail = async (ticket, userEmail, userName, resolutionMessage = null) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.emailTicketResolved) return;

    const ticketId = ticket?.ticketId || "TKT-UNKNOWN";
    const typeLabel = ticket?.type ? ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1) : "Support";

    let messageHtml = "";
    if (resolutionMessage) {
      messageHtml = `
      <div style="background:#fff8f8; border-left:4px solid #8B0000; padding:16px 20px; border-radius:0 8px 8px 0; margin:22px 0;">
        <p style="margin:0 0 8px; font-size:12px; color:#999999; text-transform:uppercase; letter-spacing:0.05em; font-weight:bold;">Final Resolution Note</p>
        <p style="margin:0; font-size:15px; color:#333333; line-height:1.7; white-space:pre-wrap;">${resolutionMessage}</p>
      </div>`;
    }

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        Your Support Ticket is Resolved ✓
      </h2>

      <p style="margin:0 0 14px;">
        We wanted to let you know that your support ticket <strong>#${ticketId}</strong> regarding <strong>${typeLabel}</strong> has been marked as resolved.
      </p>

      ${messageHtml}

      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticketId}</p>
        <p style="margin:0 0 8px;"><strong>Issue Type:</strong> ${typeLabel}</p>
        <p style="margin:0;"><strong>Status:</strong> Resolved</p>
      </div>

      <p style="margin:0 0 14px;">
        We hope we were able to fully address your concern. If you still need help or have further questions, feel free to reply to this email or raise a new query on our website.
      </p>

      <div style="text-align:center; margin:28px 0 0;">
        <a
          href="https://www.bodilicious.in/contact"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          Contact Support
        </a>
      </div>
    `;

    return await sendEmail({
      from: FROM_SUPPORT,
      to: userEmail,
      subject: `Ticket Resolved: #${ticketId} | Bodilicious Support`,
      html: buildEmailLayout(content, { customerName: userName }),
      label: "Ticket resolved email",
    });
  } catch (error) {
    console.error("Ticket resolved email failed:", error);
    throw error;
  }
};

/* ─────────────────────────────────────────────
   TICKET CANCELLED EMAIL
───────────────────────────────────────────── */
export const sendTicketCancelledEmail = async (ticket, userEmail, userName, cancelReason = null) => {
  try {
    const settings = await getSettings();
    if (!settings.emailAllEnabled || !settings.emailTicketCancelled) return;

    const ticketId = ticket?.ticketId || "TKT-UNKNOWN";
    const typeLabel = ticket?.type ? ticket.type.charAt(0).toUpperCase() + ticket.type.slice(1) : "Support";

    let reasonHtml = "";
    if (cancelReason) {
      reasonHtml = `
      <div style="background:#fff8f8; border-left:4px solid #8B0000; padding:16px 20px; border-radius:0 8px 8px 0; margin:22px 0;">
        <p style="margin:0 0 8px; font-size:12px; color:#999999; text-transform:uppercase; letter-spacing:0.05em; font-weight:bold;">Reason for Cancellation</p>
        <p style="margin:0; font-size:15px; color:#333333; line-height:1.7; white-space:pre-wrap;">${cancelReason}</p>
      </div>`;
    }

    const content = `
      <h2 style="color:#8B0000; margin:0 0 14px; font-size:24px; line-height:1.3;">
        Ticket Cancelled ❌
      </h2>

      <p style="margin:0 0 14px;">
        This is an update regarding your support ticket <strong>#${ticketId}</strong> for <strong>${typeLabel}</strong>. This ticket has been cancelled.
      </p>

      ${reasonHtml}

      <div style="background:#fafafa; padding:16px 18px; border:1px solid #eeeeee; border-radius:8px; margin:22px 0;">
        <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${ticketId}</p>
        <p style="margin:0 0 8px;"><strong>Issue Type:</strong> ${typeLabel}</p>
        <p style="margin:0;"><strong>Status:</strong> Cancelled</p>
      </div>

      <p style="margin:0 0 14px;">
        If you feel this was done in error or if you still need assistance, please reach out to us by replying to this email or raising a new query.
      </p>

      <div style="text-align:center; margin:28px 0 0;">
        <a
          href="https://www.bodilicious.in/contact"
          style="background:#8B0000; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:6px; font-size:15px; font-weight:bold; display:inline-block;"
        >
          Contact Support
        </a>
      </div>
    `;

    return await sendEmail({
      from: FROM_SUPPORT,
      to: userEmail,
      subject: `Ticket Cancelled: #${ticketId} | Bodilicious Support`,
      html: buildEmailLayout(content, { customerName: userName }),
      label: "Ticket cancelled email",
    });
  } catch (error) {
    console.error("Ticket cancelled email failed:", error);
    throw error;
  }
};