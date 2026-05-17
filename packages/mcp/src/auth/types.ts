export type AuthResult =
  | { ok: true; context?: Record<string, unknown> }
  | { ok: false; reason?: string };

export type AuthFn = (req: Request) => AuthResult | Promise<AuthResult>;

export type McpAuth = {
  verify: AuthFn;
};
