import type { ResourceStats, SendEventRecord } from './types.js';

export type RingBuffer = {
  push(event: SendEventRecord): void;
  getAll(): ReadonlyArray<SendEventRecord>;
  getByRoute(route: string): ReadonlyArray<SendEventRecord>;
  getStats(): ResourceStats;
  clear(): void;
};

export const createRingBuffer = (maxSize: number): RingBuffer => {
  const buffer: SendEventRecord[] = [];

  return {
    push(event) {
      buffer.push(event);
      if (buffer.length > maxSize) {
        buffer.shift();
      }
    },

    getAll() {
      return buffer;
    },

    getByRoute(route) {
      return buffer.filter((e) => e.route === route);
    },

    getStats() {
      const stats: ResourceStats = { total: 0, success: 0, error: 0, routes: {} };

      for (const event of buffer) {
        stats.total++;
        if (event.status === 'success') stats.success++;
        else stats.error++;

        const routeStats = stats.routes[event.route] ?? {
          total: 0,
          success: 0,
          error: 0,
          avgDurationMs: 0,
        };
        stats.routes[event.route] = routeStats;
        routeStats.total++;
        if (event.status === 'success') routeStats.success++;
        else routeStats.error++;
        routeStats.avgDurationMs += event.durationMs;
      }

      for (const route of Object.keys(stats.routes)) {
        const routeStats = stats.routes[route];
        if (routeStats && routeStats.total > 0) {
          routeStats.avgDurationMs = Math.round(routeStats.avgDurationMs / routeStats.total);
        }
      }

      return stats;
    },

    clear() {
      buffer.length = 0;
    },
  };
};
