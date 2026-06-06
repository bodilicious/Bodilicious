export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("WhatsApp Webhook verified!");
      return res.status(200).send(challenge);
    } else {
      return res.status(403).json({ success: false, message: "Verification failed" });
    }
  }
  return res.status(400).json({ success: false, message: "Missing parameters" });
};

export const handleWebhook = (req, res) => {
  const body = req.body;

  if (body.object === "whatsapp_business_account") {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.statuses
    ) {
      const status = body.entry[0].changes[0].value.statuses[0];
      console.log(`[WhatsApp Webhook] Message ${status.id} updated to status: ${status.status}`);
    }

    return res.status(200).send("EVENT_RECEIVED");
  } else {
    return res.status(404).send();
  }
};
