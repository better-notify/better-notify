import { createElement, type ReactElement } from 'react';
import { pretty, toPlainText, render } from 'react-email';
import type { RenderedOutput } from '@emailrpc/core';

export type ReactEmailRenderOptions = {
  plainText?: boolean;
  pretty?: boolean;
};

export type ReactEmailComponent<TProps> = (props: TProps) => ReactElement;

const NO_UPPERCASE_SELECTORS = [
  { selector: 'h1', format: 'heading', options: { uppercase: false } },
  { selector: 'h2', format: 'heading', options: { uppercase: false } },
  { selector: 'h3', format: 'heading', options: { uppercase: false } },
  { selector: 'h4', format: 'heading', options: { uppercase: false } },
  { selector: 'h5', format: 'heading', options: { uppercase: false } },
  { selector: 'h6', format: 'heading', options: { uppercase: false } },
];

/**
 * Render a React Email component to `{ html, text? }`.
 *
 * Designed to be called from inside `.template((args) => reactEmail(...))` —
 * the surrounding builder method gives the lambda fully-typed `input` and
 * `ctx`, so this helper only needs the component plus already-resolved props.
 *
 * ```ts
 * .template(({ input, ctx }) =>
 *   reactEmail(WelcomeEmail, {
 *     name: input.name,
 *     link: `${ctx.baseUrl}/verify?t=${input.token}`,
 *   })
 * )
 * ```
 *
 * Options: `plainText: true` also produces a text alternative; `pretty: true`
 * formats HTML with indentation/newlines.
 */
export const reactEmail = async <TProps extends object>(
  Component: ReactEmailComponent<TProps>,
  props: TProps,
  opts?: ReactEmailRenderOptions,
): Promise<RenderedOutput> => {
  const element = createElement(Component, props);
  const rawHtml = await render(element);
  const document = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${rawHtml}`;
  const html = opts?.pretty ? await pretty(document) : document;
  if (opts?.plainText) {
    const text = toPlainText(rawHtml, { selectors: NO_UPPERCASE_SELECTORS });
    return { html, text };
  }
  return { html };
};
