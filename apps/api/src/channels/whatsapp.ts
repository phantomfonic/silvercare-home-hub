import { config } from "../config.js";
import type { ChannelAdapter, OutboundMessage } from "./types.js";

/** Meta WhatsApp Cloud API adapter；未設定 token 時降級為 log */
export class WhatsAppCloudAdapter implements ChannelAdapter {
  readonly name = "whatsapp";

  async send(message: OutboundMessage): Promise<void> {
    if (!config.whatsappToken || !config.whatsappPhoneNumberId) {
      console.warn("[whatsapp] 未設定 WHATSAPP_TOKEN / PHONE_NUMBER_ID，略過發送:", message.to);
      return;
    }

    const url = `https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to.replace(/\D/g, ""),
        type: "text",
        text: { body: message.body },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WhatsApp 發送失敗: ${res.status} ${text}`);
    }
  }
}
