# emailRpc — Technical Specification

> End-to-end typed email infrastructure for Node.js. Define email contracts once, get a typed sender, queue worker, webhook router — all driven by the same router type.

**Version:** 0.1.0 (spec)
**Status:** Draft
**Target runtime:** Node.js ≥ 22 (ESM-first, CJS shipped via Rolldown)
**Language:** TypeScript ≥ 5.4

---

## 1. Goals & non-goals

### Goals

- **End-to-end type safety.** A single `EmailRouter` type drives the sender, queue, worker, webhook handlers. No string-based job names, no untyped template variables.
- **Schema-first.** Every email declares its input schema (Zod / Valibot / ArkType via Standard Schema). Inputs are validated at the edge of the system — at `mail.welcome(...)` call time, at queue worker pickup, and at template render.
- **Typed template variables.** Template props are inferred from the input schema. If you change the schema, the template stops type-checking until you update it.
- **Pluggable everything.** Provider, queue, storage, and renderer are interfaces. Defaults ship for the common case (SMTP via nodemailer, BullMQ on Redis, Postgres event log, React Email).
- **Operable.** Suppression list, retries, dead-letter queue, webhook ingestion. Production concerns are first-class, not afterthoughts.

### Non-goals

- **Inbound email parsing / IMAP.** Outbound only. Inbound webhooks (bounces, complaints, opens) are supported but full mail-server functionality is not.
- **Frontend client.** emailRpc is server-side. There is no browser-callable client. Trigger sends from your own API layer.
- **Marketing automation.** No drip campaigns, segments, or A/B testing in v1. The primitives allow building these on top.
- **Analytics dashboards / admin UI.** No bundled reports UI. Hooks (§9) and middleware (§8) emit enough structure to ship events to your own observability stack. A visual dashboard is deferred to a future enterprise tier.
- **HTML rendering engine of our own.** Rendering is delegated to user-chosen adapters (React Email, MJML, Handlebars, or a hand-written one). Core only ships the adapter interface and the input serializer.

---

## 2. Architecture overview

Six layers, each consuming the layer above through types:

```
┌───────────────────────────────────────────────────────────┐
│ Layer 6 │ Webhook router        (inbound provider events) │
├─────────┼───────────────────────────────────────────────  │
│ Layer 5 │ Queue & worker        (BullMQ / pg-boss)        │
├─────────┼───────────────────────────────────────────────  │
│ Layer 4 │ Middleware pipeline   (logging, suppression,    │
│         │ + Hooks                rate limit, events;      │
│         │   (§9)                 hooks for observation)   │
├─────────┼───────────────────────────────────────────────  │
│ Layer 3 │ Provider              (SMTP, SES, Resend, multi)│
├─────────┼───────────────────────────────────────────────  │
│ Layer 2 │ Sender (typed client) (mail.welcome({...}))     │
├─────────┼───────────────────────────────────────────────  │
│ Layer 1 │ Contracts             (router + email defs)     │
└───────────────────────────────────────────────────────────┘
```

Layer 1 is the source of truth. Every other layer derives its types from `typeof router`. Middleware and hooks are co-located at Layer 4 but distinct: middleware can change outcomes, hooks can only react to them (see §9.8).

---

## 3. Monorepo, build & publication

### 3.1 Tooling

- **Monorepo:** Turborepo + pnpm workspaces. Caching for `build`, `typecheck`, `test`, `lint` configured per-package, with `dependsOn: ["^build"]` for build ordering.
- **Build:** [Rolldown](https://rolldown.rs) (Rust-based bundler, oxc-powered). One config per package. Outputs ESM-first with CJS shipped for compatibility.
- **Runtime target:** Node.js ≥ 22 (ESM-native, stable `node:test`, built-in `--watch`, native `.env` loading via `--env-file`, stable `node:sqlite` available for the dev storage adapter).
- **TypeScript:** ≥ 5.4. Declarations bundled via Rolldown's `dts` plugin into a single `.d.ts` per entrypoint.
- **Versioning:** Changesets for changelog generation and release coordination. Single coordinated release line across all packages — when core bumps, adapter packages with breaking changes bump in the same release.
- **Registry:** npm (public). Org/scope: `@emailrpc`.

### 3.2 Package strategy: flat, role-named, opt-in

The split rule is one sentence:

> **An adapter ships as its own package if it pulls a non-trivial peer dependency. Otherwise it lives in `@emailrpc/core` under a subpath export.**

This matches what oRPC and tRPC do — flat package names where each name describes the _role_ or _integration target_. We deliberately avoid grouping prefixes (`@emailrpc/providers/...` etc.) because npm doesn't allow nested scopes and the flat shape reads better in `package.json` anyway.

By that rule, the published surface is:

```
packages/
  @emailrpc/core              # Contracts, sender, hooks, middleware,
                              # SMTP provider, multi-provider, mock provider,
                              # template adapter interface + serializer,
                              # webhook router (sans signature verifiers),
                              # in-memory queue, CLI binary, test utilities
  @emailrpc/react-email       # React Email adapter   [peer: react, @react-email/*]
  @emailrpc/mjml              # MJML adapter          [peer: mjml]
  @emailrpc/handlebars        # Handlebars adapter    [peer: handlebars]
  @emailrpc/ses               # AWS SES provider      [peer: @aws-sdk/client-sesv2]
  @emailrpc/resend            # Resend provider       [peer: resend]
  @emailrpc/bullmq            # BullMQ queue adapter  [peer: ioredis, bullmq]
```

Reasoning per package:

**`@emailrpc/core`.** Everything you need for a typed email pipeline that works without choosing a renderer or queue beyond defaults. SMTP via nodemailer is small (~200 KB) and universal — no separate `@emailrpc/smtp` package. Core ships the **template adapter interface** and the **input serializer**, not specific renderers (see §5) — picking a renderer is the user's call, and writing a renderer adapter is a few lines of code.

**`@emailrpc/react-email`, `@emailrpc/mjml`, `@emailrpc/handlebars`.** Each is a thin adapter around its respective renderer. Splitting them lets users install only the renderer they actually use, instead of paying for all three. Each is ~5–20 KB plus its peer.

**`@emailrpc/ses`, `@emailrpc/resend`.** Each provider has exactly one heavy peer (the AWS SDK or the Resend SDK). Keeping them separate keeps the install clean: a Resend user never installs the AWS SDK.

**`@emailrpc/bullmq`.** Queue adapter for Redis-backed BullMQ. Pulls `ioredis` and `bullmq` as peers. Other queue backends (e.g. pg-boss) ship as their own package on the same pattern when added.

**Why no reports UI / dashboard package.** Analytics dashboards and admin UIs are deferred to a future enterprise tier. Core emits enough through hooks (§9) and middleware (§8) for users to wire their own observability — ship events to Datadog, write to Postgres, fire webhooks, whatever. The OSS spec stays focused on the email pipeline; visualization is a separate product concern.

### 3.3 Subpath exports inside `@emailrpc/core`

Core uses Node's `exports` field to expose internal modules:

```jsonc
// packages/core/package.json
{
  "name": "@emailrpc/core",
  "type": "module",
  "engines": { "node": ">=22" },
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./sender": { "import": "./dist/sender.js", "types": "./dist/sender.d.ts" },
    "./worker": { "import": "./dist/worker.js", "types": "./dist/worker.d.ts" },
    "./webhook": { "import": "./dist/webhook.js", "types": "./dist/webhook.d.ts" },
    "./provider": { "import": "./dist/provider.js", "types": "./dist/provider.d.ts" },
    "./template": { "import": "./dist/template.js", "types": "./dist/template.d.ts" },
    "./queue": { "import": "./dist/queue.js", "types": "./dist/queue.d.ts" },
    "./middleware": { "import": "./dist/middleware.js", "types": "./dist/middleware.d.ts" },
    "./test": { "import": "./dist/test.js", "types": "./dist/test.d.ts" },
    "./config": { "import": "./dist/config.js", "types": "./dist/config.d.ts" },
  },
  "bin": { "emailrpc": "./dist/cli.js" },
}
```

Typical project imports:

```ts
import { emailRpc } from '@emailrpc/core';
import { createSender } from '@emailrpc/core/sender';
import { smtp, multi } from '@emailrpc/core/provider';
import { suppressionListMw, rateLimitMw } from '@emailrpc/core/middleware';

// Renderer adapters are separate packages
import { reactEmail } from '@emailrpc/react-email';

// Provider adapters too, when you need them
import { ses } from '@emailrpc/ses';
import { bullmq } from '@emailrpc/bullmq';
```

### 3.4 Internal-only packages (not published)

The Turborepo workspace also contains packages that are **never published** — they exist only to share code between the published packages and the docs site. These have `"private": true`:

```
internal/
  tsconfig/                  # Shared tsconfig presets
  rolldown-config/           # Shared Rolldown build presets
  eslint-config/             # Shared lint rules
  fixtures/                  # Shared test fixtures (used by core tests + docs)
```

These don't appear on npm. Turborepo treats them like any other workspace package for build graph purposes.

### 3.5 Rolldown build configuration

A single shared Rolldown config in `internal/rolldown-config/` is consumed by every published package. Highlights:

```ts
// internal/rolldown-config/base.ts
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export const baseConfig = (opts: { entries: Record<string, string> }) =>
  defineConfig({
    input: opts.entries,
    output: [
      { dir: 'dist', format: 'esm', entryFileNames: '[name].js' },
      { dir: 'dist', format: 'cjs', entryFileNames: '[name].cjs' },
    ],
    platform: 'node',
    target: 'node22',
    external: [/^node:/, /^@emailrpc\//], // never bundle workspace siblings
    plugins: [dts({ resolve: true })],
  });
```

Each package's `rolldown.config.ts` extends this with its own entry points. Build is `rolldown -c` and is wrapped by `turbo run build` for caching.

**Why Rolldown** over tsdown/tsup/unbuild: Rolldown is the bundler being adopted by Vite for its 2.x line, written in Rust on top of oxc. For a library at this scope it gives us (a) significantly faster cold builds, (b) accurate tree-shaking with deep ESM support, (c) bundled `.d.ts` output via `rolldown-plugin-dts`, (d) one tool that handles ESM + CJS + types. We pin Rolldown's version in `internal/rolldown-config/` so package builds stay reproducible.

### 3.6 Publication workflow

1. **Develop on a branch.** Add a changeset with `pnpm changeset` describing the change and which packages are affected (Changesets walks the workspace graph automatically).
2. **PR review.** CI runs `turbo run build typecheck test lint` across all packages. The Rolldown build's cache key is content-hashed, so unchanged packages are cache hits.
3. **Merge to main.** A "Version Packages" PR is opened (or updated) automatically by the Changesets GitHub Action — this PR bumps versions and updates changelogs.
4. **Merge the version PR.** A second Action runs `pnpm publish -r --access public` using an `NPM_TOKEN` with provenance enabled (`--provenance`). Provenance lets installers verify the package was built from this commit by this CI run.
5. **Tag and release.** GitHub releases are auto-generated from the changeset entries.

**Pre-release channel:** `next` tag for `0.x` releases (`pnpm changeset pre enter next`), so people can opt in with `pnpm add emailrpc@next` while v1 is being stabilized. The `latest` tag stays on the most recent stable.

**Coordinated versioning.** Core breaking changes bump all adapter packages in lockstep with peer-dependency ranges enforced. This avoids the "core 2.0 + adapter still on 1.x" trap. Within a major, adapter packages can patch/minor independently — a Resend adapter fix shouldn't require touching the BullMQ adapter.

### 3.7 What ships in each tarball

For `npm pack` clarity. Sizes are estimates pre-implementation; treat as ballpark.

```
@emailrpc/core/                     # ~250 KB unpacked
  dist/*.js + *.cjs + *.d.ts
  package.json   (peer: nodemailer)
  README.md      LICENSE

@emailrpc/react-email/              # ~15 KB unpacked
  dist/*.js + *.cjs + *.d.ts
  (peer: react, @react-email/components, @react-email/render)

@emailrpc/mjml/                     # ~10 KB unpacked
  (peer: mjml)

@emailrpc/handlebars/               # ~10 KB unpacked
  (peer: handlebars)

@emailrpc/ses/                      # ~20 KB unpacked
  (peer: @aws-sdk/client-sesv2)

@emailrpc/resend/                   # ~10 KB unpacked
  (peer: resend)

@emailrpc/bullmq/                   # ~25 KB unpacked
  (peer: ioredis, bullmq)
```

Each package ships only its `dist/` plus `README.md`, `LICENSE`, and `package.json`. Source files, tests, and configs are excluded via the `files` field. Peer dependencies are declared `optional: true` where a package has multiple peers, so users only install what they actually import.

---

## 4. Layer 1 — Contracts

### 4.1 `init()` and the builder

```ts
import { emailRpc } from '@emailrpc/core';

const t = emailRpc.init<Context>();
```

`Context` is the type passed through middleware (similar to tRPC's `createContext`). Defaults to `{}`. Common context: request id, user, locale, tenant id.

### 4.2 Defining an email

```ts
import { z } from 'zod';
import { WelcomeEmail } from './templates/welcome';

export const welcome = t
  .email() // no id arg — the router map key becomes the route id
  .input(
    z.object({
      // Schema describes TEMPLATE PROPS only.
      // Transport fields (to/cc/bcc/replyTo/headers/attachments) belong
      // on .send() args, not in the schema. See §6.1.
      name: z.string().min(1),
      verifyUrl: z.url(),
      locale: z.enum(['en', 'pt-BR', 'nl']).default('en'),
    }),
  )
  .from('hello@guidemi.com') // optional override of router default
  .replyTo('support@guidemi.com') // optional; per-send replyTo wins (§6.1)
  .subject(
    ({ input }) =>
      ({
        en: `Welcome, ${input.name}!`,
        'pt-BR': `Bem-vindo, ${input.name}!`,
        nl: `Welkom, ${input.name}!`,
      })[input.locale],
  )
  .template(WelcomeEmail) // see §5
  .tags({ category: 'transactional', flow: 'onboarding' })
  .priority('normal'); // 'low' | 'normal' | 'high' (queue hint)
```

Each builder method returns a new builder type with the relevant slot filled. Calling `.input()` twice is a type error. Required slots before the builder is "complete": `input`, `subject`, `template`. Everything else has defaults.

**Why `.email()` takes no id.** The route id is the router map key (`welcome:` in §4.3). Stamping it twice — once as `.email('welcome')`, again as the map key — was a footgun: a typo would silently produce wrong queue job names. The id is assigned at `t.router({...})` time and surfaces on `def.id`, in hook context, in error messages, and on the wire-format job.

### 4.3 The router

```ts
export const emails = t.router({
  welcome,
  passwordReset,
  invoicePaid,
  bookingConfirmation,
});

export type EmailRouter = typeof emails;
```

The router is the contract. Export the **type** for use by the sender, worker. Export the **value** for use by the runtime that actually executes sends.

### 4.4 Standard Schema support

emailRpc accepts any Standard Schema validator (Zod 3.24+, Valibot, ArkType, Effect Schema). Internally, validation runs through the Standard Schema interface so the core has zero dependency on a specific validator.

```ts
// All equivalent
.input(z.object({ to: z.email() }))
.input(v.object({ to: v.pipe(v.string(), v.email()) }))
.input(type({ to: 'string.email' }))
```

---

## 5. Templates & variables

The flow is dead simple: hand the validated input to the template adapter, get HTML back, send the HTML to the provider. Core stays out of the rendering business — that's the adapter's job. We ship one adapter (`@emailrpc/react-email`) and provide the interface so anyone can write more.

### 5.1 The flow

```
mail.welcome({ to, name, verifyUrl })
        │
        ▼
1. Validate input against the schema           (core)
        │
        ▼
2. Pass validated input to the adapter         (core → adapter)
        │
        ▼
3. Adapter renders and returns { html, text? } (adapter)
        │
        ▼
4. Send HTML to the provider                   (core → SMTP / SES / …)
```

That's it. Core's responsibilities for templates are: validate input, invoke the adapter, take the HTML it returns, and send it. Anything between steps 2 and 3 — JSX rendering, MJML compilation, string interpolation, AI-generated copy, whatever — is the adapter's problem.

### 5.2 The `TemplateAdapter` interface

The interface is one method:

```ts
// @emailrpc/core/template
export interface TemplateAdapter<TInput> {
  render(input: TInput): Promise<{
    html: string;
    text?: string;
  }>;
}
```

That's the entire surface. No context object, no streaming, no inline-asset declarations baked in. If those become necessary they can be additive optional methods later, without breaking existing adapters.

### 5.3 Type-level guarantee

The `.template()` builder method requires a `TemplateAdapter<TInput>` where `TInput` is the inferred type of the procedure's input schema:

```ts
template<A extends TemplateAdapter<TInput>>(adapter: A): EmailBuilder<TInput, A>
```

This means:

- An adapter built for one set of fields cannot be attached to a procedure whose schema lacks those fields.
- If the schema gains a required field, the adapter no longer satisfies the constraint and the build fails until the adapter (or its underlying template) is updated.

This is the core "typed variables" guarantee: **schema and template can never silently drift apart.**

### 5.4 React Email adapter (`@emailrpc/react-email`)

The one adapter we ship at launch. Wraps a React component and renders it via `@react-email/render`.

```tsx
// templates/welcome.tsx
import { Html, Head, Body, Container, Heading, Button, Text } from '@react-email/components';

type Props = { name: string; verifyUrl: string; locale: 'en' | 'pt-BR' | 'nl' };

export function WelcomeEmail({ name, verifyUrl, locale }: Props) {
  const t = strings[locale];
  return (
    <Html lang={locale}>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#FFF6E8' }}>
        <Container style={{ padding: 32 }}>
          <Heading style={{ color: '#414535' }}>{t.greeting(name)}</Heading>
          <Text>{t.intro}</Text>
          <Button
            href={verifyUrl}
            style={{
              backgroundColor: '#618985',
              color: '#FFF6E8',
              padding: '12px 24px',
              borderRadius: 6,
            }}
          >
            {t.cta}
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

Attach it on the contract:

```ts
import { reactEmail } from '@emailrpc/react-email';
import { WelcomeEmail } from './templates/welcome';

const welcome = t
  .email('welcome')
  .input(welcomeInput)
  .subject(({ input }) => `Welcome, ${input.name}!`)
  .template(reactEmail(WelcomeEmail));
```

The adapter implementation is small enough to show in full:

```ts
// @emailrpc/react-email
import { render } from '@react-email/render'
import type { ComponentType } from 'react'
import type { TemplateAdapter } from '@emailrpc/core/template'

export function reactEmail<TInput extends object>(
  Component: ComponentType<TInput>
): TemplateAdapter<TInput> {
  return {
    render: async (input) => {
      const html = await render(<Component {...input} />)
      const text = await render(<Component {...input} />, { plainText: true })
      return { html, text }
    },
  }
}
```

### 5.5 Writing your own adapter

The interface is small enough that custom adapters are a few lines. Examples:

**Plain functions** — no rendering library at all:

```ts
import type { TemplateAdapter } from '@emailrpc/core/template'

export function fnTemplate<TInput>(opts: {
  html: (input: TInput) => string
  text?: (input: TInput) => string
}): TemplateAdapter<TInput> {
  return {
    render: async (input) => ({
      html: opts.html(input),
      text: opts.text?.(input),
    }),
  }
}

// Usage
.template(fnTemplate({
  html: ({ name, verifyUrl }) => `<p>Hello ${name}, <a href="${verifyUrl}">verify</a></p>`,
}))
```

**Handlebars** — for users who prefer logic-less templates:

```ts
import Handlebars from 'handlebars';
import type { TemplateAdapter } from '@emailrpc/core/template';

export function handlebarsTemplate<TInput>(source: string): TemplateAdapter<TInput> {
  const compiled = Handlebars.compile(source);
  return {
    render: async (input) => ({ html: compiled(input) }),
  };
}
```

**MJML** — compile-once at module load, render on demand:

```ts
import mjml2html from 'mjml';
import Handlebars from 'handlebars';
import type { TemplateAdapter } from '@emailrpc/core/template';

export function mjmlTemplate<TInput>(source: string): TemplateAdapter<TInput> {
  const { html: compiledHtml, errors } = mjml2html(source);
  if (errors.length > 0) throw new Error(`MJML compilation: ${errors[0].message}`);
  const tmpl = Handlebars.compile(compiledHtml);
  return {
    render: async (input) => ({ html: tmpl(input) }),
  };
}
```

If a user can build these in their own codebase in under 15 lines, core doesn't need to ship them. Future first-party adapters (e.g. `@emailrpc/mjml`, `@emailrpc/jsx-email`) can be added later if there's demand and a clean wrapper to justify a package.

### 5.6 Subjects

Subject resolution stays in core — it's just a string or a function returning a string. No rendering engine needed.

```ts
.subject('Welcome aboard')                                   // static
.subject(({ input }) => `Welcome, ${input.name}!`)           // function
.subject(({ input }) => ({                                   // locale map
  en: `Welcome, ${input.name}!`,
  'pt-BR': `Bem-vindo, ${input.name}!`,
  nl: `Welkom, ${input.name}!`,
}[input.locale]))
```

If an adapter wants to compute the subject from its template (e.g. extract `<title>` from React Email), it can return `subject` in `RenderedOutput` — core will use the adapter's value when present, falling back to the `.subject()` builder otherwise. This is the only optional field beyond `html` and `text` in the adapter's return.

```ts
// optional extension to the interface
render(input: TInput): Promise<{
  html: string
  text?: string
  subject?: string   // adapter may compute subject from the template itself
}>
```

### 5.7 Plain text

Two paths, in order of preference:

1. **Adapter returns `text`.** Best — the adapter knows the template and can produce the highest-quality plain-text version. The React Email adapter does this by re-rendering the same component with `plainText: true`.
2. **Core falls back to `html-to-text`.** If the adapter returns only `html`, core converts it on the way out. `html-to-text` is a small (~50 KB) dependency in core; it covers the common case without forcing every adapter author to implement plain-text generation.

Auto-fallback is on by default. To opt out (e.g. you genuinely want HTML-only mail), configure the sender with `plainTextFallback: false` and core will send messages without a text part.

### 5.8 Attachments and inline images

Attachments are a **transport** concern, not a template concern, so they live on `.send()` args (§6.1) — not in the input schema:

```ts
mail.invoiceReady.send({
  to: customer.email,
  attachments: [
    {
      filename: 'invoice-2026-04.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ],
  input: { customerName, invoiceNumber, total }, // template props only
});
```

Adapters never see attachments — they render HTML/text from `input` and the transport layer attaches files to the outgoing message.

Inline images referenced from the template (via `cid:foo`) are declared on the adapter side. The React Email adapter accepts an optional second argument:

```ts
.template(reactEmail(WelcomeEmail, {
  inlineAssets: {
    logo: { path: './assets/logo.png', contentType: 'image/png' },
  },
}))
```

Custom adapters that need inline assets define their own equivalent — there's no core-level convention beyond the resulting message having a `cid:`-keyed asset map ready for the provider.

### 5.9 Localization

Locale is a regular input field. By convention `locale` (or `lang`) is plumbed through to:

- the `.subject()` resolver (object-map shorthand, see §5.6),
- the template adapter (passed as part of the input),
- the message's `Content-Language` header.

A small helper `t.email().locales(['en', 'pt-BR', 'nl'])` enforces a closed set on the schema and provides type-safe subject maps.

---

## 6. Layer 2 — Sender

```ts
import { createSender } from '@emailrpc/core/sender';
import type { EmailRouter } from './emails';

const mail = createSender<EmailRouter>({
  router: emails, // runtime router
  provider: smtp({ host, port, auth, pool: true }),
  defaults: {
    from: 'hello@guidemi.com',
    replyTo: 'support@guidemi.com',
    headers: { 'X-Mailer': 'emailRpc' },
  },
  queue: bullmq({ connection: { url: process.env.REDIS_URL } }), // optional
  context: ({ requestId }) => ({ requestId }), // optional ctx factory
});
```

### 6.1 Surface

For each route in the router, three callable shapes are exposed. **Transport fields are on the call args; template props live under `input`.**

```ts
mail.welcome.send({
  to: 'lucas@x.com',                       // Address | Address[]   (required)
  cc?: 'team@x.com',                       // Address | Address[]
  bcc?: ['legal@x.com'],                   // Address | Address[]
  replyTo?: 'support+ticket-42@x.com',     // overrides def.replyTo / defaults.replyTo
  headers?: { 'X-Custom': 'yes' },         // merged with defaults.headers (per-send wins)
  attachments?: [{ filename, content, contentType?, cid? }],
  input: { name: 'Lucas', verifyUrl, locale: 'en' },  // validated against the schema
}, { provider?: 'ses' });

mail.welcome.queue({ to, cc?, bcc?, replyTo?, headers?, attachments?, input }, queueOpts?);

mail.welcome.render(input);                                    // returns { html, text?, subject? }
mail.welcome.render(input, { format: 'html' | 'text' });       // returns string
```

Notes on the split:

- **`input` is the schema's domain.** Template adapters receive `input` directly (`render(input)`); the subject resolver receives `{ input }`. Validation runs against `input` only.
- **`to` / `cc` / `bcc` / `replyTo` / `headers` / `attachments` are transport.** They are not validated by the email schema — they accept the raw `Address`, header, and attachment shapes from `@emailrpc/core`.
- **`from` is NOT a per-send arg.** Set it on the contract via `.from(...)` or on the client via `defaults.from`. Per-send `from` is rare enough to defer.
- **`tags` is NOT a per-send arg.** Tags are contract-level metadata so analytics groupings stay stable across sends.
- **`render` only takes `input`.** Rendering doesn't involve a recipient.

Plus a router-level `mail.$send(routeName, args)` for dynamic dispatch (weaker typing — used only when route name is genuinely runtime-determined).

### 6.2 Return types

```ts
type SendResult = {
  messageId: string; // X-EmailRpc-Message-Id (ULID)
  providerMessageId?: string;
  accepted: string[];
  rejected: string[];
  envelope: { from: string; to: string[] };
  timing: { renderMs: number; sendMs: number };
};

type QueueResult = {
  jobId: string;
  enqueuedAt: Date;
  scheduledFor?: Date; // when delay used
};
```

### 6.3 Queue options

The first arg to `.queue()` is the same `SendArgs` shape as `.send()` (§6.1) — `{ to, cc?, bcc?, replyTo?, headers?, attachments?, input }`. The second arg is the queue policy:

```ts
mail.welcome.queue(
  { to: 'lucas@x.com', input: { name: 'Lucas', verifyUrl } },
  {
    delay: '5m' | 30_000, // ms or duration string
    attempts: 5, // retry count
    backoff: { type: 'exponential', delay: 1000 },
    priority: 1, // overrides route default
    jobId: 'welcome-user-123', // for idempotency
    removeOnComplete: { age: 86400 },
  },
);
```

---

## 7. Layer 3 — Providers

### 7.1 Interface

```ts
interface Provider {
  name: string;
  send(message: RenderedMessage, ctx: SendContext): Promise<ProviderResult>;
  verify?(): Promise<{ ok: boolean; details?: unknown }>;
  close?(): Promise<void>;
}

interface RenderedMessage {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  attachments: Attachment[];
  inlineAssets: Record<string, InlineAsset>;
}
```

### 7.2 Built-in providers

**`smtp`** — wraps nodemailer's SMTP transport. Pool by default. DKIM signing supported.

```ts
smtp({
  host: 'smtp.eu.mailgun.org',
  port: 587,
  secure: false, // STARTTLS
  auth: { user, pass },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  dkim: { domainName, keySelector, privateKey }, // optional
});
```

**`ses`** — AWS SES via `@aws-sdk/client-sesv2`. Returns SES message id.

**`resend`** — Resend HTTP API. Useful when you want a hosted relay but the emailRpc abstraction.

**`multi`** — failover or round-robin across providers:

```ts
multi({
  strategy: 'failover', // or 'round-robin' | 'weighted'
  providers: [
    {
      provider: smtp({
        /* primary */
      }),
      weight: 1,
    },
    {
      provider: smtp({
        /* backup */
      }),
      weight: 1,
    },
  ],
  isRetriable: (err) => err.code === 'ETIMEDOUT' || err.responseCode >= 500,
});
```

**`mock`** (in `emailrpc/test`) — in-memory provider that records sends for assertions.

---

## 8. Layer 4 — Middleware

Middleware runs in a chain, oRPC/tRPC-style:

```ts
const t = emailRpc.init<Ctx>()
  .use(loggerMw())                    // global
  .use(eventLoggerMw({ storage }))    // ships events to your observability sink

const passwordReset = t
  .email('passwordReset')
  .use(rateLimitMw({ key: 'recipient', max: 3, window: '1h' }))
  .use(suppressionListMw({ list: suppression }))
  .input(...)
```

### 8.1 Signature

```ts
type Middleware<TInput, TCtx> = (params: {
  input: TInput;
  ctx: TCtx;
  route: string;
  next: (newCtx?: Partial<TCtx>) => Promise<SendResult>;
}) => Promise<SendResult>;
```

Middleware can:

- mutate context (return `next({ ...ctx, requestId })`),
- short-circuit by **not** calling `next()` and returning a synthetic `SendResult` (e.g., suppression list → `{ accepted: [], rejected: [to], reason: 'suppressed' }`),
- wrap `next()` to capture timing, errors, retries.

For purely observational concerns — analytics, audit logs, metrics, alerting — prefer **hooks** (§9). Hooks have a simpler API, can't accidentally break the pipeline, and are typed against the procedure's exact input.

### 8.2 Built-in middleware

| Middleware          | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `loggerMw`          | Structured logs via pino/console                                     |
| `eventLoggerMw`     | Hand send + result to a user-supplied sink (Datadog, Postgres, etc.) |
| `suppressionListMw` | Block sends to bounced/complained addresses                          |
| `rateLimitMw`       | Per-recipient or per-route throttling (Redis-backed)                 |
| `idempotencyMw`     | Dedupe sends by `Idempotency-Key` (Redis)                            |
| `dryRunMw`          | Skip actual send; useful in test envs                                |
| `tracingMw`         | OpenTelemetry spans                                                  |
| `tagInjectMw`       | Inject runtime tags into headers                                     |

---

## 9. Hooks

Hooks are declarative lifecycle callbacks attached to a router or a single email procedure. They cover the four phases of every send — `onBeforeSend`, `onExecute`, `onAfterSend`, `onError` — plus a queue-specific pair (`onEnqueue`, `onDequeue`). Unlike middleware (Layer 4), hooks **cannot mutate the pipeline** — they observe and react. This separation is deliberate: middleware is for behavior that changes the outcome (suppression, rate limiting, retries); hooks are for side effects that respond to it (analytics, notifications, audit logs).

If you've used Hono's hooks, Drizzle's lifecycle callbacks, or oRPC's interceptors, the model is the same.

### 9.1 The four core hooks

| Hook           | Fires                                     | Can mutate input? | Can short-circuit? | Awaited?          |
| -------------- | ----------------------------------------- | ----------------- | ------------------ | ----------------- |
| `onBeforeSend` | After validation, before middleware chain | No                | No                 | Yes               |
| `onExecute`    | Right before `provider.send()`            | No                | No                 | Yes               |
| `onAfterSend`  | After successful send                     | —                 | —                  | Yes (best-effort) |
| `onError`      | On any thrown error in the pipeline       | —                 | No                 | Yes (best-effort) |

"Cannot mutate / cannot short-circuit" is enforced at the type level — hook signatures return `void | Promise<void>`, not `SendResult`. This is the one-line answer to "when do I use middleware vs. a hook?" — if you need to change the outcome, it's middleware; if you need to react to it, it's a hook.

"Awaited" means the send waits for the hook to resolve. "Best-effort" means errors thrown inside `onAfterSend` / `onError` are caught, logged, and **do not** affect the send result — the send already succeeded (or already failed) by the time these run. This matches Drizzle's and Prisma's semantics and avoids the "my analytics call broke prod email" failure mode.

### 9.2 Signatures

```ts
type HookContext<TInput, TCtx> = {
  route: string; // 'welcome', 'passwordReset', etc.
  input: TInput; // validated template props (the schema's domain)
  args: SendArgs<TInput>; // full call args including to/cc/bcc/replyTo/headers/attachments
  ctx: TCtx; // current context
  messageId: string; // assigned at validation time
  attempt: number; // 1 on first try, 2+ on retry
  via: 'direct' | 'queue'; // how the send was triggered
};

type OnBeforeSendHook<TInput, TCtx> = (params: HookContext<TInput, TCtx>) => void | Promise<void>;

type OnExecuteHook<TInput, TCtx> = (
  params: HookContext<TInput, TCtx> & {
    rendered: RenderedMessage; // subject/html/text/headers, see §7.1
  },
) => void | Promise<void>;

type OnAfterSendHook<TInput, TCtx> = (
  params: HookContext<TInput, TCtx> & {
    result: SendResult; // see §6.2
    durationMs: number;
  },
) => void | Promise<void>;

type OnErrorHook<TInput, TCtx> = (
  params: HookContext<TInput, TCtx> & {
    error: EmailRpcError;
    phase: 'validate' | 'middleware' | 'render' | 'send';
    willRetry: boolean;
  },
) => void | Promise<void>;
```

`willRetry` is `true` when the send is queued and the retry policy hasn't been exhausted — useful for distinguishing "transient SMTP timeout, will retry" from "final failure, alert humans".

### 9.3 Router-level hooks

Attached when initializing the router. Apply to **every** procedure in the router.

```ts
const t = emailRpc.init<Ctx>({
  hooks: {
    onBeforeSend: ({ route, input, messageId }) => {
      logger.info('email.before', { route, messageId, to: input.to });
    },
    onAfterSend: async ({ route, result, durationMs, messageId }) => {
      await metrics.histogram('email.send.duration', durationMs, { route });
      await metrics.counter('email.send.success', 1, { route });
    },
    onError: async ({ route, error, phase, willRetry, messageId }) => {
      await metrics.counter('email.send.error', 1, {
        route,
        phase,
        code: error.code,
        retrying: String(willRetry),
      });
      if (!willRetry) {
        await alerting.fire('email-final-failure', { route, messageId, error });
      }
    },
  },
});
```

You can also use the fluent form, which is preferable when hooks need to be added conditionally or composed across multiple files:

```ts
const t = emailRpc
  .init<Ctx>()
  .onBeforeSend(({ route, input }) => {
    /* ... */
  })
  .onAfterSend(({ route, result }) => {
    /* ... */
  })
  .onError(({ error }) => {
    /* ... */
  });
```

### 9.4 Procedure-level hooks

Attached on a single email definition. Apply only to that route. Run **after** all router-level hooks of the same kind.

```ts
const passwordReset = t
  .email('passwordReset')
  .input(passwordResetInput)
  .subject('Reset your password')
  .template(PasswordResetEmail)
  .onBeforeSend(async ({ input, ctx }) => {
    // Audit-log every password reset email (compliance requirement)
    await auditLog.write({
      event: 'password_reset_sent',
      userId: ctx.userId,
      email: input.to,
      timestamp: new Date(),
    });
  })
  .onAfterSend(async ({ input, messageId }) => {
    await db.passwordResetSends.insert({
      email: input.to,
      messageId,
      sentAt: new Date(),
    });
  })
  .onError(async ({ error, willRetry, input }) => {
    if (!willRetry && error.code === 'PROVIDER') {
      // Final delivery failure on a security-critical email — page on-call
      await pager.escalate({
        type: 'password-reset-delivery-failure',
        email: input.to,
        error: error.message,
      });
    }
  });
```

### 9.5 Multiple hooks of the same kind

Both router and procedure level support **multiple** hooks of each kind. They run in registration order, sequentially, awaited:

```ts
t.email('welcome')
  .onAfterSend(trackInAmplitude)
  .onAfterSend(updateOnboardingFunnel)
  .onAfterSend(notifySlackForFirst100Users);
```

If a hook throws, subsequent hooks of the **same kind** still run (best-effort). Errors from hooks are collected and emitted via the same `onError` channel with `phase: 'hook'` so they're observable but don't poison the operation.

### 9.6 Execution order — full lifecycle

Putting it all together, here's the precise order for `mail.welcome(input)`:

```
1. Schema validation (input → parsed)             [throws → onError(phase: 'validate')]
2. Context built
3. Router  onBeforeSend hooks  (in order)
4. Procedure onBeforeSend hooks (in order)
5. Middleware chain entered (global → procedure)  [throws → onError(phase: 'middleware')]
6. Template render                                [throws → onError(phase: 'render')]
7. Router  onExecute hooks
8. Procedure onExecute hooks
9. provider.send()                                [throws → onError(phase: 'send')]
10. Middleware chain unwinds
11. Procedure onAfterSend hooks (in order)
12. Router  onAfterSend hooks
13. SendResult returned
```

For queued sends (`mail.welcome.queue(input)`), steps 1–4 run at enqueue time on the producer, then 5–13 run on the worker at pickup. The `via` field on `HookContext` is `'direct'` for steps 1–4 in the immediate path, `'queue'` for the producer-side enqueue path, and `'queue'` again on the worker — letting hooks distinguish "user clicked submit" from "background job retrying".

### 9.7 Queue-specific hooks

Two extra hooks fire only on the queued path:

```ts
type OnEnqueueHook<TInput, TCtx> = (
  params: HookContext<TInput, TCtx> & {
    jobId: string;
    scheduledFor?: Date; // when delay was used
    queueOptions: QueueOptions;
  },
) => void | Promise<void>;

type OnDequeueHook<TInput, TCtx> = (
  params: HookContext<TInput, TCtx> & {
    jobId: string;
    enqueuedAt: Date;
    queueLatencyMs: number; // how long it sat in queue
  },
) => void | Promise<void>;
```

`onEnqueue` fires on the **producer** after a job is accepted by the queue. `onDequeue` fires on the **worker** when a job is picked up, before the rest of the lifecycle runs. They're useful for queue-depth metrics and for tracing distributed flows (correlating producer-side request ID to worker-side execution).

### 9.8 Hooks vs. middleware — decision guide

| If you want to…                              | Use                                    |
| -------------------------------------------- | -------------------------------------- |
| Block a send based on input or recipient     | Middleware                             |
| Modify context for downstream code           | Middleware                             |
| Wrap timing / retries / fallback logic       | Middleware                             |
| Log that a send happened                     | Hook (`onAfterSend`)                   |
| Emit metrics, traces, analytics events       | Hook                                   |
| Insert a row into your DB after a send       | Hook (`onAfterSend`)                   |
| Page on-call when delivery permanently fails | Hook (`onError` with `!willRetry`)     |
| Audit-log a security-sensitive email         | Hook (`onBeforeSend` or `onAfterSend`) |
| Run a custom queue priority strategy         | Middleware                             |
| Notify Slack on a specific failure pattern   | Hook (`onError`)                       |

Rule of thumb: **if removing the hook would change whether the email goes out, it shouldn't be a hook**.

### 9.9 Type inference

Hooks are fully typed against the procedure's input. On a router-level hook, `input` is typed as the union of all routes' inputs, narrowable by `route`:

```ts
.onAfterSend(({ route, input }) => {
  if (route === 'welcome') {
    input.name   // ✓ typed as string
    input.verifyUrl  // ✓
  }
  if (route === 'passwordReset') {
    input.resetUrl  // ✓
  }
})
```

On a procedure-level hook, `input` is typed exactly as that procedure's parsed input — no narrowing required.

### 9.10 Testing hooks

`emailrpc/test` exposes a hook recorder for assertion-based testing:

```ts
import { createTestSender, recordHooks } from '@emailrpc/core/test';

const hooks = recordHooks();
const mail = createTestSender({ router: emails, provider: mockProvider(), hooks });

await mail.welcome({ to: 'lucas@x.com', name: 'Lucas', verifyUrl: '...', locale: 'en' });

expect(hooks.calls).toEqual([
  { name: 'onBeforeSend', route: 'welcome', input: expect.any(Object) },
  { name: 'onExecute', route: 'welcome', rendered: expect.any(Object) },
  { name: 'onAfterSend', route: 'welcome', result: expect.any(Object) },
]);
```

This makes hooks first-class in tests rather than something you mock around.

---

## 10. Layer 5 — Queue & worker

### 10.1 Queue adapter interface

```ts
interface QueueAdapter {
  enqueue(job: EmailJob, opts: QueueOptions): Promise<{ jobId: string }>;
  process(handler: (job: EmailJob) => Promise<SendResult>): Worker;
  getStats(): Promise<QueueStats>;
  // plus introspection: list jobs, retry, drain DLQ
}
```

### 10.2 BullMQ adapter (default)

```ts
import { bullmq } from '@emailrpc/bullmq';

const queue = bullmq({
  connection: { url: process.env.REDIS_URL },
  prefix: 'emailrpc',
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});
```

### 10.3 pg-boss adapter

For teams without Redis, pg-boss gives durable Postgres-backed queueing with similar semantics. Recommended when you already have Postgres and don't want a second datastore (small/medium projects, GuideMi-scale).

### 10.4 Worker

```ts
import { createWorker } from '@emailrpc/core/worker';
import { emails } from './emails';

const worker = createWorker({
  router: emails, // typed
  provider: smtp({
    /* same config as sender */
  }),
  queue: bullmq({ connection: { url: REDIS_URL } }),
  concurrency: 10,
  context: ({ job }) => ({ jobId: job.id, attempt: job.attemptsMade }),
});

worker.on('completed', (job, result) => {
  /* ... */
});
worker.on('failed', (job, err) => {
  /* ... */
});

await worker.start();
process.on('SIGTERM', () => worker.close());
```

The worker validates job payloads against the route's input schema on pickup. If a job was enqueued with stale schema and now fails validation, it goes to the DLQ with a structured error.

### 10.5 Job shape on the wire

```jsonc
{
  "v": 1,
  "route": "welcome",
  "input": {
    /* validated input */
  },
  "context": {
    /* serializable context */
  },
  "meta": {
    "enqueuedAt": "2026-04-25T12:00:00Z",
    "messageId": "01HQ...",
    "tenantId": "...",
  },
}
```

Schema-versioned (`v`) so we can evolve the wire format without breaking in-flight jobs.

### 10.6 Dead-letter queue

Failures after `attempts` exhaustion go to a DLQ. The queue adapter exposes inspection, manual retry, and bulk actions via its API; visualization is left to the consuming app or to a future enterprise tier.

---

## 11. Layer 6 — Webhook router

Most providers can POST inbound events (bounces, complaints, opens, clicks, deliveries). emailRpc provides a typed router for these.

### 11.1 Definition

```ts
import { z } from 'zod';

const webhooks = t.webhookRouter({
  bounced: t
    .webhook()
    .input(
      z.object({
        recipient: z.email(),
        type: z.enum(['hard', 'soft']),
        reason: z.string(),
        messageId: z.string(),
        timestamp: z.iso.datetime(),
      }),
    )
    .handler(async ({ input, ctx }) => {
      if (input.type === 'hard') {
        await suppression.add(input.recipient, { reason: 'bounce' });
      }
      await events.record({ kind: 'bounced', ...input });
    }),

  complained: t
    .webhook()
    .input(ComplaintSchema)
    .handler(async ({ input }) => {
      await suppression.add(input.recipient, { reason: 'complaint' });
    }),

  delivered: t
    .webhook()
    .input(DeliveredSchema)
    .handler(async ({ input }) => events.record({ kind: 'delivered', ...input })),

  opened: t.webhook().input(OpenedSchema).handler(/*...*/),
  clicked: t.webhook().input(ClickedSchema).handler(/*...*/),
});
```

### 11.2 Mounting

```ts
import { toNodeHandler, toFetchHandler } from '@emailrpc/core/webhook';
import { sesAdapter } from '@emailrpc/ses';

// Express / Node http
app.post(
  '/webhooks/email',
  toNodeHandler(webhooks, {
    adapter: sesAdapter({ verifySnsSignature: true }),
  }),
);

// Hono / Bun / Cloudflare Workers
app.post('/webhooks/email', toFetchHandler(webhooks, { adapter: sesAdapter() }));
```

The **adapter** translates raw provider payloads into the canonical event shape that matches your webhook router's schemas. SES, SendGrid, Postmark, Resend, Mailgun adapters ship in their respective provider packages.

### 11.3 Signature verification

Each adapter handles signature verification (SNS for SES, HMAC for SendGrid, etc.). Failed verification returns 401 before any handler runs.

---

---

## 12. CLI

the `emailrpc` binary (shipped from core) provides:

```sh
emailrpc dev               # Watch templates + serve previews on localhost
emailrpc preview welcome   # Open browser preview of a single route
emailrpc send welcome --to me@x.com --name Lucas --verifyUrl ...   # Ad-hoc send
emailrpc check             # Static-check all routes (subject/template/variable refs)
emailrpc migrate           # Run storage migrations
emailrpc worker            # Start a worker process (alternative to embedding)
```

The `check` command is the one to wire into CI — it catches MJML/Handlebars variable typos, schema drift, and missing fixtures.

---

## 13. Configuration

A single config file at the project root, optional but recommended:

```ts
// emailrpc.config.ts
import { defineConfig } from '@emailrpc/core/config';

export default defineConfig({
  router: './src/emails/index.ts',
  provider: './src/email/provider.ts',
  storage: './src/email/storage.ts',
  templates: {
    engine: 'react', // affects how `emailrpc dev` watches files
    dir: './src/emails/templates',
  },
  reports: {
    auth: './src/email/reports-auth.ts',
  },
});
```

The CLI reads this file. The runtime does **not** require it — you can wire everything by hand.

---

## 14. Errors

Every error is a subclass of `EmailRpcError`:

```ts
class EmailRpcError extends Error {
  code: string; // 'VALIDATION' | 'PROVIDER' | 'TIMEOUT' | ...
  route?: string;
  messageId?: string;
  cause?: unknown;
}

class EmailRpcValidationError extends EmailRpcError {
  issues: StandardSchemaIssue[];
}
class EmailRpcProviderError extends EmailRpcError {
  providerName: string;
  retriable: boolean;
}
class EmailRpcTimeoutError extends EmailRpcError {
  phase: 'render' | 'send';
}
class EmailRpcRenderError extends EmailRpcError {
  template: string;
}
class EmailRpcSuppressedError extends EmailRpcError {
  recipient: string;
  reason: string;
}
```

Errors are JSON-serializable for queue persistence and downstream observability.

---

## 15. Observability

- **Structured logs** via pino (or any logger via the `loggerMw`).
- **Metrics**: counters and histograms are exposed via the hooks API (§9). A Prometheus-shaped helper ships in `@emailrpc/core/middleware`. Counters for sends/failures by route + provider, histograms for render and send latency.
- **Tracing**: OpenTelemetry middleware emits spans for `validate`, `render`, `provider.send`, plus webhook handler spans.

---

## 16. Testing utilities

`emailrpc/test` provides:

```ts
import { mockProvider, createTestSender } from '@emailrpc/core/test';

const provider = mockProvider();
const mail = createTestSender({ router: emails, provider });

await mail.welcome({ to: 'lucas@x.com', name: 'Lucas', verifyUrl: '...', locale: 'en' });

expect(provider.sent).toHaveLength(1);
expect(provider.sent[0]).toMatchObject({
  route: 'welcome',
  to: ['lucas@x.com'],
  subject: 'Welcome, Lucas!',
});
expect(provider.sent[0].html).toContain('https://...');
```

Plus snapshot helpers for HTML output and a `createWorkerHarness` for testing queue flows in-process.

---

## 17. Security

- **Schema validation at every boundary** — sender, queue worker pickup, webhook ingress. No untyped input ever reaches the renderer.
- **HTML sanitization** of any user-provided HTML fragments (DOMPurify on render in the React Email adapter; opt-in for Handlebars).
- **Webhook signature verification** required by default in every adapter; opt-out is explicit.
- **Suppression list is enforced** by middleware before render — bounced addresses cannot be re-sent to without an explicit override.
- **Secrets** (SMTP passwords, API keys) are never logged or persisted to the event store. Provider config redaction is enforced on the type level (`Redacted<string>`).
- **Rate limits** on webhook endpoints prevent provider-spoofing replay attacks.

---

## 18. Versioning & deprecation

- **Public API stability**: anything exported from `emailrpc` (Layers 1–2) follows semver strictly from v1.0.
- **Adapter packages** are versioned independently and pinned to a core peer-dep range.
- **Wire format** for queue jobs is versioned (`v: 1`); the worker accepts the current and previous version.
- **Storage migrations** are forward-only, tracked via a `_emailrpc_migrations` table.

---

## 19. Roadmap

Releases are coordinated across the three packages. Versions in parentheses indicate which packages ship each milestone.

**v0.1 (alpha)** — `emailrpc` only. Layers 1–4: contracts, sender, hooks, middleware, SMTP provider, MJML + Handlebars templates. No queue, no production package yet.

**v0.2 (beta)** — `emailrpc` + `@emailrpc/react-email`. Layer 5 (in-memory queue + worker), `emailrpc/test`, CLI dev/preview commands. React Email adapter ships.

**v0.3** — the relevant adapter package (`@emailrpc/bullmq`, `@emailrpc/ses`, etc.) debuts. Layer 6 (webhook router with SES/Resend signature verifiers), BullMQ queue, SES & Resend providers.

**v0.4** — `@emailrpc/mjml` and `@emailrpc/handlebars` adapter packages. Hardening, more provider sig verifiers, OpenTelemetry middleware in core.

**v1.0** — pg-boss adapter (in production package), OpenTelemetry, ClickHouse storage, full docs site, semver freeze across all three packages.

**Post-v1** — Marketing primitives (segments, drip flows) as a separate `@emailrpc/marketing` package. Inbound parsing (a separate `@emailrpc/inbound` package). These stay outside the three core packages because their dependency footprint and audience are different.

---

## 20. Open questions

These are deliberate decisions to make before implementation starts:

1. **Schema evolution for queued jobs.** When a route's input schema changes while jobs are in flight, do we (a) reject on validation failure and DLQ, (b) attempt a registered "migration" function, or (c) version routes themselves (`welcome@v1`, `welcome@v2`)? Current lean: (a) for v1, (c) post-v1.

2. **Multi-tenancy.** Is tenant a first-class concept in the router, or just context that middleware partitions by? Current lean: context-only; ship a tenant-aware suppression list adapter rather than baking tenancy into the core.

3. **Batch sends.** `mail.welcome.batch([input1, input2, ...])` — provider-batched where supported (SES, Resend), per-message otherwise? Yes, but defer to v0.3.

4. **i18n strategy.** Locale as input field (current proposal) vs. a dedicated `.locale()` builder method that wires into a translations store. Lean: input field for v1, dedicated mechanism if real-world usage shows the input-field approach is too verbose.

5. **Hot reload of templates in dev.** Watch + recompile, or require restart? Lean: watch via Vite middleware in `emailrpc dev`.

---

## 21. Example — full GuideMi flow

A concrete end-to-end example showing what adoption looks like:

```ts
// src/emails/index.ts
import { emailRpc } from '@emailrpc/core';
import { z } from 'zod';
import { OrderConfirmation } from './templates/order-confirmation';
import { GuideDelivery } from './templates/guide-delivery';

const t = emailRpc.init<{ orderId?: string }>({
  hooks: {
    // Router-level: every email gets these
    onAfterSend: async ({ route, result, durationMs, messageId }) => {
      await analytics.track('email.sent', { route, messageId, durationMs });
    },
    onError: async ({ route, error, willRetry, messageId, args }) => {
      logger.error('email.failed', { route, messageId, code: error.code, willRetry });
      if (!willRetry) {
        await slack.notify('#ops-alerts', `❌ Final email failure: ${route} → ${args.to}`);
      }
    },
  },
});

const orderConfirmation = t
  .email()
  .input(
    z.object({
      customerName: z.string(),
      orderId: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          price: z.number(),
        }),
      ),
      total: z.number(),
      locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
    }),
  )
  .subject(
    ({ input }) =>
      ({
        'pt-BR': `Pedido confirmado #${input.orderId}`,
        en: `Order confirmed #${input.orderId}`,
      })[input.locale],
  )
  .template(OrderConfirmation)
  .tags({ category: 'transactional', flow: 'checkout' })
  .onAfterSend(async ({ input, messageId }) => {
    await db.orderEmails.insert({
      orderId: input.orderId,
      messageId,
      sentAt: new Date(),
    });
  });

const guideDelivery = t
  .email()
  .input(
    z.object({
      customerName: z.string(),
      guideUrl: z.url(),
      guideName: z.literal('Mapa Amsterdam'),
      locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
    }),
  )
  .subject(
    ({ input }) =>
      ({
        'pt-BR': `Seu ${input.guideName} chegou! 🗺️`,
        en: `Your ${input.guideName} is ready! 🗺️`,
      })[input.locale],
  )
  .template(GuideDelivery)
  .priority('high')
  .tags({ category: 'transactional', flow: 'fulfillment' })
  .onError(async ({ error, willRetry, args }) => {
    if (!willRetry) {
      await pager.escalate({
        type: 'guide-delivery-failure',
        customer: args.to,
        error: error.message,
      });
    }
  });

export const emails = t.router({ orderConfirmation, guideDelivery });
export type EmailRouter = typeof emails;
```

```ts
// src/email/sender.ts
import { createSender } from '@emailrpc/core/sender';
import { smtp } from '@emailrpc/core/provider';
import { bullmq } from '@emailrpc/bullmq';
import { emails } from '../emails';

export const mail = createSender({
  router: emails,
  provider: smtp({
    host: process.env.SMTP_HOST!,
    port: 587,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    pool: true,
  }),
  defaults: { from: 'GuideMi <ola@guidemi.com>' },
  queue: bullmq({ connection: { url: process.env.REDIS_URL! } }),
});
```

```ts
// In a WooCommerce webhook handler
import { mail } from '../email/sender';

export async function onOrderPaid(order: WooOrder) {
  await mail.orderConfirmation.queue({
    to: order.billing.email,
    input: {
      customerName: `${order.billing.first_name} ${order.billing.last_name}`,
      orderId: String(order.id),
      items: order.line_items.map((i) => ({ name: i.name, price: Number(i.total) })),
      total: Number(order.total),
      locale: order.meta.locale === 'en' ? 'en' : 'pt-BR',
    },
  });

  await mail.guideDelivery.queue(
    {
      to: order.billing.email,
      input: {
        customerName: order.billing.first_name,
        guideUrl: await generateSignedUrl(order),
        guideName: 'Mapa Amsterdam',
        locale: order.meta.locale === 'en' ? 'en' : 'pt-BR',
      },
    },
    { delay: '30s' },
  ); // small delay so confirmation lands first
}
```

That's the full surface area for a real product flow: typed contracts, templates that share the schema, a typed sender, queue with delay, and hooks for analytics and ops alerting.

---

_End of spec._
