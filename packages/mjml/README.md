# @betternotify/mjml

MJML + Handlebars template adapter for [Better-Notify](../core).

Compiles [MJML](https://mjml.io) markup to responsive HTML at creation time, then resolves `{{variable}}` placeholders via Handlebars on each render call.

## Install

```sh
pnpm add @betternotify/mjml @betternotify/core mjml handlebars
```

## Usage

```ts
import { z } from 'zod';
import { createNotify } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { mjmlTemplate } from '@betternotify/mjml';

const email = emailChannel();
const rpc = createNotify<{ email: typeof email }>({ channels: { email } });

export const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), code: z.string() }))
    .template(mjmlTemplate(`
      <mjml>
        <mj-body>
          <mj-section>
            <mj-column>
              <mj-text font-size="20px">Hello {{name}}</mj-text>
              <mj-text>Your verification code: {{code}}</mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `, {
      subject: 'Welcome, {{name}}!',
      text: 'Hello {{name}}. Your code: {{code}}',
    })),
});
```

## API

### `mjmlTemplate(source, opts?)`

| Arg            | Type                                      | Notes                                                                     |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `source`       | `string`                                  | MJML markup with optional `{{}}` placeholders. Compiled eagerly.          |
| `opts.text`    | `string`                                  | Handlebars template for the plain-text alternative.                       |
| `opts.subject` | `string`                                  | Handlebars template for the subject line.                                 |
| `opts.helpers` | `Record<string, Handlebars.HelperDelegate>` | Custom Handlebars helpers available in all templates.                     |
| `opts.partials`| `Record<string, string>`                  | Named partials available via `{{> partialName}}`.                         |
| `opts.mjml`    | `MjmlOptions`                             | Options passed to `mjml2html` (validation level, beautify, minify, etc.). |

Returns a `TemplateAdapter<TInput>`. Two-phase rendering:

1. **Creation** -- MJML compiles to responsive HTML tables. `{{}}` placeholders survive as literal text in the output.
2. **Render** -- Handlebars resolves placeholders against `input`. Fast, since MJML compilation already happened.

## Features

- MJML compilation happens once at startup, not per-send
- Full Handlebars syntax in MJML markup: `{{#each}}`, `{{#if}}`, `{{> partial}}`
- Throws on MJML validation errors by default (set `mjml.validationLevel: 'skip'` to opt out)
- Isolated Handlebars instance per adapter
- Subject and text templates share the same helpers and partials

## Node.js only

MJML requires a Node.js runtime (it depends on `htmlnano`, `cheerio`, etc.). For Cloudflare Workers or edge runtimes, use `@betternotify/react-email` or `@betternotify/handlebars` instead.
