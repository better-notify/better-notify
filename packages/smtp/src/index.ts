import nodemailer from 'nodemailer';
import type { Transport } from '@emailrpc/core/transports';
import { formatAddress, normalizeAddress } from '@emailrpc/core/transports';
import { consoleLogger } from '@emailrpc/core';
import type { SmtpTransportOptions } from './types.js';

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

  return {
    name: 'smtp',
    async send(message, ctx) {
      if (opts.auth?.user) {
        const fromAddress = normalizeAddress(message.from);

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
        from: formatAddress(message.from),
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
        transportMessageId: info.messageId,
        accepted: info.accepted.map(String),
        rejected: info.rejected.map(String),
        raw: info,
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
