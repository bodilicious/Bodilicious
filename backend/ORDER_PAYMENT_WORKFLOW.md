# Order & Payment Workflow — Bodilicious Backend

A complete reference for how orders are created, paid, fulfilled, cancelled, and returned.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Order Types & Payment Methods](#2-order-types--payment-methods)
3. [Order Status & Payment Status Enums](#3-order-status--payment-status-enums)
4. [COD (Cash on Delivery) Flow](#4-cod-cash-on-delivery-flow)
5. [Razorpay (Online Payment) Flow](#5-razorpay-online-payment-flow)
   - 5.1 [Step 1 — Get Quote](#51-step-1--get-quote)
   - 5.2 [Step 2 — Init Razorpay Order](#52-step-2--init-razorpay-order)
   - 5.3 [Step 3 — Verify Payment](#53-step-3--verify-payment)
   - 5.4 [Step 4 — Process Paid Order (helper)](#54-step-4--process-paid-order-helper)
6. [Safety Nets](#6-safety-nets)
   - 6.1 [Razorpay Webhook](#61-razorpay-webhook)
   - 6.2 [Payment Reconciliation Cron](#62-payment-reconciliation-cron)
   - 6.3 [Draft Order Cleanup Cron](#63-draft-order-cleanup-cron)
7. [Post-Payment Event Pipeline](#7-post-payment-event-pipeline)
8. [Inventory Management](#8-inventory-management)
9. [Estimated Delivery Date (EDD)](#9-estimated-delivery-date-edd)
10. [Fulfillment — Shiprocket Integration](#10-fulfillment--shiprocket-integration)
11. [Cancellation Flow](#11-cancellation-flow)
12. [Returns & Refunds Flow](#12-returns--refunds-flow)
13. [Admin Payment Link (Draft Orders)](#13-admin-payment-link-draft-orders)
14. [Pricing, Discounts & Currencies](#14-pricing-discounts--currencies)
15. [Webhook Events Reference](#15-webhook-events-reference)
16. [API Routes Reference](#16-api-routes-reference)
17. [Key Data Model](#17-key-data-model)
18. [Error Handling & Idempotency](#18-error-handling--idempotency)
19. [Audit Trail](#19-audit-trail)

---

## 1. Architecture Overview

```
Frontend
   │
   ├─ POST /api/payment/quote          → Get HMAC-sealed price quote
   ├─ POST /api/payment/razorpay/init  → Create Razorpay order + DB draft
   ├─ POST /api/payment/verify         → Verify signature → finalise order
   └─ POST /api/orders                 → COD order creation
   
Backend
   │
   ├─ payment/controller.js   → All Razorpay-related logic
   ├─ tracker/controller.js   → COD orders, tracking, cancellation, returns
   ├─ events/orderEvents.js   → Decoupled post-order actions (email, Shiprocket, WhatsApp)
   ├─ payment/reconciliation.js → 5-min cron safety net
   ├─ cron/draftOrders.js     → 10-min draft cleanup cron
   └─ returns/controller.js   → Admin return queue management

External Services
   ├─ Razorpay         → Payment gateway
   ├─ Shiprocket       → Logistics / AWB assignment
   ├─ PostHog          → Analytics tracking
   └─ WhatsApp / Email → Customer notifications
```

---

## 2. Order Types & Payment Methods

| Payment Method | Who can use it? | India only? | Notes |
|---|---|---|---|
| `cod` | Any logged-in user | ✅ Yes | Immediate stock deduction + order creation in one transaction |
| `razorpay` | Any logged-in user | ❌ Supports international | 3-step flow: quote → init → verify |

**Important:** Razorpay orders CANNOT be created via the COD endpoint (`POST /api/orders`). Using `paymentMethod: "razorpay"` in that endpoint returns a 400 error directing the client to use the proper payment flow.

---

## 3. Order Status & Payment Status Enums

### `orderStatus`

| Value | Meaning |
|---|---|
| `pending` | Just created; awaiting payment or processing |
| `processing` | Payment confirmed; being prepared for shipment |
| `shipped` | AWB assigned, in transit |
| `delivered` | Confirmed delivered by courier |
| `cancelled` | Cancelled by customer or admin |
| `return_requested` | Customer filed a return request |
| `returned` | Return completed (RTO or customer return) |
| `abandoned` | Razorpay draft expired with no payment (set by cleanup cron) |

### `paymentStatus`

| Value | Meaning |
|---|---|
| `pending` | Draft created; no payment captured yet |
| `paid` | Payment successfully captured |
| `failed` | Razorpay payment attempt failed |
| `refunded` | Amount refunded to customer |

### `returnStatus`

| Value | Meaning |
|---|---|
| `none` | No return requested |
| `requested` | Customer submitted a return request |
| `approved` | Admin approved the return |
| `rejected` | Admin rejected the return |
| `completed` | Physical item received at warehouse |

---

## 4. COD (Cash on Delivery) Flow

**Route:** `POST /api/orders`  
**File:** [`tracker/controller.js → createOrder`](./tracker/controller.js)

```
1. Validate items (stock check, quantity must be positive integers)
2. Merge duplicate items in cart
3. Block international addresses (COD is India-only)
4. Calculate total amount + shipping cost (from StoreSettings)
5. Check welcome offer eligibility (first order = 10% off)
6. Get EDD from Shiprocket (non-blocking, 2s timeout)
7. START Mongoose transaction:
   a. Deduct stock for each product (Atomic bulkWrite ensuring stock >= quantity)
   b. Atomically check and lock welcomeOfferUsed flag on UserProfile
   c. Create Order document (paymentStatus: "pending", paymentMethod: "cod")
   d. Add order to UserProfile.orders + remove purchased items from cart
8. COMMIT transaction
9. Generate invoice number (INV-{timestamp}-{orderId-last4})
10. Emit "order_placed" event → triggers emails, Shiprocket push, WhatsApp, PostHog
11. Return 201 with populated order
```

**Stock deduction** happens atomically inside the transaction via `bulkWrite`. If the transaction fails, all stock is automatically rolled back.

---

## 5. Razorpay (Online Payment) Flow

This is a **3-step flow** that requires frontend cooperation.

### 5.1 Step 1 — Get Quote

**Route:** `POST /api/payment/quote`  
**Auth:** Optional (guests supported via `tryProtect`)  
**File:** [`payment/controller.js → getOrderQuote`](./payment/controller.js)

```
1. Validate items (quantities, product IDs)
2. Determine if India or international order
3. Check international shipping enabled in StoreSettings
4. Fetch live product prices + verify stock availability
5. Calculate subtotal + shipping cost
6. Calculate welcome offer discount (10% for first order)
7. Apply currency conversion if non-INR requested:
   a. If requested currency is in CHECKOUT_CURRENCIES → use that
   b. If not supported by Razorpay → fall back to INR (isFallback=true)
   c. Fetch exchange rate from StoreSettings (updated by cron)
8. Build quotePayload: { subtotal, shippingCost, discountAmount, finalAmount, currency, expiry (30min), ... }
9. Sign the payload with HMAC-SHA256 (using RAZORPAY_KEY_SECRET)
10. Return quoteId (base64-encoded payload + signature)
```

The signed `quoteId` is tamper-proof — any modification to prices or amounts will break the signature check in Step 2.

---

### 5.2 Step 2 — Init Razorpay Order

**Route:** `POST /api/payment/razorpay/init`  
**Auth:** Required  
**File:** [`payment/controller.js → initRazorpayOrder`](./payment/controller.js)

```
1. Decode and verify quoteId:
   a. Decode from base64
   b. Re-compute HMAC and compare signatures
   c. Check quote has not expired (30 min window)
   d. Verify quote belongs to the authenticated user
2. Re-verify welcome offer eligibility (prevents multi-tab exploit)
3. Confirm shipping country matches what was quoted
4. Validate items again (stock still available, no price changes)
5. Recalculate subtotal; verify it matches the quote within ±0.05 tolerance
6. Create Razorpay order via Razorpay API (amount in minor units / paise)
7. START Mongoose transaction:
   a. Deduct stock immediately via bulkWrite (inventory is reserved, negative stock prevented)
   b. Atomically check and lock welcomeOfferUsed flag on UserProfile
   c. Create Order document (paymentStatus: "pending", razorpayOrderId set)
8. COMMIT transaction
9. Audit log: "payment_initiated"
10. Return razorpayOrder object to frontend (frontend uses it to open Razorpay checkout)
```

> **Why deduct stock at init?** Stock is reserved immediately so two concurrent users can't buy the last item. If payment is never completed, the cleanup cron restores stock after 30 minutes.

---

### 5.3 Step 3 — Verify Payment

**Route:** `POST /api/payment/verify`  
**Auth:** Required  
**File:** [`payment/controller.js → verifyPayment`](./payment/controller.js)

```
1. Receive: razorpay_order_id, razorpay_payment_id, razorpay_signature
2. Find the DB draft order by razorpayOrderId
3. If already paid → return 200 (idempotent)
4. Verify Razorpay signature:
   HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
   If mismatch → 400 "Invalid payment signature" + CRITICAL audit log
5. Call processPaidOrder() with retry logic (up to 3 attempts, exponential backoff):
   - 500ms → 1000ms → 2000ms between attempts
   - Permanent errors (order not found, invalid signature, product not found) skip retries
6. Success → 200 with finalized order
7. If "Already processed" returned:
   a. Check if order is truly in UserProfile.orders
   b. If yes → genuine idempotent hit → 200
   c. If no → atomic claim fired but transaction aborted → force-clear cart → 202
8. If all 3 attempts fail:
   a. Set needsManualReview: true on the order
   b. Audit log at CRITICAL severity
   c. Return 202 (payment captured, order pending) — webhook will complete it
```

**202 response** means "your money is safe, we got it, but order creation is delayed." The Razorpay webhook acts as a background safety net for these cases.

---

### 5.4 Step 4 — Process Paid Order (helper)

**File:** [`payment/controller.js → processPaidOrder`](./payment/controller.js)

This is the core function called by both the verify endpoint and the webhook.

```
1. Capture pre-claim state (paymentStatus, razorpayPaymentId)
2. ATOMIC CLAIM (outside transaction):
   findOneAndUpdate({ paymentStatus: {$in: ["pending","failed"]} }, { paymentStatus: "paid", paymentClaimedAt: now })
   If null → order was already claimed → return "Already processed"
3. Un-cancel order if it was cancelled (rare race condition safety)
4. Check if stock was restored previously (isStockRestored: true). If so, atomically re-deduct via bulkWrite.
5. Calculate total weight from product weights
6. Get EDD from Shiprocket (India orders only)
7. Save razorpaySignature to order
8. START Mongoose transaction:
   a. Save updated order
   b. Add order to UserProfile.orders + remove purchased items from cart
   c. Audit log: "payment_captured"
   d. Send procurement notification
9. COMMIT transaction
10. Emit "order_placed" event (outside transaction to avoid transactional outbox rollback issues)
11. Generate invoice number (INV-{timestamp}-{orderId-last4})
12. Return { success: true, order }

ON TRANSACTION FAILURE:
   → Revert the atomic "paid" claim back to prior state and set lastClaimFailedAt
   → Audit log at ERROR severity (with reversion note)
   → Throw error (triggers retry in verifyPayment)
```

The atomic claim (`findOneAndUpdate` with `$in: ["pending", "failed"]`) is the **idempotency gate** — only one execution path can win it. This prevents double-processing when both the frontend verify call and the Razorpay webhook fire simultaneously.

---

## 6. Safety Nets

### 6.1 Razorpay Webhook

**Route:** `POST /api/payment/webhook`  
**Auth:** HMAC-SHA256 of raw request body with `RAZORPAY_WEBHOOK_SECRET`  
**File:** [`payment/controller.js → razorpayWebhook`](./payment/controller.js)

Handles three events:

#### `payment.captured`
```
1. Find order by razorpayOrderId (or payment.notes.orderId for admin payment links)
2. If order is CANCELLED → initiate auto-refund via Razorpay API
3. If order is NOT in UserProfile.orders (not fully processed):
   a. If paymentStatus == "paid" (lock exists):
      - If lock age > 2 minutes → stale crash lock → reset to "pending" and reprocess
      - If lock age < 2 minutes → actively processing → return 409 (Razorpay retries)
   b. If paymentStatus == "pending" → call processPaidOrder()
4. If already in UserProfile.orders → skip (idempotent)
```

#### `payment.failed`
```
1. Update order paymentStatus to "failed" (atomic, only if currently "pending")
2. If stock not yet restored (isStockRestored: false):
   → Atomically claim via findOneAndUpdate({ _id: orderId, isStockRestored: false }, { isStockRestored: true })
   → Only if claim succeeds: restore product stock via bulkWrite
3. Audit log + in-app notification
5. Queue WhatsApp "payment_failure" message (if enabled in settings)
```

#### `refund.processed`
```
1. Find order by razorpayPaymentId
2. Set paymentStatus: "refunded", refundStatus: "processed"
3. Auto-cancel the order (prevent accidental shipment)
4. Cancel on Shiprocket (by AWB or shiprocketOrderId)
5. Restore inventory (if not already restored)
6. Audit log
```

---

### 6.2 Payment Reconciliation Cron

**File:** [`payment/reconciliation.js`](./payment/reconciliation.js)  
**Schedule:** Every 5 minutes + once 15 seconds after server startup  
**Manual trigger:** `POST /api/v1/payment/admin/reconcile`

This is the **last line of defence** — catches orders where:
- The customer closed the browser tab before the verify call completed
- The Razorpay webhook was not delivered (server was down, webhook not configured)

```
Algorithm:
1. Find orders with:
   - paymentStatus: "pending" or "failed"
   - paymentMethod: "razorpay"
   - razorpayOrderId exists
   - orderStatus: not "abandoned" (prevents processing already-swept drafts)
   - createdAt between 3 minutes ago and 24 hours ago
   (the 3-min buffer avoids racing with an in-flight verify call)
2. Limit to 20 orders per run
3. For each order: call Razorpay API to fetch payments for that order
4. If a payment with status "captured" exists:
   → Call processPaidOrder() (idempotent — safe to call even if webhook already ran)
   → Audit log: "payment_reconciled" at WARNING severity
5. If no captured payment → genuinely abandoned, leave it for the draft cleanup cron
```

A mutex flag (`isReconciling`) prevents overlapping runs.

---

### 6.3 Draft Order Cleanup Cron

**File:** [`cron/draftOrders.js`](./cron/draftOrders.js)  
**Schedule:** Every 10 minutes

Sweeps up Razorpay draft orders that were never paid (genuinely abandoned checkouts).

```
1. Find orders with:
   - paymentMethod: "razorpay"
   - paymentStatus: "pending" or "failed"
   - isStockRestored: false (webhook may have already restored)
   - orderStatus: not "abandoned"
   - lastClaimFailedAt: not within the last 15 minutes (allows retries to complete)
   - createdAt: older than 30 minutes (matches quote expiry)
2. For each order: restore stock for all items
3. Mark order as { orderStatus: "abandoned", isStockRestored: true }
4. Sweep welcomeOfferUsed flag: If the order used the welcome offer, check if the user has any other successful orders. If not, reset welcomeOfferUsed to false so they can use it again.
```

The `isStockRestored` flag prevents double-restoration if the `payment.failed` webhook already ran.

---

## 7. Post-Payment Event Pipeline

**File:** [`events/orderEvents.js`](./events/orderEvents.js)

After a payment is confirmed (both COD and Razorpay), `orderEvents.emit("order_placed", order)` fires. All side effects run **outside** the transaction, so a failure here does not roll back the order.

```
Listeners for "order_placed":
1. Customer Segment Recomputation
   → computeSegmentsForUsers([order.user])

2. PostHog Analytics
   → trackServerEvent("Order Completed", { order_id, total_amount, currency, payment_method, region, items })

3. Shiprocket Push (India orders only)
   → pushOrderToShiprocket(order)
   → Creates shipment + gets shipmentId and shiprocketOrderId stored in DB

4. Order Confirmation Email
   → Re-fetches order with invoice number
   → sendOrderConfirmationAfterInvoice(order, userEmail)
   → sendAdminNewOrderAlert(order)

5. WhatsApp Order Confirmation
   → enqueueWhatsApp(phone, "order_confirmation", { order_id, total_amount, customer_name })
```

---

## 8. Inventory Management

Stock is managed conservatively to prevent overselling:

| Event | Stock Change | Guard |
|---|---|---|
| Razorpay init (`/init`) | **Deducted immediately** | Transaction rollback on failure |
| COD order creation | **Deducted immediately** | Transaction rollback on failure |
| Payment failed (webhook) | **Restored** | `isStockRestored` flag prevents double-restore |
| Draft cleanup cron (30min expiry) | **Restored** | `isStockRestored` flag |
| Order cancelled by customer | **Restored** | `isStockRestored` flag |
| Refund processed (webhook) | **Restored** | `isStockRestored` flag |
| RTO delivered (Shiprocket webhook) | **Restored** | `isStockRestored` flag |
| Return received (admin) | **Restored** (optional) | `AUTO_RESTOCK_ON_RECEIPT` env var |

---

## 9. Estimated Delivery Date (EDD)

**File:** [`tracker/shiprocketservice.js → getEstimatedDeliveryDate`](./tracker/shiprocketservice.js)

- Called during order creation (both COD and Razorpay)
- Uses Shiprocket's serviceability API
- Origin pincode: `600081` (Tondiarpet, Chennai)
- 2-second timeout — fails gracefully; order is never blocked by EDD failure
- Picks the **fastest valid courier** (non-blocked, with a valid EDD)
- Stores: `estimatedDeliveryDate`, `estimatedDeliveryDays`, `estimatedCourierName`, `eddCalculatedAt`

---

## 10. Fulfillment — Shiprocket Integration

**File:** [`tracker/shiprocketservice.js → pushOrderToShiprocket`](./tracker/shiprocketservice.js)

**Called by:** `orderEvents.on("order_placed")` — non-blocking, India orders only.

```
1. Authenticate with Shiprocket (token cached for 230 minutes)
2. Build order payload:
   - Items with name, SKU (pid), units, selling_price, HSN code (default: 33049910)
   - Payment method: "COD" or "Prepaid"
   - Pickup location: "Primary" (warehouse)
3. POST to Shiprocket /orders/create/adhoc
4. On success: store shipmentId + shiprocketOrderId in DB
5. On failure for paid orders: set orderStatus to "payment_captured_fulfillment_pending"
```

**Shiprocket Webhook** (`POST /api/orders/webhook/shipping`) syncs status back:

| Shiprocket Status | Internal Status |
|---|---|
| `awb assigned`, `manifested`, `label generated`, `pickup scheduled` | `processing` |
| `shipped`, `in transit`, `out for delivery` | `shipped` |
| `delivered` | `delivered` |
| `cancelled` | `cancelled` |
| `rto initiated`, `rto delivered` | `returned` |

Status only moves **forward** (won't downgrade a `shipped` order to `processing`). Status history is tracked in `statusHistory[]`.

**Token authentication:** Shiprocket JWT token is cached in memory with a 230-minute expiry. Each API call checks the cache before requesting a new token.

---

## 11. Cancellation Flow

**Route:** `PATCH /api/orders/:orderId/cancel`  
**File:** [`tracker/controller.js → cancelOrder`](./tracker/controller.js)

Only `pending` or `processing` orders can be cancelled (not shipped/delivered).

```
1. Atomically update orderStatus to "cancelled"
   (findOneAndUpdate with status filter prevents race conditions)
2. If paid via Razorpay:
   → Initiate Razorpay refund (full amount, "normal" speed)
   → Store refundId, set refundStatus: "pending", paymentStatus: "refunded"
   → If Razorpay call fails: set refundStatus: "failed" (don't block cancellation)
3. Restore stock (only if COD or paid; guarded by isStockRestored flag)
4. Save DB state (refund status + stock flag) BEFORE calling Shiprocket
   (crash safety: if Node dies during Shiprocket call, DB is consistent)
5. Cancel on Shiprocket (by AWB or shiprocketOrderId, whichever exists)
6. Audit log: "order_cancelled"
7. In-app notification to admin
8. Emit "order_status_updated" event (triggers segment recomputation)
```

---

## 12. Returns & Refunds Flow

### Customer Side

**Route:** `POST /api/orders/:orderId/return`  
**File:** [`tracker/controller.js → requestReturn`](./tracker/controller.js)

- Only `delivered` orders can be returned
- Duplicate requests are blocked (unless prior request was `rejected`)
- Minimum reason length: 5 characters
- Automatically creates a Shiprocket return shipment via `createShiprocketReturn()`
- Sets `returnStatus: "requested"`, `orderStatus: "return_requested"`

### Admin Side

**File:** [`returns/controller.js`](./returns/controller.js)

| Action | Route | What it does |
|---|---|---|
| List queue | `GET /api/v1/admin/returns` | Paginated list, oldest first, filterable by status/reason |
| Approve | `PATCH /api/v1/admin/returns/:id/approve` | Sets returnStatus to "approved"; sends approval email; requires refundMethod |
| Reject | `PATCH /api/v1/admin/returns/:id/reject` | Sets returnStatus to "rejected"; sends rejection email; requires rejectionReason |
| Mark received | `PATCH /api/v1/admin/returns/:id/received` | Sets physicalReceived: true, returnStatus: "completed"; optionally restocks |
| Return analytics | `GET /api/v1/admin/returns/analytics` | Return rate by product and category (configurable window) |

**Refund Methods:** `original_payment` | `store_credit` | `replacement`

**Auto-restock on receipt** is controlled by the `AUTO_RESTOCK_ON_RECEIPT` environment variable (default: `false`).

### Shiprocket Return Shipment

**File:** [`tracker/shiprocketservice.js → createShiprocketReturn`](./tracker/shiprocketservice.js)

- Creates a reverse pickup order in Shiprocket (`/orders/create/return`)
- Pickup location = customer's address
- Destination = "Primary" warehouse
- Stores `returnShipmentId`, `returnShiprocketOrderId` in DB
- Return AWB is synced back via the Shiprocket webhook

---

## 13. Admin Payment Link (Draft Orders)

**Route:** `POST /api/v1/admin/orders/:id/payment-link`  
**File:** [`payment/controller.js → generatePaymentLink`](./payment/controller.js)

Used by admins to send payment links to customers for manually created orders.

```
1. Verify order exists and is not already paid
2. If paymentLink already exists → return it (idempotent)
3. Create Razorpay Payment Link:
   - Amount, currency from order
   - Customer name/email/phone from order
   - SMS + email notifications enabled
   - Reminder emails enabled
   - Expiry: 24 hours
   - notes.orderId: order MongoDB _id
4. Store paymentLinkId and paymentLink (short URL) in order
5. Audit log: "PAYMENT_LINK_GENERATED"
6. Return short URL to admin
```

When the customer pays via this link, the `payment.captured` webhook fires and uses `payment.notes.orderId` to find and complete the order.

---

## 14. Pricing, Discounts & Currencies

### Welcome Offer (First Order Discount)

**File:** [`utils/pricing.js → calculateDiscount`](./utils/pricing.js)

- Applied only if `existingOrdersCount === 0` (no prior successful orders)
- Discount: **10% of subtotal only** (never applied to shipping)
- Cannot exceed the subtotal amount
- Re-verified at init time to prevent multi-tab exploitation
- Marked permanently used immediately upon order creation (or initialization). If a Razorpay draft order expires/fails and is abandoned, a cron job resets it so the user can use it again.

### Shipping Cost

| Condition | Cost |
|---|---|
| India order, subtotal ≥ threshold | Free |
| India order, subtotal < threshold | `settings.shippingCost` (default: ₹99) |
| International order, subtotal ≥ threshold | Free |
| International order, subtotal < threshold | `settings.internationalShippingCost` (default: ₹2000) |

Thresholds and costs are configurable via `StoreSettings`.

### Currency Conversion

- **Display currency:** Any of 160+ currencies the user selects
- **Checkout currency:** Must be in `CHECKOUT_CURRENCIES` (Razorpay-supported set)
- If display currency is not supported by Razorpay → **fall back to INR**, `isFallback: true` sent to frontend
- Exchange rates stored in `StoreSettings.exchangeRates` (Map), updated by the `exchangeRates` cron
- USD fallback: if cron hasn't run yet, uses `settings.usdExchangeRate`
- Amounts are rounded per currency precision via `roundForCurrency()`
- Razorpay receives amounts in **minor units** (paise for INR) via `toRazorpayMinorUnits()`

---

## 15. Webhook Events Reference

### Razorpay Webhooks

| Event | Handler | Description |
|---|---|---|
| `payment.captured` | `razorpayWebhook` | Primary: completes order; handles stale locks and orphan payments |
| `payment.failed` | `razorpayWebhook` | Marks order failed, restores stock, queues WhatsApp message |
| `refund.processed` | `razorpayWebhook` | Updates refund status, auto-cancels order, restores stock |

### Shiprocket Webhooks

| Event | Handler | Description |
|---|---|---|
| Any status update | `shiprocketWebhook` | Maps Shiprocket status → internal status, auto-saves AWB |

---

## 16. API Routes Reference

### Payment Routes (`/api/v1/payment`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/quote` | Optional | Get HMAC-signed price quote |
| `POST` | `/razorpay/init` | Required | Create Razorpay order + DB draft |
| `POST` | `/verify` | Required | Verify payment + finalize order |
| `POST` | `/webhook` | HMAC | Razorpay webhook receiver |
| `POST` | `/admin/reconcile` | Required | Manually trigger payment reconciliation |

### Order Routes (`/api/v1/orders`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | Required | Create COD order |
| `GET` | `/my-orders` | Required | List authenticated user's orders |
| `GET` | `/:orderId` | Required | Get single order |
| `PATCH` | `/:orderId/cancel` | Required | Cancel order |
| `POST` | `/:orderId/return` | Required | Submit return request |
| `PUT` | `/:orderId/address` | Required | Update shipping address |
| `DELETE` | `/:orderId` | Required | Soft-delete order |
| `POST` | `/:orderId/comment` | Required | Add customer comment (max 10) |
| `PATCH` | `/:orderId/status` | Admin | Update order status |
| `GET` | `/track/:awb` | Required | Real-time Shiprocket tracking |
| `POST` | `/webhook/shipping` | Token | Shiprocket webhook |

### Admin Return Routes (`/api/v1/admin/returns`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Admin | Paginated returns queue |
| `PATCH` | `/:id/approve` | Admin | Approve return |
| `PATCH` | `/:id/reject` | Admin | Reject return |
| `PATCH` | `/:id/received` | Admin | Mark physical item received |
| `GET` | `/analytics` | Admin | Return rate analytics |

---

## 17. Key Data Model

```
Order {
  // Identifiers
  _id              ObjectId
  user             → UserProfile
  
  // Items
  items[]          { product → Product, quantity, priceAtPurchase }
  
  // Amounts
  totalAmount      Number   (final charged amount, in checkout currency)
  originalAmount   Number   (subtotal + shipping before discount)
  shippingCost     Number
  discountAmount   Number
  taxAmount        Number   (reserved, currently 0)
  currency         String   (checkout currency, e.g. "INR", "USD")
  exchangeRate     Number   (1 for INR orders)
  
  // Payment
  paymentMethod    "cod" | "razorpay"
  paymentStatus    "pending" | "paid" | "failed" | "refunded"
  paymentClaimedAt Date     (set when atomic claim fires)
  razorpayOrderId  String   (Razorpay order_id)
  razorpayPaymentId String  (Razorpay payment_id)
  razorpaySignature String
  paymentLink      String   (short URL, admin payment links)
  paymentLinkId    String
  paymentLinkExpiresAt Date
  
  // Invoice
  invoiceNumber    String   (INV-{timestamp}-{id-last4})
  invoiceGenerated Boolean
  
  // Status
  orderStatus      "pending"|"processing"|"shipped"|"delivered"|
                   "cancelled"|"return_requested"|"returned"|"abandoned"
  statusHistory[]  { status, changedBy, changedAt, source, note }
  
  // Shipping
  shippingDetails  { name, phone, address, city, state, pincode, country, email }
  billingDetails   shippingDetailsSchema | null
  
  // Fulfillment (Shiprocket)
  shiprocketOrderId  String
  shipmentId         Number
  awb                String   (Air Waybill — tracking number)
  estimatedDeliveryDate Date
  estimatedDeliveryDays Number
  estimatedCourierName  String
  eddCalculatedAt       Date
  
  // Returns
  returnStatus       "none"|"requested"|"approved"|"rejected"|"completed"
  returnReason       String
  returnRefundMethod "original_payment"|"store_credit"|"replacement"
  returnRequestedAt  Date
  returnResolvedAt   Date
  physicalReceived   Boolean
  returnShiprocketOrderId String
  returnShipmentId   Number
  returnAwb          String
  
  // Refund
  refundId           String
  refundStatus       "pending"|"processed"|"failed"
  refundAmount       Number
  
  // Operations
  isStockRestored    Boolean  (prevents double-restoration)
  needsManualReview  Boolean  (set when all verify retries exhaust)
  reviewReason       String
  isDeleted          Boolean  (soft delete)
  
  // Marketing attribution
  marketing          { source, medium, campaign }
  
  // Discounts
  isWelcomeOfferApplied Boolean
  couponCode         String
  couponDiscount     Number
  
  // Customer
  customerComments[] { text, createdAt }   (max 10)
  adminNote          String
}
```

---

## 18. Error Handling & Idempotency

### The Retry Stack

When a payment is captured, three independent mechanisms try to complete the order:

```
1. Frontend /verify call (primary, instant)
   └─ withRetry (3 attempts, 500ms/1000ms/2000ms backoff)

2. Razorpay webhook payment.captured (async safety net)
   └─ processPaidOrder() (idempotent via atomic claim)

3. Reconciliation cron every 5 minutes (last resort)
   └─ processPaidOrder() (idempotent via atomic claim)
```

### Atomic Claim (Idempotency Gate)

```js
// Atomic claim with returnOriginal: true securely captures the prior state
const claimedOrder = await Order.findOneAndUpdate(
  { _id: orderId, paymentStatus: { $in: ["pending", "failed"] } },
  { $set: { paymentStatus: "paid", paymentClaimedAt: new Date() } },
  { returnOriginal: true } // Mongoose's version of returnDocument: "before"
);
// Returns null if another path already claimed it → "Already processed"
```

### Stale Lock Detection

If `processPaidOrder` claims the order (`paymentStatus: "paid"`) but the Mongoose transaction aborts (network error, DB timeout, Node crash), the lock is **not automatically released**.

The webhook handles this:
- If `paymentStatus: "paid"` but order is NOT in `UserProfile.orders`
- And lock age > 2 minutes → treat as stale crash → reset to `"pending"` and reprocess
- If lock age < 2 minutes → return 409 so Razorpay retries the webhook

### Permanent vs Transient Errors

`withRetry` distinguishes between errors that retrying can fix vs. those it cannot:

**Permanent (no retry):**
- "order not found"
- "invalid payment signature"
- "invalid product" / "product not found"

**Transient (retried):**
- DB connection timeouts
- Mongoose transaction conflicts
- Any other error

---

## 19. Audit Trail

**File:** [`admin/controller.js → logAction`](./admin/controller.js)

Every significant action is logged with a structured audit record.

| Action Key | Severity | Trigger |
|---|---|---|
| `payment_initiated` | INFO | Razorpay init |
| `payment_captured` | INFO | processPaidOrder success |
| `payment_verification_failed` | CRITICAL | Invalid Razorpay signature |
| `order_creation_failed` | ERROR | Transaction abort, revert |
| `order_creation_failed_all_retries` | CRITICAL | All 3 verify retries exhausted |
| `payment_reconciled` | WARNING | Reconciliation cron recovery |
| `payment_failed` | WARNING | Razorpay payment.failed webhook |
| `payment_auto_refunded` | WARNING | Webhook: cancelled order paid |
| `payment_success_no_order` | CRITICAL | Webhook: no matching DB order |
| `refund_confirmed` | INFO | refund.processed webhook |
| `order_placed` | INFO | COD order created |
| `order_cancelled` | INFO | Customer cancellation |
| `shipment_created` | INFO | Shiprocket webhook: shipped |
| `order_delivered` | INFO | Shiprocket webhook: delivered |
| `delivery_failed` | WARNING | Shiprocket webhook: RTO/failed |
| `return_approved` | INFO | Admin approves return |
| `return_rejected` | INFO | Admin rejects return |
| `return_marked_received` | INFO | Admin marks item received |
| `PAYMENT_LINK_GENERATED` | INFO | Admin generates payment link |

---

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (also used for quote HMAC) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification |
| `SHIPROCKET_EMAIL` | Shiprocket account email |
| `SHIPROCKET_PASSWORD` | Shiprocket account password |
| `SHIPROCKET_WEBHOOK_TOKEN` | Webhook auth token for Shiprocket callbacks |
| `AUTO_RESTOCK_ON_RECEIPT` | `"true"` to restock on return receipt |
| `FRONTEND_URL` | Used in shipment tracking URLs sent via email |
