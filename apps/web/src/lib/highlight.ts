import { createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubLight from 'shiki/themes/github-light.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';
import ts from 'shiki/langs/typescript.mjs';

const highlighter = createHighlighterCoreSync({
  themes: [githubLight, githubDark],
  langs: [ts],
  engine: createJavaScriptRegexEngine(),
});

export const highlightCode = (code: string, lang = 'typescript') => {
  const match = code.match(/^\/\/\s*(.+)\n/);
  const filename = match ? match[1].trim() : undefined;
  const source = match ? code.slice(match[0].length) : code;

  return {
    html: highlighter.codeToHtml(source, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
    }),
    filename,
  };
};
