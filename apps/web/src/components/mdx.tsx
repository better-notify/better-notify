import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { SignalFlow } from '@/components/signal-flow';
import { PipelineFlow } from '@/components/pipeline-flow';
import { RateLimitDemo } from '@/components/rate-limit-demo';
import { IdempotencyDemo } from '@/components/idempotency-demo';

export const getMDXComponents = (components?: MDXComponents) => {
  return {
    ...defaultMdxComponents,
    SignalFlow,
    PipelineFlow,
    RateLimitDemo,
    IdempotencyDemo,
    ...components,
  } satisfies MDXComponents;
};

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
