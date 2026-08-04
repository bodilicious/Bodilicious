import crypto from "crypto";
import { safeEqual } from "../utils/signing.js";

export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && process.env.WHATSAPP_VERIFY_TOKEN &&
        safeEqual(String(token), process.env.WHATSAPP_VERIFY_TOKEN)) {
      console.log("WhatsApp Webhook verified!");
      return res.status(200).send(challenge);
    } else {
      return res.status(403).json({ success: false, message: "Verification failed" });
    }
  }
  return res.status(400).json({ success: false, message: "Missing parameters" });
};

export const handleWebhook = (req, res) => {
  // ── Signature verification ──────────────────────────────────────────────
  // Meta signs every delivery with the app secret as
  //   X-Hub-Signature-256: sha256=<hex hmac of the raw body>
  // Without this the endpoint is an open, unauthenticated write into our logs,
  // and becomes a real hole the moment this handler starts mutating state.
  // Set WHATSAPP_APP_SECRET (Meta dashboard → App Settings → Basic → App Secret).
  // Fails closed when unset, matching the Shiprocket webhook's behaviour.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn("[WhatsApp Webhook] Blocked: WHATSAPP_APP_SECRET is not configured");
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const provided = req.headers["x-hub-signature-256"];
  if (!provided || !req.rawBody) {
    console.warn("[WhatsApp Webhook] Blocked: missing signature or raw body — IP:", req.ip);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");

  if (!safeEqual(expected, String(provided))) {
    console.warn("[WhatsApp Webhook] Blocked unauthorized request — IP:", req.ip);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  // ────────────────────────────────────────────────────────────────────────

  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    const status = body.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
    if (status) {
      console.log(`[WhatsApp Webhook] Message ${status.id} updated to status: ${status.status}`);
    }

    return res.status(200).send("EVENT_RECEIVED");
  } else {
    return res.status(404).send();
  }
};
