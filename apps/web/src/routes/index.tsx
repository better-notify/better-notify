import { createFileRoute, Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { baseOptions } from '@/lib/layout.shared';

const LandingPage = () => {
  return (
    <HomeLayout {...baseOptions()}>
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <h1 className="text-fd-foreground mb-4 text-center text-5xl font-bold tracking-tight">
          End-to-end typed notifications
          <br />
          for Node.js
        </h1>
        <p className="text-fd-muted-foreground mb-8 max-w-xl text-center text-lg">
          A single catalog type drives your sender, queue worker, and webhook router — like tRPC,
          but for email.
        </p>
        <pre className="bg-fd-card border-fd-border mb-8 max-w-lg overflow-x-auto rounded-lg border p-4 text-sm">
          <code>{`const rpc = createBetterNotify<Ctx>()
const welcome = rpc.email()
  .input(WelcomeSchema)
  .subject(({ name }) => \`Welcome, \${name}!\`)
  .template(reactEmailAdapter(WelcomeEmail))

const catalog = rpc.catalog({ welcome })

const mail = createSender({ catalog, transport })
await mail.welcome.send({ to: "user@example.com", input: { name: "Ada" } })`}</code>
        </pre>
        <div className="flex gap-4">
          <Link
            to="/docs/$"
            params={{ _splat: '' }}
            className="bg-fd-primary text-fd-primary-foreground rounded-md px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/better-notify/better-notify"
            target="_blank"
            rel="noopener noreferrer"
            className="border-fd-border text-fd-foreground hover:bg-fd-accent rounded-md border px-6 py-2.5 text-sm font-medium transition-colors"
          >
            GitHub
          </a>
        </div>
      </section>
    </HomeLayout>
  );
};

export const Route = createFileRoute('/')({
  component: LandingPage,
});
