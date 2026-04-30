import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { appConfig } from './shared';

export const baseOptions = (): BaseLayoutProps => {
  return {
    nav: {
      title: appConfig.name,
    },
    githubUrl: `https://github.com/${appConfig.git.user}/${appConfig.git.repo}`,
  };
};
