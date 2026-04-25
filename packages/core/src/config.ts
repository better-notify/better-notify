export interface EmailRpcConfig {
  router: string;
  provider: string;
  storage?: string;
  templates?: {
    engine?: 'react' | 'mjml' | 'handlebars';
    dir?: string;
  };
  reports?: {
    auth?: string;
  };
}

export function defineConfig(config: EmailRpcConfig): EmailRpcConfig {
  return config;
}
