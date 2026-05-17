import { createNotify, createClient, consoleLogger } from '@betternotify/core';
import { emailChannel, mockTransport } from '@betternotify/email';
import { createMcpServer } from '@betternotify/mcp';
import { z } from 'zod';

const email = emailChannel({
  defaults: { from: { name: 'My App', email: 'noreply@example.com' } },
});

const rpc = createNotify({ channels: { email } });

const catalog = rpc.catalog({
  transactional: rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string(), email: z.string().email() }))
      .subject(({ input }) => `Welcome, ${input.name}!`)
      .template({
        render: async ({ input }) => ({
          html: `<h1>Welcome, ${input.name}!</h1><p>Your account is ready.</p>`,
          text: `Welcome, ${input.name}! Your account is ready.`,
        }),
      }),
    resetPassword: rpc
      .email()
      .input(z.object({ email: z.string().email(), resetUrl: z.string().url() }))
      .subject('Reset your password')
      .template({
        render: async ({ input }) => ({
          html: `<p>Click <a href="${input.resetUrl}">here</a> to reset your password.</p>`,
          text: `Reset your password: ${input.resetUrl}`,
        }),
      }),
  }),
  marketing: rpc.catalog({
    newsletter: rpc
      .email()
      .input(z.object({ subject: z.string(), body: z.string() }))
      .subject(({ input }) => input.subject)
      .template({
        render: async ({ input }) => ({
          html: `<div>${input.body}</div>`,
          text: input.body,
        }),
      }),
  }),
});

const mcp = createMcpServer({
  catalog,
  name: 'betternotify-example',
  version: '1.0.0',
  expose: ['transactional.**'],
});

const mail = createClient({
  catalog,
  transportsByChannel: { email: mockTransport() },
  plugins: [mcp.plugin()],
  logger: consoleLogger({ level: 'debug' }),
});

mcp.connect(mail);

const transport = process.argv[2] === '--http' ? 'http' : 'stdio';

if (transport === 'http') {
  const port = Number(process.env.PORT) || 3100;
  await mcp.start({ type: 'http', port });

  process.stderr.write(`MCP server listening on http://localhost:${port}/mcp\n`);
  process.stderr.write(`Routes exposed: transactional.welcome, transactional.resetPassword\n`);
  process.stderr.write(`Marketing routes filtered out by expose: ['transactional.**']\n`);
} else {
  await mcp.start({ type: 'stdio' });
}
