---
name: better-notify
description: End-to-end typed notification infrastructure for Node.js — typed catalog of email, SMS, push, web push, WhatsApp, Slack, Discord, Telegram, and GitHub notifications with provider-agnostic transports. Use when the user wants to set up notifications, define a notification catalog, send transactional email or other notifications, add a new provider/transport, expose notifications to AI agents via MCP, or asks about any `@betternotify/*` package (core, email, sms, push, webpush, whatsapp, github, smtp, resend, twilio, onesignal, mcp, etc.).
metadata:
  author: betternotify
  homepage: https://better-notify.com
  version: '1.1'
---

# Better Notify

End-to-end typed notification infrastructure for Node.js (ESM-only, Node >= 22). A single catalog type drives the typed sender and webhook router — analogous to tRPC, but for notifications.

## References

- **`references/setup.md`** — Load when the user wants to add Better Notify to a project, scaffold a catalog/client, install channel or transport packages, or wire up an MCP server. Contains an interactive setup wizard, install tables, and end-to-end code snippets.
- **`references/best-practices.md`** — Load when the user is configuring an existing Better Notify install: slot tables for a specific channel, middleware/hooks, subpath imports, multi-transport strategies, MCP `createMcpServer` options, error classes, and common gotchas.

## Core Concepts

**Catalog** — Typed contract defining notification routes. Built with `createNotify()`, composed via `.catalog()`. Sub-catalogs flatten into dot-path IDs (`transactional.welcome`).

**Client** — Type-safe sender derived from a catalog. `createClient()` returns `mail.<route>.send(input)` and `.render()`.

**Channel** — Notification medium (email, SMS, push, etc.). Each defines its own message shape and transport interface. `defineChannel()` creates custom channels.

**Transport** — Delivery adapter for a channel. Receives a resolved message and sends it.

**Middleware** — Composable pipeline functions. Named with `with` prefix (`withRateLimit`, `withDryRun`).

**Template Adapter** — Renders input into HTML/text. Adapters for React Email, MJML, and Handlebars.

## Packages

**Core:** `@betternotify/core` — contracts, client, middleware, hooks, webhook router. Subpath exports: `/transports`, `/middlewares`, `/stores`, `/sinks`, `/tracers`, `/logger`, `/plugins`, `/config`.

**Channels:** `@betternotify/{email, sms, push, webpush, discord, slack, telegram, whatsapp, github}`, `@betternotify/zapier` (channel + email transport)

**Transports:** `@betternotify/smtp` (Nodemailer), `@betternotify/{resend, cloudflare-email, twilio, autosend, selligent}`, `@betternotify/mailchimp` (Mandrill), `@betternotify/onesignal` (push + email + SMS)

**Templates:** `@betternotify/{react-email, mjml, handlebars}`

**MCP:** `@betternotify/mcp` — exposes a catalog as Model Context Protocol tools so AI agents can send notifications

**CLI:** `create-better-notify` — scaffolding tool (`npx create-better-notify`)

Docs: [better-notify.com/docs](https://better-notify.com/docs)
