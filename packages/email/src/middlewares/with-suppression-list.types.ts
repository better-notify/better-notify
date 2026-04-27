import type { LoggerLike, SuppressionList } from '@betternotify/core';

export type SuppressionField = 'to' | 'cc' | 'bcc';

export type WithSuppressionListOptions = {
  list: SuppressionList;
  logger?: LoggerLike;
  fields?: ReadonlyArray<SuppressionField>;
};
