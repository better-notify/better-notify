export type SmsAddress = string;

export type SmsSendArgs<TInput = unknown> = {
  to: SmsAddress;
  input: TInput;
};

export type RenderedSms = {
  body: string;
  to?: SmsAddress;
};
