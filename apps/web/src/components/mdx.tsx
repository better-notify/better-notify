import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

export const getMDXComponents = (components?: MDXComponents) => {
  return {
    ...defaultMdxComponents,
    ...components,
  } satisfies MDXComponents;
};

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
