export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text: string;
};

export interface EmailAdapter {
  send(payload: EmailPayload): Promise<void>;
}
