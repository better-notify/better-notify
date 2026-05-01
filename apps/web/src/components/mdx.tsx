import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { SignalFlow } from '@/components/signal-flow';

export const getMDXComponents = (components?: MDXComponents) => {
  return {
    ...defaultMdxComponents,
    SignalFlow,
    ...components,
  } satisfies MDXComponents;
};

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
