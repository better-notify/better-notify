/** @experimental Config-file-driven setup — not yet implemented; ships in a future release. */
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

/** @experimental Config-file-driven setup — not yet implemented; ships in a future release. */
export const defineConfig = (config: NotifyRpcConfig): NotifyRpcConfig => {
  return config;
};
