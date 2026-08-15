export const getPhone = (user, fallback) => {
  const raw = user?.phone || fallback || null;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length > 10) return digits;
  
  return null;
};

export const sendWhatsAppTemplate = async (phone, templateName, components) => {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.log(`[MOCK] WhatsApp credentials missing. Simulating sending template '${templateName}' to ${phone}`);
      console.log(`[MOCK] Components:`, JSON.stringify(components, null, 2));
      return { messages: [{ id: `mock-msg-${Date.now()}` }] };
    }

    if (!phone) {
      console.warn("Skipping WhatsApp message: No valid phone number provided.");
      return;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components: components || [],
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("WhatsApp Send Error:", errorData);
      throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`WhatsApp message sent to ${phone} using template ${templateName}. Message ID: ${data?.messages?.[0]?.id}`);
    return data;
  } catch (error) {
    console.error("WhatsApp Service Exception:", error.message);
    throw error; // Let BullMQ catch and retry
  }
};
