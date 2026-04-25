export interface RenderedOutput {
  html: string;
  text?: string;
  subject?: string;
}

export interface TemplateAdapter<TInput> {
  // Function property (not method shorthand) so input is checked contravariantly.
  // With method shorthand TypeScript uses bivariance, which would let an
  // adapter requiring extra fields satisfy a schema that doesn't supply them.
  readonly render: (input: TInput) => Promise<RenderedOutput>;
}

export type AnyTemplateAdapter = TemplateAdapter<any>;
