import type { ChannelAdapter, OutboundMessage } from "./types.js";

/** Web Chat：訊息由 API 回傳給前端，這裡只做紀錄／擴充點 */
export class WebChatAdapter implements ChannelAdapter {
  readonly name = "web";
  readonly outbox: OutboundMessage[] = [];

  async send(message: OutboundMessage): Promise<void> {
    this.outbox.push({ ...message, body: message.body });
    if (this.outbox.length > 200) this.outbox.shift();
  }
}
