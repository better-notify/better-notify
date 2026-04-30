import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { appName, gitConfig } from './shared';

export const baseOptions = (): BaseLayoutProps => {
  return {
    nav: {
      title: appName,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
};
