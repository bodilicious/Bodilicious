import Order from "./models.js";

let cachedToken = null;
let tokenExpiry = null;

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
      billing_city: shippingDetails.city || "Delhi",
      billing_pincode: finalPincode,
      billing_state: shippingDetails.state || "Delhi",
      billing_country: shippingDetails.country || "India",
      billing_email: shippingDetails.email || "customer@bodilicious.in",
      billing_phone: finalPhone,
      shipping_is_billing: true,
      order_items: shiprocketItems,
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
        await Order.findByIdAndUpdate(order._id, {
          shipmentId: data.shipment_id,
          shiprocketOrderId: data.order_id,
        });
      }
    } else {
      console.error("Shiprocket Order Creation Failed:", await createRes.text());
      if (order.paymentStatus === "paid") {
        await Order.findByIdAndUpdate(order._id, { orderStatus: "payment_captured_fulfillment_pending" });
      }
    }
  } catch (err) {
    console.error("Shiprocket push error:", err.message);
    if (order && order.paymentStatus === "paid") {
      await Order.findByIdAndUpdate(order._id, { orderStatus: "payment_captured_fulfillment_pending" }).catch(e => console.error(e));
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