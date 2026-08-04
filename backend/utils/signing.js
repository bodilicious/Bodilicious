import crypto from "crypto";

/**
 * Internal HMAC signing helpers.
 *
 * Two distinct trust domains live in this app and must NOT share a key:
 *   1. Razorpay signatures — the key is RAZORPAY_KEY_SECRET, chosen by Razorpay.
 *      Verify those with `safeEqual` directly; never route them through here.
 *   2. Our own signed blobs (checkout quotes, upload ownership tags) — these use
 *      APP_SIGNING_SECRET, which we own and can rotate independently.
 *
 * Historically (2) reused RAZORPAY_KEY_SECRET, which meant rotating the gateway
 * secret silently invalidated every in-flight quote. The fallback below keeps
 * existing deployments working until APP_SIGNING_SECRET is set in the
 * environment, and warns once at startup so it doesn't go unnoticed.
 */

let warned = false;

export const getSigningSecret = () => {
  const dedicated = process.env.APP_SIGNING_SECRET;
  if (dedicated) return dedicated;

  const fallback = process.env.RAZORPAY_KEY_SECRET;
  if (fallback && !warned) {
    warned = true;
    console.warn(
      "[signing] APP_SIGNING_SECRET is not set — falling back to RAZORPAY_KEY_SECRET. " +
      "Set APP_SIGNING_SECRET (any long random string) so rotating the Razorpay key " +
      "does not invalidate live checkout quotes."
    );
  }
  return fallback || null;
};

/**
 * Constant-time comparison of two hex digests.
 *
 * `a !== b` leaks how many leading bytes matched via timing. Remote exploitation
 * against SHA-256 is impractical, but this is the correct primitive and costs
 * nothing. Length is compared first because timingSafeEqual throws on a mismatch.
 */
export const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/** HMAC-SHA256 a string with our app secret. Throws if no secret is configured. */
export const sign = (data) => {
  const secret = getSigningSecret();
  if (!secret) throw new Error("No signing secret configured");
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
};

/** Verify a signature produced by `sign`, in constant time. */
export const verify = (data, signature) => {
  try {
    return safeEqual(sign(data), signature);
  } catch {
    return false;
  }
};
