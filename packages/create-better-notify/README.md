# create-better-notify

Scaffold a [Better Notify](https://github.com/better-notify/better-notify) project with your preferred framework and RPC layer. One command gives you a working server with typed notifications, OpenAPI playground, and email templates ready to go.

## Usage

```sh
# npm
npx create-better-notify

# pnpm
pnpm create better-notify

# yarn
yarn create better-notify

# bun
bun create better-notify
```

The CLI walks you through project name, framework, RPC layer, and package manager — then scaffolds, installs dependencies, and prints next steps.

### Non-interactive

Pass flags to skip the prompts:

```sh
npx create-better-notify my-app --framework hono --rpc orpc --pm pnpm
```

| Flag          | Values                       | Default       |
| ------------- | ---------------------------- | ------------- |
| `--framework` | `hono`                       | prompted      |
| `--rpc`       | `orpc`                       | prompted      |
| `--pm`        | `npm`, `pnpm`, `yarn`, `bun` | auto-detected |

## What you get

The scaffolded project includes:

- **HTTP server** — Hono with RPC and OpenAPI handlers
- **OpenAPI playground** — browse and test your API at `/api/docs`
- **Typed notifications** — a working `welcome` email using Better Notify's typed pipeline
- **React Email template** — a responsive, Tailwind-styled verification email
- **Multi-transport** — SMTP primary + Resend fallback, configured via `.env`
- **Dev mode** — `npm run dev` starts a watching server with hot reload

### Project structure

```
my-app/
  src/
    server.ts       # Hono app with RPC + OpenAPI routes
    rpc.ts          # oRPC router with a sendWelcome procedure
    notify.ts       # Better Notify catalog, client, and transport setup
    emails/
      welcome.tsx   # React Email template
  .env.example      # SMTP and Resend credentials
  package.json
  tsconfig.json
```

### Environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```sh
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

RESEND_API_KEY=

FROM_NAME=My App
FROM_EMAIL=hello@example.com
PORT=3000
```

## Running the project

```sh
cd my-app
npm run dev     # starts tsx --watch on src/server.ts
```

Open [http://localhost:3000/api/docs](http://localhost:3000/api/docs) to explore the API playground.

## Templates

| Template    | Framework | RPC  | Status    |
| ----------- | --------- | ---- | --------- |
| `hono-orpc` | Hono      | oRPC | Available |

More templates are on the roadmap.

## Requirements

- Node.js >= 22

## License

MIT
