export const toMcpInputSchema = (schema: unknown): unknown => {
  if (!schema || typeof schema !== 'object') return undefined;
  const candidate = schema as Record<string, unknown>;
  if ('_def' in candidate || '_zod' in candidate) return candidate;
  if (typeof candidate.parse === 'function' && typeof candidate.safeParse === 'function') {
    return candidate;
  }
  return undefined;
};
