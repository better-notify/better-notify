export type Priority = 'low' | 'normal' | 'high';

export type Tags = {
  [key: string]: string | number | boolean;
};

export type SendContext = {
  route: string;
  messageId: string;
  attempt: number;
};
