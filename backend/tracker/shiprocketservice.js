import Order from "./models.js";

let cachedToken = null;
let tokenExpiry = null;

/**
 * Shiprocket only services Indian pickup/delivery pincodes. Every payload builder
 * below assumes an Indian address (6-digit pincode, 10-digit phone, "India" country)
 * and silently rewrites anything else to Delhi/110001 placeholders — which would
 * book a real courier against a fake address. Callers must gate on this.
 */
export const isIndiaOrder = (order) => {
  const country = order?.shippingDetails?.country;
  if (!country) return true; // schema default is "India"
  return ["india", "in", "bharat", "ind"].includes(country.toLowerCase().trim());
};

/**
 * Flags an order for ops follow-up without corrupting orderStatus.
 * Previously this wrote orderStatus: "payment_captured_fulfillment_pending",
 * which is NOT in the orderStatus enum — findByIdAndUpdate skips validators so it
 * persisted, then any later order.save() threw a ValidationError, and the admin
 * "Push to Shiprocket" button (gated on pending/processing) disappeared exactly
 * when it was needed. needsManualReview is indexed and already alerted on in server.js.
 */
const flagForManualReview = async (orderId, reason) => {
  await Order.findByIdAndUpdate(orderId, {
    $set: { needsManualReview: true, reviewReason: reason },
  }).catch((e) => console.error("Failed to flag order for manual review:", e.message));
};

export const getShiprocketToken = async () => {
  if (
    cachedToken &&
    tokenExpiry &&
    tokenExpiry > Date.now()
  ) {
    return cachedToken;
  }

  const response = await fetch(
    "https://apiv2.shiprocket.in/v1/external/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Shiprocket authentication failed");
  }

  const data = await response.json();

  cachedToken = data.token;
  tokenExpiry = Date.now() + 230 * 60 * 1000; // 230 mins safe buffer

  return cachedToken;
};

export const getEstimatedDeliveryDate = async (deliveryPincode, weight, cod) => {
  try {
    const token = await getShiprocketToken();
    const pickupPincode = "600081"; // Tondiarpet, Chennai origin

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=${cod ? 1 : 0}&weight=${weight}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
        throw new Error(`Shiprocket EDD API returned ${response.status}`);
    }

    const data = await response.json();

    if (data && data.data && data.data.available_courier_companies && data.data.available_courier_companies.length > 0) {
      // Filter out unserviceable or blocked couriers
      const validCouriers = data.data.available_courier_companies.filter(c => c.estimated_delivery_days && c.etd && c.blocked === 0);

      if (validCouriers.length === 0) return null;

      // Sort to get the fastest delivery (that is actually valid)
      const sortedCouriers = validCouriers.sort((a, b) => a.estimated_delivery_days - b.estimated_delivery_days);
      const fastest = sortedCouriers[0];

      return {
          estimatedDeliveryDate: new Date(fastest.etd),
          estimatedDeliveryDays: fastest.estimated_delivery_days,
          estimatedCourierName: fastest.courier_name,
          courierCompanyId: fastest.courier_company_id
      };
    }
    return null;
  } catch (err) {
    console.error("EDD fetch error:", err.message);
    return null; // Fail gracefully
  }
};

/**
 * Pushes a verified order (Prepaid or COD) to Shiprocket.
 * Handles both order creation and AWB assignment.
 * Updates the order in DB with shipmentId, shiprocketOrderId, and awb.
 */
export const pushOrderToShiprocket = async (order) => {
  try {
    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) return;
    if (order.shiprocketOrderId || order.shipmentId) return; // Already created

    const domestic = isIndiaOrder(order);

    // ── International gate ────────────────────────────────────────────────────
    // Fails CLOSED. The domestic payload below sanitises addresses for Indian
    // couriers (6-digit pincode, 10-digit phone) and would turn a Boston order
    // into a Delhi one, so international must never fall through to it by accident.
    // Flip SHIPROCKET_INTERNATIONAL_ENABLED=true only once a live test order has
    // been confirmed landing in the dashboard's International tab.
    if (!domestic && process.env.SHIPROCKET_INTERNATIONAL_ENABLED !== "true") {
      console.warn(`[Shiprocket] International auto-push disabled — order ${order._id} (${order.shippingDetails?.country}) flagged for manual fulfilment. Set SHIPROCKET_INTERNATIONAL_ENABLED=true to enable.`);
      await flagForManualReview(order._id, `International order (${order.shippingDetails?.country}) — automated international push is disabled; arrange carrier manually.`);
      return;
    }

    const token = await getShiprocketToken();
    const shippingDetails = order.shippingDetails;

    const shiprocketItems = order.items.map(item => {
      const product = item.product || {};
      return {
        name: product.name || "Product",
        sku: product.pid || product._id?.toString() || "SKU",
        units: item.quantity,
        selling_price: item.priceAtPurchase || product.price || 0,
        discount: 0,
        tax: 0,
        hsn: product.hsn_code || "33049910",
      };
    });

    // ── Address normalisation ─────────────────────────────────────────────────
    // Domestic: Indian couriers demand exactly 6 digits and a 10-digit local number,
    // so out-of-range values are coerced to keep the API from rejecting the order.
    // International: those same coercions are actively harmful — "02108" is a valid
    // Boston ZIP, and coercing it to "110001" ships the parcel to Delhi. Send the
    // real address and let Shiprocket validate it.
    const rawPhone = (shippingDetails.phone || "").replace(/\D/g, "");
    const rawPincode = (shippingDetails.pincode || "").trim();

    const finalPhone = domestic
      ? (rawPhone.length >= 10 ? rawPhone.slice(-10) : "9999999999")
      : rawPhone;                                    // keep the country code
    const finalPincode = domestic
      ? (rawPincode.replace(/\D/g, "").length === 6 ? rawPincode.replace(/\D/g, "") : "110001")
      : rawPincode;                                  // keep alphanumerics (UK/CA postcodes)

    const nameParts = (shippingDetails.name || "").trim().split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

    // Calculate total weight (default to 0.5kg as per Shiprocket requirement)
    let totalWeightGrams = 0;
    order.items.forEach(item => {
      const p = item.product || {};
      const itemWeightG = p.product_weight_g || (p.product_weight_ml ? p.product_weight_ml * 1.05 : 200); 
      totalWeightGrams += itemWeightG * item.quantity;
    });
    const totalWeight = Math.max(0.5, totalWeightGrams / 1000);

    const payload = {
      order_id: order._id.toString(),
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: "Primary",
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: shippingDetails.address || "No Address Provided",
      // "Delhi" is a sane last resort for a domestic order with a missing field;
      // for an international one it would silently relabel the destination.
      billing_city: shippingDetails.city || (domestic ? "Delhi" : ""),
      billing_pincode: finalPincode,
      billing_state: shippingDetails.state || (domestic ? "Delhi" : ""),
      billing_country: shippingDetails.country || "India",
      billing_email: shippingDetails.email || "customer@bodilicious.in",
      billing_phone: finalPhone,
      shipping_is_billing: true,
      order_items: shiprocketItems,
      // Declare what the order actually is. Previously this forced "Prepaid" on every
      // international order, which would have told Shiprocket the parcel was already
      // paid for when international COD is enabled — shipping goods with nothing
      // collected. If a courier cannot support COD on the lane, we want Shiprocket to
      // reject it loudly rather than us quietly mislabelling it.
      payment_method: order.paymentMethod === "cod" ? "COD" : "Prepaid",
      sub_total: order.totalAmount,
      length: 10,
      breadth: 10,
      height: 10,
      weight: totalWeight,
    };

    const createRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    if (createRes.ok) {
      const data = await createRes.json();
      if (data.shipment_id) {
        let updateData = {
          shipmentId: data.shipment_id,
          shiprocketOrderId: data.order_id,
        };

        // Skip automatic AWB assignment so the order stays in "New" section
        // on Shiprocket, allowing the user to select the courier manually.

        await Order.findByIdAndUpdate(order._id, updateData);

        // The order shipped, so any earlier "needs manual fulfilment" flag is stale.
        // Scoped to fulfilment reasons only — a payment-related review flag must survive.
        await Order.updateOne(
          { _id: order._id, reviewReason: /International order|Shiprocket/i },
          { $set: { needsManualReview: false, reviewReason: null } }
        ).catch(e => console.error("Failed to clear stale review flag:", e.message));
      }
    } else {
      const errText = await createRes.text();
      console.error("Shiprocket Order Creation Failed:", errText);
      if (order.paymentStatus === "paid") {
        // Leave orderStatus alone (it stays "pending", so the admin "Push to
        // Shiprocket" action remains available) and flag it instead.
        await flagForManualReview(order._id, `Payment captured but Shiprocket order creation failed: ${errText.slice(0, 300)}`);
      }
    }
  } catch (err) {
    console.error("Shiprocket push error:", err.message);
    if (order && order.paymentStatus === "paid") {
      await flagForManualReview(order._id, `Payment captured but Shiprocket push threw: ${err.message}`);
    }
  }
};

/**
 * Creates a reverse/return order in Shiprocket.
 * Uses the customer's address as the "pickup" and "Primary" location as destination.
 */
export const createShiprocketReturn = async (order, reason) => {
  try {
    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) return;
    if (order.returnShipmentId) return; // Already created

    // The payload below hardcodes pickup_country: "India" and rewrites any
    // non-6-digit postal code to 110001, so an international return would book a
    // reverse pickup from a Delhi address the customer has never been to.
    if (!isIndiaOrder(order)) {
      console.warn(`[Shiprocket] Skipping reverse pickup for international order ${order._id} (${order.shippingDetails?.country}). Requires manual RMA.`);
      await flagForManualReview(order._id, `International return requested (${order.shippingDetails?.country}) — arrange reverse logistics manually.`);
      return;
    }

    const token = await getShiprocketToken();
    const shippingDetails = order.shippingDetails;

    const shiprocketItems = order.items.map(item => {
      const product = item.product || {};
      return {
        name: product.name || "Product",
        sku: product.pid || product._id?.toString() || "SKU",
        units: item.quantity,
        selling_price: item.priceAtPurchase || product.price || 0,
        discount: 0,
        tax: 0,
        hsn: product.hsn_code || "33049910",
      };
    });

    const safePhone = (shippingDetails.phone || "").replace(/\D/g, "");
    const finalPhone = safePhone.length >= 10 ? safePhone.slice(-10) : "9999999999";
    const safePincode = (shippingDetails.pincode || "").replace(/\D/g, "");
    const finalPincode = safePincode.length === 6 ? safePincode : "110001";
    const nameParts = (shippingDetails.name || "").trim().split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

    // Calculate total weight
    let totalWeightGrams = 0;
    order.items.forEach(item => {
      const p = item.product || {};
      const itemWeightG = p.product_weight_g || (p.product_weight_ml ? p.product_weight_ml * 1.05 : 200); 
      totalWeightGrams += itemWeightG * item.quantity;
    });
    const totalWeight = Math.max(0.5, totalWeightGrams / 1000);

    const payload = {
      order_id: `RET-${order._id.toString()}`,
      order_date: new Date().toISOString().split("T")[0],
      channel_id: "", // Default channel
      pickup_customer_name: firstName,
      pickup_last_name: lastName,
      pickup_address: shippingDetails.address || "No Address Provided",
      pickup_city: shippingDetails.city || "Delhi",
      pickup_state: shippingDetails.state || "Delhi",
      pickup_country: "India",
      pickup_pincode: finalPincode,
      pickup_email: shippingDetails.email || "customer@bodilicious.in",
      pickup_phone: finalPhone,
      return_location: "Primary", // This tells Shiprocket to return it to the Primary warehouse
      order_items: shiprocketItems,
      payment_method: "Prepaid",
      total_discount: 0,
      sub_total: order.totalAmount,
      length: 10,
      breadth: 10,
      height: 10,
      weight: totalWeight,
    };

    console.log(`Creating Shiprocket Return for order ${order._id}...`);
    const createRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/return", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

    if (createRes.ok) {
      const data = await createRes.json();
      if (data.shipment_id) {
        await Order.findByIdAndUpdate(order._id, {
          returnShipmentId: data.shipment_id,
          returnShiprocketOrderId: data.order_id,
        });
        console.log(`✅ Return order created for ${order._id}. Shipment ID: ${data.shipment_id}`);
      }
    } else {
      const errText = await createRes.text();
      console.error("Shiprocket Return Creation Failed:", errText);
    }
  } catch (err) {
    console.error("Shiprocket return creation error:", err.message);
  }
};