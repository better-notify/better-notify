import type { Address, FromInput } from '../types.js';

const fromInputToParts = (
  input: FromInput | undefined,
): { name: string | undefined; email: string | undefined } => {
  if (!input) return { name: undefined, email: undefined };
  if (typeof input === 'string') return { name: undefined, email: input };
  return { name: input.name, email: input.email };
};

export const resolveFrom = (
  perEmail: FromInput | undefined,
  defaults: FromInput | undefined,
): Address | undefined => {
  const a = fromInputToParts(perEmail);
  const b = fromInputToParts(defaults);
  const email = a.email ?? b.email;
  if (!email) return undefined;
  const name = a.name ?? b.name;
  return name ? { name, email } : { email };
};
