import { useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';

import { useInView } from '@/hooks/use-in-view';
import { K, F, S } from '@/components/landing/syntax';

const commands: Record<string, string> = {
  pnpm: 'pnpm add @betternotify/core @betternotify/email @betternotify/smtp',
  npm: 'npm install @betternotify/core @betternotify/email @betternotify/smtp',
  bun: 'bun add @betternotify/core @betternotify/email @betternotify/smtp',
  yarn: 'yarn add @betternotify/core @betternotify/email @betternotify/smtp',
};

export function Install() {
  const [pm, setPm] = useState('pnpm');
  const [copied, setCopied] = useState(false);
  const cmd = commands[pm] ?? commands.pnpm;

  function handleCopy() {
    navigator.clipboard?.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const [ref, inView, hydrated] = useInView();
  return (
    <section id="install" className="py-24 md:py-28">
      <div
        ref={ref}
        className={`${hydrated ? 'reveal' : ''} mx-auto max-w-[1200px] px-5 md:px-8${inView ? ' in-view' : ''}`}
      >
        <div className="mb-12">
          <p className="bn-eyebrow mb-3">Quick start</p>
          <h2
            className="text-foreground mb-4 text-4xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            Install. Define. Send.
          </h2>
          <p className="text-muted-foreground max-w-[620px] text-[17px] leading-relaxed text-pretty">
            Three packages, three minutes. Email, SMS, push, and Telegram channels are shipping
            today.
          </p>
        </div>

        <div className="mx-auto grid max-w-[640px] gap-4">
          <InstallStep n={1} title="Install">
            <div className="mb-2.5 flex gap-1">
              {Object.keys(commands).map((x) => (
                <button
                  key={x}
                  onClick={() => setPm(x)}
                  className={`cursor-pointer rounded border-0 px-2.5 py-1 font-mono text-[11.5px] font-medium ${
                    pm === x ? 'bg-primary/10 text-primary' : 'text-muted-foreground bg-transparent'
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-bn-slate-200 bg-bn-slate-50 px-3.5 py-2.5 dark:border-bn-slate-800 dark:bg-bn-slate-950">
              <span className="font-mono text-xs text-bn-navy-700 dark:text-bn-navy-300">$</span>
              <span className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-bn-slate-700 dark:text-bn-slate-300">
                {cmd}
              </span>
              <button
                onClick={handleCopy}
                className={`flex cursor-pointer border-0 bg-transparent ${copied ? 'text-bn-success-700 dark:text-bn-success-300' : 'text-bn-slate-400 dark:text-bn-slate-500'}`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </InstallStep>

          <InstallStep n={2} title="Define your catalog">
            <pre className="m-0 overflow-x-auto rounded-md border border-bn-slate-200 bg-bn-slate-50 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-bn-slate-700 dark:border-bn-slate-800 dark:bg-bn-slate-950 dark:text-bn-slate-300">
              <K>const</K> welcome = rpc.<F>email</F>(){'\n'}
              {'  '}.<F>input</F>(WelcomeSchema){'\n'}
              {'  '}.<F>subject</F>({'({ n }'}) =&gt; <S>{`\`Hi, \${n}\``}</S>){'\n'}
              {'  '}.<F>template</F>(WelcomeAdapter);
            </pre>
          </InstallStep>

          <InstallStep n={3} title="Send anywhere">
            <pre className="m-0 overflow-x-auto rounded-md border border-bn-slate-200 bg-bn-slate-50 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-bn-slate-700 dark:border-bn-slate-800 dark:bg-bn-slate-950 dark:text-bn-slate-300">
              <K>await</K> mail.welcome.<F>send</F>({'{'}
              {'\n'}
              {'  '}to: <S>'ada@example.com'</S>,{'\n'}
              {'  '}input: {'{ '}name: <S>'Ada'</S> {'}'},{'\n'}
              {'}'});
            </pre>
          </InstallStep>
        </div>
      </div>
    </section>
  );
}

function InstallStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card min-w-0 overflow-hidden rounded-lg border p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="bg-primary text-primary-foreground flex size-[22px] items-center justify-center rounded-md font-mono text-[11px] font-semibold">
          {n}
        </span>
        <h3 className="text-foreground m-0 text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
