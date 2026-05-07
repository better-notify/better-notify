import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { type ComponentType, createElement, Fragment } from 'react';

import { ChatText, DeviceMobile, Envelope, Globe, Lightning } from '@phosphor-icons/react';

import { appConfig } from './shared';
import { iconMap } from './icons';

type ChannelBadge = {
  label: string;
  tooltip: string;
  color: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const transportChannels: Record<string, string> = {
  smtp: 'email',
  ses: 'email',
  resend: 'email',
  'cloudflare-email': 'email',
  mailchimp: 'email',
  discord: 'chat',
  slack: 'chat',
  telegram: 'chat',
  twilio: 'sms',
  zapier: 'automation',
  mock: 'any',
  'multi-transport': 'any',
  'custom-transports': 'any',
};

const channelBadges: Record<string, ChannelBadge> = {
  email: { label: 'email', tooltip: 'Email channel', color: 'text-purple-500', icon: Envelope },
  chat: { label: 'chat', tooltip: 'Chat channel', color: 'text-indigo-500', icon: ChatText },
  sms: { label: 'sms', tooltip: 'SMS channel', color: 'text-green-500', icon: DeviceMobile },
  automation: {
    label: 'automation',
    tooltip: 'Automation channel',
    color: 'text-amber-500',
    icon: Lightning,
  },
  any: { label: 'any', tooltip: 'Any channel', color: 'text-gray-400', icon: Globe },
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
          if (!slug || !transportChannels[slug]) return node;

          const ch = channelBadges[transportChannels[slug]];

          node.name = createElement(
            Fragment,
            null,
            createElement('span', null, node.name),
            createElement(
              'span',
              {
                className: `ml-auto pl-2 shrink-0 ${ch.color}`,
                title: ch.tooltip,
              },
              createElement(ch.icon, { size: 14 }),
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
