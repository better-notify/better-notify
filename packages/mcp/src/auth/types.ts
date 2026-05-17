/** Discriminated result returned by an auth function — either success with optional context or failure with optional reason. */
export type AuthResult =
  | { ok: true; context?: Record<string, unknown> }
  | { ok: false; reason?: string };

/** A function that authenticates an incoming HTTP request and returns an {@link AuthResult}. */
export type AuthFn = (req: Request) => AuthResult | Promise<AuthResult>;

/** Auth strategy returned by {@link createAuth}, {@link apiKeyAuth}, or {@link bearerAuth}. */
export type McpAuth = {
  verify: AuthFn;
};
