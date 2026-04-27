import type { TracerLike } from '../tracers/types.js';

export type TracingNameParams = {
  route: string;
  messageId: string;
};

export type WithTracingOptions = {
  tracer: TracerLike;
  name?: string | ((params: TracingNameParams) => string);
};
