import Order from "./models.js";

const COUNTRY_ISO_MAP = {
    "Afghanistan": "AF",
    "Albania": "AL",
    "Algeria": "DZ",
    "Andorra": "AD",
    "Angola": "AO",
    "Antigua and Barbuda": "AG",
    "Argentina": "AR",
    "Armenia": "AM",
    "Australia": "AU",
    "Austria": "AT",
    "Azerbaijan": "AZ",
    "Bahamas": "BS",
    "Bahrain": "BH",
    "Bangladesh": "BD",
    "Barbados": "BB",
    "Belarus": "BY",
    "Belgium": "BE",
    "Belize": "BZ",
    "Benin": "BJ",
    "Bhutan": "BT",
    "Bolivia": "BO",
    "Bosnia and Herzegovina": "BA",
    "Botswana": "BW",
    "Brazil": "BR",
    "Brunei": "BN",
    "Bulgaria": "BG",
    "Burkina Faso": "BF",
    "Burundi": "BI",
    "Côte d'Ivoire": "CI",
    "Cabo Verde": "CV",
    "Cambodia": "KH",
    "Cameroon": "CM",
    "Canada": "CA",
    "Central African Republic": "CF",
    "Chad": "TD",
    "Chile": "CL",
    "China": "CN",
    "Colombia": "CO",
    "Comoros": "KM",
    "Congo (Congo-Brazzaville)": "CG",
    "Costa Rica": "CR",
    "Croatia": "HR",
    "Cuba": "CU",
    "Cyprus": "CY",
    "Czechia (Czech Republic)": "CZ",
    "Democratic Republic of the Congo": "CD",
    "Denmark": "DK",
    "Djibouti": "DJ",
    "Dominica": "DM",
    "Dominican Republic": "DO",
    "Ecuador": "EC",
    "Egypt": "EG",
    "El Salvador": "SV",
    "Equatorial Guinea": "GQ",
    "Eritrea": "ER",
    "Estonia": "EE",
    "Eswatini": "SZ",
    "Ethiopia": "ET",
    "Fiji": "FJ",
    "Finland": "FI",
    "France": "FR",
    "Gabon": "GA",
    "Gambia": "GM",
    "Georgia": "GE",
    "Germany": "DE",
    "Ghana": "GH",
    "Greece": "GR",
    "Grenada": "GD",
    "Guatemala": "GT",
    "Guinea": "GN",
    "Guinea-Bissau": "GW",
    "Guyana": "GY",
    "Haiti": "HT",
    "Holy See": "VA",
    "Honduras": "HN",
    "Hungary": "HU",
    "Iceland": "IS",
    "India": "IN",
    "Indonesia": "ID",
    "Iran": "IR",
    "Iraq": "IQ",
    "Ireland": "IE",
    "Israel": "IL",
    "Italy": "IT",
    "Jamaica": "JM",
    "Japan": "JP",
    "Jordan": "JO",
    "Kazakhstan": "KZ",
    "Kenya": "KE",
    "Kiribati": "KI",
    "Kuwait": "KW",
    "Kyrgyzstan": "KG",
    "Laos": "LA",
    "Latvia": "LV",
    "Lebanon": "LB",
    "Lesotho": "LS",
    "Liberia": "LR",
    "Libya": "LY",
    "Liechtenstein": "LI",
    "Lithuania": "LT",
    "Luxembourg": "LU",
    "Madagascar": "MG",
    "Malawi": "MW",
    "Malaysia": "MY",
    "Maldives": "MV",
    "Mali": "ML",
    "Malta": "MT",
    "Marshall Islands": "MH",
    "Mauritania": "MR",
    "Mauritius": "MU",
    "Mexico": "MX",
    "Micronesia": "FM",
    "Moldova": "MD",
    "Monaco": "MC",
    "Mongolia": "MN",
    "Montenegro": "ME",
    "Morocco": "MA",
    "Mozambique": "MZ",
    "Myanmar (formerly Burma)": "MM",
    "Namibia": "NA",
    "Nauru": "NR",
    "Nepal": "NP",
    "Netherlands": "NL",
    "New Zealand": "NZ",
    "Nicaragua": "NI",
    "Niger": "NE",
    "Nigeria": "NG",
    "North Korea": "KP",
    "North Macedonia": "MK",
    "Norway": "NO",
    "Oman": "OM",
    "Pakistan": "PK",
    "Palau": "PW",
    "Palestine State": "PS",
    "Panama": "PA",
    "Papua New Guinea": "PG",
    "Paraguay": "PY",
    "Peru": "PE",
    "Philippines": "PH",
    "Poland": "PL",
    "Portugal": "PT",
    "Qatar": "QA",
    "Romania": "RO",
    "Russia": "RU",
    "Rwanda": "RW",
    "Saint Kitts and Nevis": "KN",
    "Saint Lucia": "LC",
    "Saint Vincent and the Grenadines": "VC",
    "Samoa": "WS",
    "San Marino": "SM",
    "Sao Tome and Principe": "ST",
    "Saudi Arabia": "SA",
    "Senegal": "SN",
    "Serbia": "RS",
    "Seychelles": "SC",
    "Sierra Leone": "SL",
    "Singapore": "SG",
    "Slovakia": "SK",
    "Slovenia": "SI",
    "Solomon Islands": "SB",
    "Somalia": "SO",
    "South Africa": "ZA",
    "South Korea": "KR",
    "South Sudan": "SS",
    "Spain": "ES",
    "Sri Lanka": "LK",
    "Sudan": "SD",
    "Suriname": "SR",
    "Sweden": "SE",
    "Switzerland": "CH",
    "Syria": "SY",
    "Tajikistan": "TJ",
    "Tanzania": "TZ",
    "Thailand": "TH",
    "Timor-Leste": "TL",
    "Togo": "TG",
    "Tonga": "TO",
    "Trinidad and Tobago": "TT",
    "Tunisia": "TN",
    "Turkey": "TR",
    "Turkmenistan": "TM",
    "Tuvalu": "TV",
    "Uganda": "UG",
    "Ukraine": "UA",
    "United Arab Emirates": "AE",
    "United Kingdom": "GB",
    "United States of America": "US",
    "Uruguay": "UY",
    "Uzbekistan": "UZ",
    "Vanuatu": "VU",
    "Venezuela": "VE",
    "Vietnam": "VN",
    "Yemen": "YE",
    "Zambia": "ZM",
    "Zimbabwe": "ZW"
};

const COUNTRY_ISO_MAP_LOWER = Object.fromEntries(
  Object.entries(COUNTRY_ISO_MAP).map(([name, code]) => [name.toLowerCase(), code])
);

const getIsoAlpha2Code = (countryName) => {
    if (!countryName) return null;
    const normalized = countryName.trim().toLowerCase();
    return COUNTRY_ISO_MAP_LOWER[normalized] || null;
};

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

export const getInternationalShippingRate = async (deliveryCountry, deliveryPincode, weight) => {
  try {
    const token = await getShiprocketToken();
    const pickupPincode = "600081"; // Tondiarpet, Chennai origin

    const isoCountry = getIsoAlpha2Code(deliveryCountry) || deliveryCountry;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/international/serviceability?pickup_postcode=${pickupPincode}&delivery_country=${isoCountry}&delivery_postcode=${deliveryPincode || ""}&weight=${weight}&cod=0`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
        throw new Error(`Shiprocket International API returned ${response.status}`);
    }

    const data = await response.json();

    if (data && data.data && data.data.available_courier_companies && data.data.available_courier_companies.length > 0) {
      // Filter out blocked couriers
      const validCouriers = data.data.available_courier_companies.filter(c => c.blocked === 0);

      if (validCouriers.length === 0) return null;

      // Sort by cheapest rate
      const sortedCouriers = validCouriers.sort((a, b) => a.rate.total - b.rate.total);
      return sortedCouriers[0].rate.total;
    }
    return null;
  } catch (err) {
    console.error("International rate fetch error:", err.message);
    return null; // Fail gracefully, allows fallback
  }
};

/**
 * Pushes a verified order (Prepaid or COD) to Shiprocket.
 * Handles both order creation and AWB assignment.
 * Updates the order in DB with shipmentId, shiprocketOrderId, and awb.
 *
 * @param {object} order
 * @param {{ manual?: boolean }} [opts] - manual: true bypasses the international
 *   auto-push gate. That gate exists to stop a payment webhook from silently
 *   booking a courier against an unverified international payload; an admin
 *   explicitly clicking "Push to Shiprocket" for one specific order IS the human
 *   confirmation the gate is meant to require, so it must not also block that path.
 */
export const pushOrderToShiprocket = async (order, opts = {}) => {
  try {
    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) return;
    if (order.shiprocketOrderId || order.shipmentId) return; // Already created

    const domestic = isIndiaOrder(order);

    // ── International gate ────────────────────────────────────────────────────
    // Fails CLOSED for the automatic post-payment path. The domestic payload below
    // sanitises addresses for Indian couriers (6-digit pincode, 10-digit phone) and
    // would turn a Boston order into a Delhi one, so international must never fall
    // through to it by accident from an unattended webhook.
    // Flip SHIPROCKET_INTERNATIONAL_ENABLED=true to enable it for the automatic
    // path too, once a live test order has been confirmed landing in the
    // dashboard's International tab.
    if (!domestic && !opts.manual && process.env.SHIPROCKET_INTERNATIONAL_ENABLED !== "true") {
      console.warn(`[Shiprocket] International auto-push disabled — order ${order._id} (${order.shippingDetails?.country}) flagged for manual fulfilment. Set SHIPROCKET_INTERNATIONAL_ENABLED=true to enable, or push it manually from the admin panel.`);
      await flagForManualReview(order._id, `International order (${order.shippingDetails?.country}) — automated international push is disabled; arrange carrier manually.`);
      return;
    }

    const token = await getShiprocketToken();
    const shippingDetails = order.shippingDetails;

    const shiprocketItems = order.items.map(item => {
      const product = item.product || {};
      const baseName = product.name || "Product";
      const baseSku = product.pid || product._id?.toString() || "SKU";
      
      const variantSuffix = item.variant ? ` - ${item.variant}` : '';
      const variantSkuSuffix = item.variant ? `-${item.variant.replace(/\s+/g, '')}` : '';

      return {
        name: baseName + variantSuffix,
        sku: baseSku + variantSkuSuffix,
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
    const phoneStr = (shippingDetails.phone || "").trim();
    const digitsOnlyPhone = phoneStr.replace(/\D/g, "");
    const rawPincode = (shippingDetails.pincode || "").trim();

    const finalPhone = domestic
      ? (digitsOnlyPhone.length >= 10 ? digitsOnlyPhone.slice(-10) : "9999999999")
      : phoneStr.replace(/[^\d+]/g, "");             // keep country code but drop spaces/hyphens
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
      // ── Explicit shipping block ───────────────────────────────────────────
      // `shipping_is_billing: true` is honoured for domestic orders but NOT for
      // international ones — Shiprocket left the shipping fields empty and flagged
      // the order unshippable:
      //   errors: { shipping_phone: "Customer phone is empty",
      //             shipping_pincode: "Delivery pincode is empty" }
      // Sending the block explicitly costs nothing on the domestic path (identical
      // values) and is what makes an international order actually dispatchable.
      shipping_customer_name: firstName,
      shipping_last_name: lastName,
      shipping_address: shippingDetails.address || "No Address Provided",
      shipping_city: shippingDetails.city || (domestic ? "Delhi" : ""),
      shipping_pincode: finalPincode,
      shipping_state: shippingDetails.state || (domestic ? "Delhi" : ""),
      shipping_country: shippingDetails.country || "India",
      shipping_email: shippingDetails.email || "customer@bodilicious.in",
      shipping_phone: finalPhone,
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