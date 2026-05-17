export type HistoryOptions = {
  maxSize?: number;
};

export type SendEventRecord = {
  route: string;
  messageId: string;
  status: 'success' | 'error';
  durationMs: number;
  startedAt: Date;
  endedAt: Date;
  error?: { name: string; message: string; code?: string };
};

export type RouteStats = {
  total: number;
  success: number;
  error: number;
  avgDurationMs: number;
};

export type ResourceStats = {
  total: number;
  success: number;
  error: number;
  routes: Record<string, RouteStats>;
};
