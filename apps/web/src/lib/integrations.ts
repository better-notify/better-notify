export type Integration = {
  slug: string;
  name: string;
  channel: string;
  channelLabel: string;
  tagline: string;
  description: string;
  package: string;
  importStatement: string;
  installCmd: string;
  codeExample: string;
  features: string[];
  docsPath: string;
  related: string[];
};

export const integrations: Integration[] = [
  {
    slug: 'smtp',
    name: 'SMTP',
    channel: 'email',
    channelLabel: 'Email',
    tagline: 'Send email through any SMTP server with Better-Notify',
    description:
      'Connect Better-Notify to any SMTP-compatible mail server — Gmail, Amazon SES, Postfix, or your own. Backed by Nodemailer with connection pooling, DKIM signing, and automatic error classification.',
    package: '@betternotify/smtp',
    importStatement: "import { smtpTransport } from '@betternotify/smtp';",
    installCmd: 'pnpm add @betternotify/smtp',
    codeExample: `import { createClient } from '@betternotify/core';
import { smtpTransport } from '@betternotify/smtp';

const mail = createClient({
  catalog,
  transportsByChannel: {
    email: smtpTransport({
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'user', pass: 'pass' },
    }),
  },
});

await mail.welcome.send({ to: 'user@example.com', input: { name: 'Alice' } });`,
    features: [
      'Works with any SMTP server',
      'Connection pooling for high throughput',
      'DKIM signing support',
      'TLS/STARTTLS encryption',
      'Automatic error classification',
    ],
    docsPath: '/docs/transports/smtp',
    related: ['resend', 'cloudflare-email', 'mailchimp'],
  },
  {
    slug: 'resend',
    name: 'Resend',
    channel: 'email',
    channelLabel: 'Email',
    tagline: 'Send email with Resend and Better-Notify',
    description:
      "Deliver transactional and marketing email through Resend's modern API. Better-Notify handles validation, rendering, and middleware — Resend handles delivery.",
    package: '@betternotify/resend',
    importStatement: "import { resendTransport } from '@betternotify/resend';",
    installCmd: 'pnpm add @betternotify/resend',
    codeExample: `import { createClient } from '@betternotify/core';
import { resendTransport } from '@betternotify/resend';

const mail = createClient({
  catalog,
  transportsByChannel: {
    email: resendTransport({ apiKey: process.env.RESEND_API_KEY }),
  },
});

await mail.welcome.send({ to: 'user@example.com', input: { name: 'Alice' } });`,
    features: [
      'Simple API key authentication',
      'Tags and custom headers',
      'Attachments and inline images',
      'CC/BCC support',
      'Automatic HTTP error classification',
    ],
    docsPath: '/docs/transports/resend',
    related: ['smtp', 'cloudflare-email', 'mailchimp'],
  },
  {
    slug: 'cloudflare-email',
    name: 'Cloudflare Email',
    channel: 'email',
    channelLabel: 'Email',
    tagline: 'Send email with Cloudflare Email Routing and Better-Notify',
    description:
      "Use Cloudflare's Email Routing Service to send transactional email at the edge. No SMTP servers to manage — just an API token and your Cloudflare account.",
    package: '@betternotify/cloudflare-email',
    importStatement: "import { cloudflareEmailTransport } from '@betternotify/cloudflare-email';",
    installCmd: 'pnpm add @betternotify/cloudflare-email',
    codeExample: `import { createClient } from '@betternotify/core';
import { cloudflareEmailTransport } from '@betternotify/cloudflare-email';

const mail = createClient({
  catalog,
  transportsByChannel: {
    email: cloudflareEmailTransport({
      accountId: process.env.CF_ACCOUNT_ID,
      apiToken: process.env.CF_API_TOKEN,
    }),
  },
});

await mail.welcome.send({ to: 'user@example.com', input: { name: 'Alice' } });`,
    features: [
      'Edge-native email delivery',
      'No SMTP infrastructure needed',
      'Cloudflare API token auth',
      'Attachments and CC/BCC',
      'Comprehensive error code mapping',
    ],
    docsPath: '/docs/transports/cloudflare-email',
    related: ['smtp', 'resend', 'mailchimp'],
  },
  {
    slug: 'mailchimp',
    name: 'Mailchimp',
    channel: 'email',
    channelLabel: 'Email',
    tagline: 'Send transactional email with Mailchimp Mandrill and Better-Notify',
    description:
      "Deliver transactional email through Mailchimp's Mandrill API. Ideal if you already use Mailchimp for marketing — add typed transactional email without switching providers.",
    package: '@betternotify/mailchimp',
    importStatement: "import { mailchimpTransport } from '@betternotify/mailchimp';",
    installCmd: 'pnpm add @betternotify/mailchimp',
    codeExample: `import { createClient } from '@betternotify/core';
import { mailchimpTransport } from '@betternotify/mailchimp';

const mail = createClient({
  catalog,
  transportsByChannel: {
    email: mailchimpTransport({ apiKey: process.env.MANDRILL_API_KEY }),
  },
});

await mail.welcome.send({ to: 'user@example.com', input: { name: 'Alice' } });`,
    features: [
      'Mandrill transactional API',
      'Inline images and tags',
      'Attachments and CC/BCC',
      'Rate limit detection',
      'Auth and config error classification',
    ],
    docsPath: '/docs/transports/mailchimp',
    related: ['resend', 'smtp', 'cloudflare-email'],
  },
  {
    slug: 'twilio',
    name: 'Twilio',
    channel: 'sms',
    channelLabel: 'SMS',
    tagline: 'Send SMS with Twilio and Better-Notify',
    description:
      'Send typed SMS notifications through Twilio. Better-Notify validates input, runs middleware, and hands off a clean message — Twilio delivers it.',
    package: '@betternotify/twilio',
    importStatement: "import { twilioSmsTransport } from '@betternotify/twilio';",
    installCmd: 'pnpm add @betternotify/twilio',
    codeExample: `import { createClient } from '@betternotify/core';
import { twilioSmsTransport } from '@betternotify/twilio';

const mail = createClient({
  catalog,
  transportsByChannel: {
    sms: twilioSmsTransport({
      accountSid: process.env.TWILIO_SID,
      authToken: process.env.TWILIO_TOKEN,
      fromNumber: '+15551234567',
    }),
  },
});

await mail.verification.send({ to: '+15559876543', input: { code: '123456' } });`,
    features: [
      'Twilio Messaging API',
      'Messaging Service SID support',
      'Comprehensive error code mapping',
      'Rate limit detection',
      'Flexible sender configuration',
    ],
    docsPath: '/docs/transports/twilio',
    related: ['slack', 'telegram', 'discord'],
  },
  {
    slug: 'slack',
    name: 'Slack',
    channel: 'slack',
    channelLabel: 'Slack',
    tagline: 'Send Slack notifications with Better-Notify',
    description:
      'Post typed notifications to Slack channels using the Bot API. Supports Block Kit, file uploads, and threading — all type-safe from your catalog.',
    package: '@betternotify/slack',
    importStatement: "import { slackChannel, slackTransport } from '@betternotify/slack';",
    installCmd: 'pnpm add @betternotify/slack',
    codeExample: `import { createClient } from '@betternotify/core';
import { slackTransport } from '@betternotify/slack';

const mail = createClient({
  catalog,
  transportsByChannel: {
    slack: slackTransport({ token: process.env.SLACK_BOT_TOKEN }),
  },
});

await mail.deployNotice.send({
  to: '#engineering',
  input: { service: 'api', version: '2.1.0' },
});`,
    features: [
      'Slack Bot API integration',
      'Block Kit message formatting',
      'File uploads',
      'Thread replies via threadTs',
      'Permalink retrieval',
    ],
    docsPath: '/docs/transports/slack',
    related: ['discord', 'telegram', 'twilio'],
  },
  {
    slug: 'discord',
    name: 'Discord',
    channel: 'discord',
    channelLabel: 'Discord',
    tagline: 'Send Discord notifications with Better-Notify',
    description:
      'Post typed messages to Discord channels via webhooks. Rich embeds, attachments, and custom bot identity — all driven by your notification catalog.',
    package: '@betternotify/discord',
    importStatement: "import { discordChannel, discordTransport } from '@betternotify/discord';",
    installCmd: 'pnpm add @betternotify/discord',
    codeExample: `import { createClient } from '@betternotify/core';
import { discordTransport } from '@betternotify/discord';

const mail = createClient({
  catalog,
  transportsByChannel: {
    discord: discordTransport({
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    }),
  },
});

await mail.alert.send({
  to: 'webhook',
  input: { level: 'critical', message: 'Database latency spike' },
});`,
    features: [
      'Discord Webhook API',
      'Rich embeds with fields',
      'File attachments',
      'Custom username and avatar',
      'Rate limit handling',
    ],
    docsPath: '/docs/transports/discord',
    related: ['slack', 'telegram', 'twilio'],
  },
  {
    slug: 'telegram',
    name: 'Telegram',
    channel: 'telegram',
    channelLabel: 'Telegram',
    tagline: 'Send Telegram messages with Better-Notify',
    description:
      'Send typed Telegram messages through the Bot API. Text, photos, documents, video, and audio — routed automatically based on your notification content.',
    package: '@betternotify/telegram',
    importStatement: "import { telegramChannel, telegramTransport } from '@betternotify/telegram';",
    installCmd: 'pnpm add @betternotify/telegram',
    codeExample: `import { createClient } from '@betternotify/core';
import { telegramTransport } from '@betternotify/telegram';

const mail = createClient({
  catalog,
  transportsByChannel: {
    telegram: telegramTransport({ token: process.env.TELEGRAM_BOT_TOKEN }),
  },
});

await mail.orderUpdate.send({
  to: '123456789',
  input: { orderId: 'ORD-42', status: 'shipped' },
});`,
    features: [
      'Telegram Bot API',
      'Markdown and HTML parse modes',
      'Photo, document, video, audio',
      'Automatic method routing by content type',
      'Rate limit detection',
    ],
    docsPath: '/docs/transports/telegram',
    related: ['slack', 'discord', 'twilio'],
  },
  {
    slug: 'react-email',
    name: 'React Email',
    channel: 'template',
    channelLabel: 'Template',
    tagline: 'Build email templates with React Email and Better-Notify',
    description:
      'Write email templates as React components and render them through Better-Notify. Full TypeScript support — your template props are type-checked against your notification schema.',
    package: '@betternotify/react-email',
    importStatement: "import { reactEmail } from '@betternotify/react-email';",
    installCmd: 'pnpm add @betternotify/react-email',
    codeExample: `import { reactEmail } from '@betternotify/react-email';
import { WelcomeEmail } from './emails/welcome';

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => \`Welcome, \${input.name}\`)
    .template(({ input }) => reactEmail(WelcomeEmail, { name: input.name })),
});`,
    features: [
      'React components as email templates',
      'Type-safe template props',
      'Automatic HTML and plain text rendering',
      'Pretty-print HTML option',
      'Works with any email transport',
    ],
    docsPath: '/docs/templates/react-email',
    related: ['mjml', 'handlebars'],
  },
  {
    slug: 'mjml',
    name: 'MJML',
    channel: 'template',
    channelLabel: 'Template',
    tagline: 'Build responsive email templates with MJML and Better-Notify',
    description:
      'Write responsive email templates in MJML markup and render them through Better-Notify. MJML compiles to bulletproof HTML that works across every email client.',
    package: '@betternotify/mjml',
    importStatement: "import { mjmlTemplate } from '@betternotify/mjml';",
    installCmd: 'pnpm add @betternotify/mjml',
    codeExample: `import { mjmlTemplate } from '@betternotify/mjml';

const catalog = rpc.catalog({
  receipt: rpc
    .email()
    .input(z.object({ amount: z.number(), orderId: z.string() }))
    .subject(({ input }) => \`Receipt for order \${input.orderId}\`)
    .template(mjmlTemplate(\`<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Receipt for order {{orderId}} — \${{amount}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>\`)),
});`,
    features: [
      'MJML responsive email markup',
      'Cross-client compatible output',
      'Handlebars variable interpolation',
      'Type-safe template bindings',
      'Works with any email transport',
    ],
    docsPath: '/docs/templates/mjml',
    related: ['react-email', 'handlebars'],
  },
  {
    slug: 'handlebars',
    name: 'Handlebars',
    channel: 'template',
    channelLabel: 'Template',
    tagline: 'Build email templates with Handlebars and Better-Notify',
    description:
      'Use Handlebars templates for simple, logic-light email rendering. Great for teams that prefer HTML templates over component frameworks.',
    package: '@betternotify/handlebars',
    importStatement: "import { handlebarsTemplate } from '@betternotify/handlebars';",
    installCmd: 'pnpm add @betternotify/handlebars',
    codeExample: `import { handlebarsTemplate } from '@betternotify/handlebars';

const catalog = rpc.catalog({
  invite: rpc
    .email()
    .input(z.object({ inviterName: z.string(), teamName: z.string() }))
    .subject(({ input }) => \`\${input.inviterName} invited you to \${input.teamName}\`)
    .template(handlebarsTemplate('<h1>Welcome, {{inviterName}}</h1><p>Join {{teamName}} today.</p>')),
});`,
    features: [
      'Handlebars template syntax',
      'Partials and helpers',
      'HTML and plain text output',
      'Type-safe template context',
      'Works with any email transport',
    ],
    docsPath: '/docs/templates/handlebars',
    related: ['react-email', 'mjml'],
  },
];

export const getIntegration = (slug: string): Integration | undefined =>
  integrations.find((i) => i.slug === slug);

export const getRelatedIntegrations = (slugs: string[]): Integration[] =>
  slugs.map((s) => integrations.find((i) => i.slug === s)).filter(Boolean) as Integration[];
