# @betternotify/handlebars

Handlebars template adapter for [Better-Notify](../core).

## Install

```sh
pnpm add @betternotify/handlebars @betternotify/core handlebars
```

## Usage

```ts
import { z } from 'zod';
import { createNotify } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { handlebarsTemplate } from '@betternotify/handlebars';

const email = emailChannel();
const rpc = createNotify<{ email: typeof email }>({ channels: { email } });

export const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), items: z.array(z.string()) }))
    .template(
      handlebarsTemplate(
        `
      <h1>Hello {{name}}</h1>
      <ul>
        {{#each items}}<li>{{this}}</li>{{/each}}
      </ul>
    `,
        {
          subject: 'Welcome, {{name}}!',
          text: 'Hello {{name}}. Items: {{#each items}}{{this}} {{/each}}',
        },
      ),
    ),
});
```

## API

### `handlebarsTemplate(source, opts?)`

| Arg             | Type                                        | Notes                                                   |
| --------------- | ------------------------------------------- | ------------------------------------------------------- |
| `source`        | `string`                                    | Handlebars HTML template. Compiled eagerly at creation. |
| `opts.text`     | `string`                                    | Handlebars template for the plain-text alternative.     |
| `opts.subject`  | `string`                                    | Handlebars template for the subject line.               |
| `opts.helpers`  | `Record<string, Handlebars.HelperDelegate>` | Custom Handlebars helpers available in all templates.   |
| `opts.partials` | `Record<string, string>`                    | Named partials available via `{{> partialName}}`.       |

Returns a `TemplateAdapter<TInput>`. Each `render({ input })` call executes the pre-compiled template with `input` as the Handlebars data context.

## Features

- Full Handlebars syntax: `{{#each}}`, `{{#if}}`, `{{#unless}}`, `{{> partial}}`, `{{helper arg}}`
- Pre-compiled at creation time for fast renders
- Isolated instance per adapter (helpers/partials don't leak between templates)
- Subject and text templates share the same helpers and partials
