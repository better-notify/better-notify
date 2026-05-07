import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { createElement, Fragment } from 'react';

import { appConfig } from './shared';
import { iconMap } from './icons';

const transportBadges: Record<string, { kind: string; channel: string }> = {
  smtp: { kind: 'provider', channel: 'email' },
  ses: { kind: 'provider', channel: 'email' },
  resend: { kind: 'provider', channel: 'email' },
  'cloudflare-email': { kind: 'provider', channel: 'email' },
  mailchimp: { kind: 'provider', channel: 'email' },
  discord: { kind: 'provider', channel: 'chat' },
  slack: { kind: 'provider', channel: 'chat' },
  telegram: { kind: 'provider', channel: 'chat' },
  twilio: { kind: 'provider', channel: 'sms' },
  zapier: { kind: 'provider', channel: 'automation' },
  mock: { kind: 'core', channel: 'any' },
  'multi-transport': { kind: 'core', channel: 'any' },
  'custom-transports': { kind: 'core', channel: 'any' },
};

const channelLabels: Record<string, { label: string; color: string }> = {
  email: { label: '✉ email', color: 'text-purple-500' },
  chat: { label: '💬 chat', color: 'text-indigo-500' },
  sms: { label: '📱 sms', color: 'text-green-500' },
  automation: { label: '⚡ automation', color: 'text-amber-500' },
  any: { label: 'any', color: 'text-gray-400' },
};

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: appConfig.docs.route,
  icon(name) {
    if (!name || !(name in iconMap)) return;
    return createElement(iconMap[name as keyof typeof iconMap], { size: 18 });
  },
  plugins: ({ typedPlugin }) => [
    typedPlugin({
      transformPageTree: {
        file(node) {
          const slug = node.url?.replace('/docs/transports/', '');
          if (!slug || !transportBadges[slug]) return node;

          const badge = transportBadges[slug];
          const ch = channelLabels[badge.channel];

          node.name = createElement(
            Fragment,
            null,
            createElement('span', null, node.name),
            createElement(
              'span',
              {
                className: `ml-auto pl-2 shrink-0 font-mono text-[10px] ${ch.color}`,
              },
              ch.label,
            ),
          );

          return node;
        },
      },
    }),
  ],
});

export const getPageMarkdownUrl = (page: (typeof source)['$inferPage']) => {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: `/llms.mdx/docs/${segments.join('/')}`,
  };
};

export const getLLMText = async (page: (typeof source)['$inferPage']) => {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
};
