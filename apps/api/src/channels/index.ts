import { config } from "../config.js";
import type { ChannelAdapter } from "./types.js";
import { WebChatAdapter } from "./web.js";
import { WhatsAppCloudAdapter } from "./whatsapp.js";

export const webAdapter = new WebChatAdapter();
export const whatsappAdapter = new WhatsAppCloudAdapter();

export function getAdapter(channel?: string): ChannelAdapter {
  const mode = channel ?? config.channelMode;
  if (mode === "whatsapp") return whatsappAdapter;
  return webAdapter;
}

export type { ChannelAdapter, OutboundMessage } from "./types.js";
