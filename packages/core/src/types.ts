export type Priority = 'low' | 'normal' | 'high';

export type Tags = {
  [key: string]: string | number | boolean;
};

import type { TransportData } from './transport.js';

export type SendContext = {
  route: string;
  messageId: string;
  attempt: number;
  transport?: TransportData;
};
