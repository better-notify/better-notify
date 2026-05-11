import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { type ComponentType, createElement, Fragment } from 'react';

import {
  Bell,
  DeviceMobile,
  DiscordLogo,
  Envelope,
  Globe,
  Lightning,
  SlackLogo,
  TelegramLogo,
} from '@phosphor-icons/react';

import { appConfig } from './shared';
import { iconMap } from './icons';

type ChannelBadge = {
  tooltip: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const transportChannels: Record<string, string | string[]> = {
  autosend: 'email',
  smtp: 'email',
  ses: 'email',
  resend: 'email',
  'cloudflare-email': 'email',
  mailchimp: 'email',
  discord: 'discord',
  slack: 'slack',
  telegram: 'telegram',
  twilio: 'sms',
  onesignal: ['push', 'email', 'sms'],
  zapier: 'zapier',
  mock: 'any',
  'multi-transport': 'any',
  'custom-transports': 'any',
};

const channelBadges: Record<string, ChannelBadge> = {
  email: { tooltip: 'Email', icon: Envelope },
  push: { tooltip: 'Push', icon: Bell },
  discord: { tooltip: 'Discord', icon: DiscordLogo },
  slack: { tooltip: 'Slack', icon: SlackLogo },
  telegram: { tooltip: 'Telegram', icon: TelegramLogo },
  sms: { tooltip: 'SMS', icon: DeviceMobile },
  zapier: { tooltip: 'Zapier', icon: Lightning },
  any: { tooltip: 'Any channel', icon: Globe },
};

const createBadgeElement = (ch: ChannelBadge) =>
  createElement(
    'span',
    {
      className: 'shrink-0 text-fd-muted-foreground channel-badge relative',
      'data-tooltip': ch.tooltip,
      'aria-label': ch.tooltip,
      title: ch.tooltip,
    },
    createElement(ch.icon, { size: 14, 'aria-hidden': true } as Record<string, unknown>),
  );

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
          const transportsPrefix = `${appConfig.docs.route}/transports/`;
          if (!node.url?.startsWith(transportsPrefix)) return node;

          const slug = node.url.slice(transportsPrefix.length).replace(/\/$/, '');
          if (!slug || !transportChannels[slug]) return node;

          const channels = transportChannels[slug];
          const keys = Array.isArray(channels) ? channels : [channels];
          const badges = keys.map((key) => channelBadges[key]).filter(Boolean);

          node.name = createElement(
            Fragment,
            null,
            createElement('span', null, node.name),
            createElement(
              'span',
              { className: 'ml-auto pl-2 shrink-0 flex items-center gap-1' },
              ...badges.map(createBadgeElement),
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
