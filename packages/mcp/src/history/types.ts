/** Configuration for the in-memory notification history ring buffer. */
export type HistoryOptions = {
  maxSize?: number;
};

/** A single send event captured by the MCP plugin's `onAfterSend` / `onError` hooks. */
export type SendEventRecord = {
  route: string;
  messageId: string;
  status: 'success' | 'error';
  durationMs: number;
  startedAt: Date;
  endedAt: Date;
  error?: { name: string; message: string; code?: string };
};

/** Aggregated statistics for a single route. */
export type RouteStats = {
  total: number;
  success: number;
  error: number;
  avgDurationMs: number;
};

/** Aggregated statistics across all routes, exposed via the `notifications://stats` MCP resource. */
export type ResourceStats = {
  total: number;
  success: number;
  error: number;
  routes: Record<string, RouteStats>;
};
