import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { LoggerLike } from '@emailrpc/core';

export type SmtpAuth = {
  user: string;
  pass: string;
};

export type SmtpDkim = {
  domainName: string;
  keySelector: string;
  privateKey: string;
};

export type SmtpTransportOptions = {
  host: string;
  port: number;
  secure?: boolean;
  auth?: SmtpAuth;
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  dkim?: SmtpDkim;
  nodemailer?: SMTPTransport.Options;
  logger?: LoggerLike;
};
