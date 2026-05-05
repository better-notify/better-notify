import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { SignalFlow } from '@/components/signal-flow';
import { PipelineFlow } from '@/components/pipeline-flow';
import { RateLimitDemo } from '@/components/rate-limit-demo';
import { IdempotencyDemo } from '@/components/idempotency-demo';
import { APIPage } from '@/components/api-page';

export const getMDXComponents = (components?: MDXComponents) => {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    SignalFlow,
    PipelineFlow,
    RateLimitDemo,
    IdempotencyDemo,
    APIPage,
    ...components,
  } satisfies MDXComponents;
};

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
