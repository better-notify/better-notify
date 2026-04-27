import nodemailer from 'nodemailer';
import type { Address, FromInput, Transport } from '@betternotify/email';
import { formatAddress, normalizeAddress } from '@betternotify/email/transports';
import { consoleLogger, NotifyRpcError } from '@betternotify/core';
import type { SmtpTransportOptions } from './types.js';

const fromInputToAddress = (input: Address | FromInput | undefined): Address | undefined => {
  if (!input) return undefined;
  if (typeof input === 'string') return input;
  if (!input.email) return undefined;
  return input.name ? { name: input.name, email: input.email } : { email: input.email };
};

export type { SmtpTransportOptions, SmtpAuth, SmtpDkim } from './types.js';

export const smtpTransport = (opts: SmtpTransportOptions): Transport => {
  const transportConfig = {
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth: opts.auth,
    pool: opts.pool,
    maxConnections: opts.maxConnections,
    maxMessages: opts.maxMessages,
    dkim: opts.dkim,
    ...opts?.nodemailer,
  };

  const transporter = nodemailer.createTransport(
    transportConfig as Parameters<typeof nodemailer.createTransport>[0],
  );

  const log = (opts.logger ?? consoleLogger()).child({ component: 'smtp' });
  const warned = new Set<string>();

  const fallbackFrom = opts.auth?.user;

  return {
    name: 'smtp',
    async send(message, ctx) {
      const from = fromInputToAddress(message.from ?? fallbackFrom);
      if (!from) {
        throw new NotifyRpcError({
          message:
            'SMTP transport: no "from" address. Set it on the channel default, route `.from()` resolver, per-call args, or supply `auth.user` on smtpTransport.',
          code: 'CONFIG',
          route: ctx.route,
          messageId: ctx.messageId,
        });
      }
      if (opts.auth?.user) {
        const fromAddress = normalizeAddress(from);

        if (fromAddress !== opts.auth.user && !warned.has(fromAddress)) {
          warned.add(fromAddress);

          log.warn('From address differs from SMTP auth user; many providers will rewrite this', {
            fromAddress,
            authUser: opts.auth.user,
            route: ctx.route,
          });
        }
      }
      const info = await transporter.sendMail({
        from: formatAddress(from),
        to: message.to.map(formatAddress),
        cc: message.cc?.map(formatAddress),
        bcc: message.bcc?.map(formatAddress),
        replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        attachments: message.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.cid,
        })),
      });

      return {
        ok: true,
        data: {
          transportMessageId: info.messageId,
          accepted: info.accepted.map(String),
          rejected: info.rejected.map(String),
          raw: info,
        },
      };
    },
    async verify() {
      const ok = await transporter.verify();
      return { ok };
    },
    async close() {
      transporter.close();
    },
  };
};
