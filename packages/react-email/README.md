# @betternotify/react-email

React Email render helper for [BetterNotify](../core).

## Install

```sh
pnpm add @betternotify/react-email @betternotify/core react react-email
```

## Usage

```tsx
/** @jsxImportSource react */
import { z } from 'zod';
import { createNotify } from '@betternotify/core';
import { emailChannel } from '@betternotify/email';
import { reactEmail } from '@betternotify/react-email';
import { Body, Html } from 'react-email';

const Welcome = ({ name, link }: { name: string; link: string }) => (
  <Html>
    <Body>
      <h1>Hi {name}</h1>
      <a href={link}>Verify your email</a>
    </Body>
  </Html>
);

const email = emailChannel();
const rpc = createNotify<{ email: typeof email }, { baseUrl: string }>({ channels: { email } });

export const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string(), token: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}!`)
    .template(({ input, ctx }) =>
      reactEmail(Welcome, {
        name: input.name,
        link: `${ctx.baseUrl}/verify?t=${input.token}`,
      }),
    ),
});
```

`input` and `ctx` are fully typed with zero explicit generics — `.template()` is a builder method, so its callback receives the route's validated input shape and the catalog's `Ctx`.

## API

### `reactEmail(Component, props, opts?)`

| Arg              | Type                              | Notes                                                                                  |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `Component`      | `(props: TProps) => ReactElement` | Your React Email component.                                                            |
| `props`          | `TProps`                          | Already-resolved props. Type-checked against `Component`.                              |
| `opts.plainText` | `boolean` (default `false`)       | When `true`, also produces a plain-text alternative via `react-email`'s `toPlainText`. |
| `opts.pretty`    | `boolean` (default `false`)       | When `true`, formats the rendered HTML with indentation/newlines.                      |

Returns `Promise<RenderedOutput>` (`{ html, text? }`) ready to return from your `.template()` callback.

## Why props instead of a mapper?

`.template()` itself is the inference site — it gives the lambda fully-typed `{ input, ctx }`. Inside the lambda you compute props however you want (rename, format dates, build URLs) and hand them to `reactEmail`. No factory, no schema duplication, no explicit generics.

## JSX setup

Templates are `.tsx` files. Add `/** @jsxImportSource react */` at the top of each, or set `"jsx": "react-jsx"` in your tsconfig. With the new automatic JSX runtime, you don't need `import React`.
