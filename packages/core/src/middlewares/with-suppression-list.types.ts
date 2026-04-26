import type { LoggerLike } from '../logger.js';
import type { SuppressionList } from '../stores/types.js';

export type SuppressionField = 'to' | 'cc' | 'bcc';

export type WithSuppressionListOptions = {
  list: SuppressionList;
  logger?: LoggerLike;
  fields?: ReadonlyArray<SuppressionField>;
};
