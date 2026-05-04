import mjml2html from 'mjml';
import Handlebars from 'handlebars';
import type { RenderedOutput, TemplateAdapter } from '@betternotify/email';

type MjmlResult = { html: string; errors: Array<{ formattedMessage: string }> };

type MjmlOptions = {
  fonts?: Record<string, string>;
  keepComments?: boolean;
  beautify?: boolean;
  minify?: boolean;
  validationLevel?: 'strict' | 'soft' | 'skip';
  filePath?: string;
};

export type MjmlTemplateOptions = {
  text?: string;
  subject?: string;
  helpers?: Record<string, Handlebars.HelperDelegate>;
  partials?: Record<string, string>;
  mjml?: MjmlOptions;
};

/**
 * Create an MJML + Handlebars template adapter.
 *
 * Two-phase rendering: MJML source compiles to responsive HTML at creation
 * time (eager), then Handlebars interpolation runs on each `render()` call
 * using `input` as data context.
 *
 * Use `{{variable}}` placeholders inside MJML markup — they survive MJML
 * compilation and are resolved at render time.
 *
 * ```ts
 * .template(mjmlTemplate(`
 *   <mjml>
 *     <mj-body>
 *       <mj-section>
 *         <mj-column>
 *           <mj-text>Hello {{name}}</mj-text>
 *         </mj-column>
 *       </mj-section>
 *     </mj-body>
 *   </mjml>
 * `, { subject: 'Welcome, {{name}}!' }))
 * ```
 *
 * @beta
 */
export const mjmlTemplate = <TInput>(
  source: string,
  opts?: MjmlTemplateOptions,
): TemplateAdapter<TInput> => {
  const { html: compiledHtml, errors } = mjml2html(source, opts?.mjml) as unknown as MjmlResult;

  if (errors.length > 0) {
    const messages = errors.map((e) => e.formattedMessage).join('\n');
    throw new Error(`MJML compilation failed:\n${messages}`);
  }

  const instance = Handlebars.create();

  if (opts?.helpers) {
    for (const [name, fn] of Object.entries(opts.helpers)) {
      instance.registerHelper(name, fn);
    }
  }

  if (opts?.partials) {
    for (const [name, partial] of Object.entries(opts.partials)) {
      instance.registerPartial(name, partial);
    }
  }

  const htmlTemplate = instance.compile(compiledHtml);
  const textTemplate = opts?.text !== undefined ? instance.compile(opts.text) : undefined;
  const subjectTemplate = opts?.subject !== undefined ? instance.compile(opts.subject) : undefined;

  return {
    render: async ({ input }) => {
      const data = input as Record<string, unknown>;
      const result: RenderedOutput = { html: htmlTemplate(data) };
      if (textTemplate) result.text = textTemplate(data);
      if (subjectTemplate) result.subject = subjectTemplate(data);
      return result;
    },
  };
};
