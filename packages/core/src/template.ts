export type RenderedOutput = {
  html: string;
  text?: string;
  subject?: string;
};

export type TemplateAdapter<TInput, TCtx = unknown> = {
  readonly render: (args: { input: TInput; ctx: TCtx }) => Promise<RenderedOutput>;
};

export type AnyTemplateAdapter = TemplateAdapter<any, any>;
