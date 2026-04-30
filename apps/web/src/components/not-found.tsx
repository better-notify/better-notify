import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { DefaultNotFound } from 'fumadocs-ui/layouts/home/not-found';

import { baseOptions } from '@/lib/layout.shared';

export const NotFound = () => {
  return (
    <HomeLayout {...baseOptions()}>
      <DefaultNotFound />
    </HomeLayout>
  );
};
