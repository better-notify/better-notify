export type EmailRpcConfig = {
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

export const defineConfig = (config: EmailRpcConfig): EmailRpcConfig => {
  return config;
};
