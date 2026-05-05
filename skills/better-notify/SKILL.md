---
name: better-notify
description: Context and API guidance for Better Notify — end-to-end typed notification infrastructure for Node.js
metadata:
  author: betternotify
  homepage: https://better-notify.com
---

# Better Notify

End-to-end typed notification infrastructure for Node.js (ESM-only, Node >= 22). A single catalog type drives the typed sender and webhook router — analogous to tRPC, but for notifications.

## When to use

When setting up typed notifications, adding email/SMS/push transports, defining notification catalogs, or answering questions about `@betternotify/*` packages.

## Skills

- **[setup](./setup/SKILL.md)** — Interactive setup wizard. Scans your project, asks what channels/transports you need, and scaffolds the catalog + client.
- **[best-practices](./best-practices/SKILL.md)** — Quick reference for configuration, channel slots, subpath imports, middleware, hooks, and common gotchas.

## Core Concepts

**Catalog** — Typed contract defining notification routes. Built with `createNotify()`, composed via `.catalog()`. Sub-catalogs flatten into dot-path IDs (`transactional.welcome`).

**Client** — Type-safe sender derived from a catalog. `createClient()` returns `mail.<route>.send(input)` and `.render()`.

**Channel** — Notification medium (email, SMS, push, etc.). Each defines its own message shape and transport interface. `defineChannel()` creates custom channels.

**Transport** — Delivery adapter for a channel. Receives a resolved message and sends it.

**Middleware** — Composable pipeline functions. Named with `with` prefix (`withRateLimit`, `withDryRun`).

**Template Adapter** — Renders input into HTML/text. Adapters for React Email, MJML, and Handlebars.

## Packages

**Core:** `@betternotify/core` — contracts, client, middleware, hooks, webhook router. Subpath exports: `/transports`, `/middlewares`, `/stores`, `/sinks`, `/tracers`, `/logger`, `/plugins`, `/config`.

**Channels:** `@betternotify/{email, sms, push, discord, slack, telegram}`, `@betternotify/zapier` (channel + email transport)

**Transports:** `@betternotify/smtp` (Nodemailer), `@betternotify/{resend, cloudflare-email, twilio}`, `@betternotify/mailchimp` (Mandrill)

**Templates:** `@betternotify/{react-email, mjml, handlebars}`

**CLI:** `create-better-notify` — scaffolding tool (`npx create-better-notify`)

Docs: [better-notify.com/docs](https://better-notify.com/docs)
