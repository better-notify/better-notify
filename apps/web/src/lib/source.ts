import { docs } from 'collections/server';
import { loader } from 'fumadocs-core/source';
import { type ComponentType, createElement, Fragment } from 'react';

import {
  ChatText,
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

const transportChannels: Record<string, string> = {
  smtp: 'email',
  ses: 'email',
  resend: 'email',
  'cloudflare-email': 'email',
  mailchimp: 'email',
  discord: 'discord',
  slack: 'slack',
  telegram: 'telegram',
  twilio: 'sms',
  zapier: 'zapier',
  mock: 'any',
  'multi-transport': 'any',
  'custom-transports': 'any',
};

const channelBadges: Record<string, ChannelBadge> = {
  email: { tooltip: 'Email channel', icon: Envelope },
  discord: { tooltip: 'Discord channel', icon: DiscordLogo },
  slack: { tooltip: 'Slack channel', icon: SlackLogo },
  telegram: { tooltip: 'Telegram channel', icon: TelegramLogo },
  sms: { tooltip: 'SMS channel', icon: DeviceMobile },
  zapier: { tooltip: 'Zapier channel', icon: Lightning },
  any: { tooltip: 'Any channel', icon: Globe },
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
                className:
                  'ml-auto pl-2 shrink-0 text-fd-muted-foreground channel-badge relative',
                'data-tooltip': ch.tooltip,
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
