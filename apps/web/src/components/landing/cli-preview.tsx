import { Check, Copy } from '@phosphor-icons/react';
import { useState } from 'react';

const tabs = [
  { id: 'cli', label: 'CLI', soon: false },
  { id: 'skill', label: 'Skill', soon: false },
] as const;

type TabId = (typeof tabs)[number]['id'];

export function CliPreview() {
  const [active, setActive] = useState<TabId>('cli');
  const [copied, setCopied] = useState(false);

  const commands = {
    cli: 'npx create-better-notify',
    skill: 'npx skills add better-notify/better-notify',
  } as const;

  function handleCopy() {
    navigator.clipboard?.writeText(commands[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-bn-slate-200 bg-bn-slate-50 dark:border-bn-slate-800 dark:bg-bn-slate-950">
      <div className="flex border-b border-bn-slate-200 px-1 dark:border-bn-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.soon}
            onClick={() => setActive(tab.id)}
            className={`relative border-0 bg-transparent px-3.5 pb-2.5 pt-3 font-sans text-[13px] font-medium transition-colors ${
              tab.soon
                ? 'cursor-default text-bn-slate-300 dark:text-bn-slate-600'
                : active === tab.id
                  ? 'cursor-pointer text-bn-slate-900 dark:text-bn-slate-100'
                  : 'cursor-pointer text-bn-slate-400 hover:text-bn-slate-600 dark:text-bn-slate-500 dark:hover:text-bn-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.soon && (
                <span className="rounded bg-bn-slate-200 px-1 py-px text-[10px] font-medium text-bn-slate-400 dark:bg-bn-slate-800 dark:text-bn-slate-500">
                  soon
                </span>
              )}
            </span>
            {active === tab.id && !tab.soon && (
              <span className="absolute bottom-[-1px] left-3.5 right-3.5 h-[2px] rounded-full bg-bn-navy-600 dark:bg-bn-navy-400" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 text-left">
        <span className="select-none font-mono text-[13px] text-bn-slate-400 dark:text-bn-slate-600">
          $
        </span>
        <code className="flex-1 font-mono text-[13px] text-bn-slate-700 dark:text-bn-slate-300">
          <span className="font-medium text-bn-navy-700 dark:text-bn-navy-300">npx</span>{' '}
          {active === 'cli' ? 'create-better-notify' : 'skills add better-notify/better-notify'}
        </code>
        <button
          type="button"
          aria-label={copied ? 'Copied' : 'Copy command'}
          onClick={handleCopy}
          className={`flex-shrink-0 border-0 bg-transparent transition-colors ${
            copied
              ? 'text-bn-success-700 dark:text-bn-success-300'
              : 'text-bn-slate-400 hover:text-bn-slate-600 dark:text-bn-slate-500 dark:hover:text-bn-slate-300'
          }`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
