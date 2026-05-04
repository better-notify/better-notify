import Handlebars from 'handlebars';
import type { RenderedOutput, TemplateAdapter } from '@betternotify/email';

export type HandlebarsTemplateOptions = {
  text?: string;
  subject?: string;
  helpers?: Record<string, Handlebars.HelperDelegate>;
  partials?: Record<string, string>;
};

/**
 * Create a Handlebars-based template adapter.
 *
 * Compiles the HTML source at creation time; each `render()` call executes
 * the compiled template with `input` as data context.
 *
 * ```ts
 * .template(handlebarsTemplate('<h1>Hello {{name}}</h1>', {
 *   text: 'Hello {{name}}',
 *   subject: 'Welcome, {{name}}!',
 * }))
 * ```
 *
 * @beta
 */
export const handlebarsTemplate = <TInput>(
  source: string,
  opts?: HandlebarsTemplateOptions,
): TemplateAdapter<TInput> => {
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

  const htmlTemplate = instance.compile(source);
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
