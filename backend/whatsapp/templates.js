import { sendWhatsAppTemplate } from "./service.js";

// Helper to construct a standard text parameter
const textParam = (text) => ({ type: "text", text: String(text) });

export const sendOrderPlaced = async (phone, data) => {
  // variables: name, order_id, amount, edd
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.order_id),
        textParam(data.amount),
        textParam(data.edd || "3-5 business days")
      ]
    }
  ];
  return sendWhatsAppTemplate(phone, "order_placed", components);
};

export const sendStaleCart = async (phone, data) => {
  // variables: name, product_name, cart_url
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.product_name)
      ]
    }
    // Add button components if needed based on Meta template configuration
  ];
  return sendWhatsAppTemplate(phone, "stale_cart_nudge", components);
};

export const sendOutForDelivery = async (phone, data) => {
  // variables: name, order_id, courier, awb
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.order_id),
        textParam(data.courier || "Delivery Partner"),
        textParam(data.awb)
      ]
    }
  ];
  return sendWhatsAppTemplate(phone, "out_for_delivery", components);
};

export const sendTicketRaised = async (phone, data) => {
  // variables: name, ticket_id, type
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.ticket_id),
        textParam(data.type)
      ]
    }
  ];
  return sendWhatsAppTemplate(phone, "ticket_raised", components);
};

export const sendTicketResolved = async (phone, data) => {
  // variables: name, ticket_id
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.ticket_id)
      ]
    }
  ];
  return sendWhatsAppTemplate(phone, "ticket_resolved", components);
};

export const sendTrendingProduct = async (phone, data) => {
  // variables: name, product_name, price
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.product_name),
        textParam(data.price)
      ]
    }
  ];
  return sendWhatsAppTemplate(phone, "trending_product_broadcast", components);
};

export const sendReEngagement = async (phone, data) => {
  // variables: name
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer")
      ]
    }
  ];
  return sendWhatsAppTemplate(phone, "reengagement_60d", components);
};

export const sendPaymentFailure = async (phone, data) => {
  // variables: name, amount
  // Button dynamic links can be passed in `data.retry_url_suffix` if template uses dynamic URL button
  const components = [
    {
      type: "body",
      parameters: [
        textParam(data.name || "Customer"),
        textParam(data.amount)
      ]
    }
  ];
  if (data.retry_url_suffix) {
     components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        textParam(data.retry_url_suffix)
      ]
    });
  }
  return sendWhatsAppTemplate(phone, "payment_failure_retry", components);
};
