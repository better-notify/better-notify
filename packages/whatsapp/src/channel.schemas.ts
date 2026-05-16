import { z } from 'zod';

const to = z.string().min(1);

export const textArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const imageArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const videoArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const documentArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const audioArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const locationArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const reactionArgsSchema = z.object({
  to,
  messageId: z.string().min(1),
  input: z.unknown(),
});

export const interactiveArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const contactsArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const templateArgsSchema = z.object({
  to,
  input: z.unknown(),
});

export const permissiveArgsSchema = z
  .object({
    to: z.string().min(1),
    messageId: z.string().optional(),
    input: z.unknown(),
  })
  .loose();
