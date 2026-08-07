// Trusted Types is only implemented in Chromium browsers; everywhere else
// `window.trustedTypes` is undefined and these sinks fall back to plain
// strings, which is safe because DOMPurify has already sanitized the HTML.
const trustedTypesApi = typeof window !== 'undefined' ? (window as any).trustedTypes : undefined;

// Policy names below must match the `trusted-types` CSP directive set by the
// Cloudflare Worker (cloudflare-worker/worker.js) — a mismatch makes the
// browser refuse to create the policy once require-trusted-types-for is enforced.
//
// createHTML is a passthrough, not a second sanitization pass: toTrustedHTML()
// is only ever called with a string DOMPurify has already sanitized, and
// re-running DOMPurify here with its default allowlist (instead of the
// caller's own ALLOWED_TAGS/ALLOWED_ATTR) would silently strip tags the
// caller explicitly permitted.
const dompurifyPolicy = trustedTypesApi?.createPolicy('dompurify-html', {
  createHTML: (html: string) => html,
});

const razorpayScriptPolicy = trustedTypesApi?.createPolicy('razorpay-script', {
  createScriptURL: (url: string) => {
    if (url !== 'https://checkout.razorpay.com/v1/checkout.js') {
      throw new Error('trustedTypes: blocked non-Razorpay script URL');
    }
    return url;
  },
});

/** Wraps pre-sanitized HTML as a TrustedHTML when the browser supports it. */
export function toTrustedHTML(sanitizedHtml: string): string {
  return dompurifyPolicy ? (dompurifyPolicy.createHTML(sanitizedHtml) as unknown as string) : sanitizedHtml;
}

/** Wraps a known-safe script URL as a TrustedScriptURL when the browser supports it. */
export function toTrustedScriptURL(url: string): string {
  return razorpayScriptPolicy ? (razorpayScriptPolicy.createScriptURL(url) as unknown as string) : url;
}
