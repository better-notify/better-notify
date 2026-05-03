export const appConfig = {
  name: 'Better-Notify',
  version: '0.1.0-alpha',
  baseUrl: 'https://better-notify.com',
  npmPackagePrefix: '@betternotify',
  twitterHandle: '@Better_Notify',
  themeColor: '#3a5a8c',
  locale: {
    bcp47: 'en-US',
    openGraph: 'en_US',
  },
  docs: {
    route: '/docs',
    contentRoute: '/llms.mdx/docs',
  },
  git: {
    user: 'better-notify',
    repo: 'better-notify',
    branch: 'main',
  },
} as const;
