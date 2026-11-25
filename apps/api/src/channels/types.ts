export type OutboundMessage = {
  to: string;
  body: string;
};

export interface ChannelAdapter {
  readonly name: string;
  send(message: OutboundMessage): Promise<void>;
}
