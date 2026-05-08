import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { LogoShort } from '@libs/ui';

import { appConfig } from './shared';

export const baseOptions = (): BaseLayoutProps => {
  return {
    nav: {
      title: (
        <>
          <LogoShort className="size-5" />
          {appConfig.name}
        </>
      ),
    },
    githubUrl: `https://github.com/${appConfig.git.user}/${appConfig.git.repo}`,
  };
};
