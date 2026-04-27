export type NotifyRpcConfig = {
  router: string;
  transport: string;
  storage?: string;
  templates?: {
    engine?: 'react' | 'mjml' | 'handlebars';
    dir?: string;
  };
  reports?: {
    auth?: string;
  };
};

export const defineConfig = (config: NotifyRpcConfig): NotifyRpcConfig => {
  return config;
};
