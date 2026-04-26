import type { AnyStandardSchema, InferInput, InferOutput } from './schema.js';
import type { TemplateAdapter } from './template.js';
import type { EmailBuilder, EmailDefinition, EmailDefinitionOf } from './builder.js';

const CATALOG_BRAND = 'EmailCatalog' as const;

export type EmailCatalog<M, Ctx = unknown> = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: Ctx;
  readonly emails: { readonly [K in FlatKeys<M> & string]: EmailDefinition<Ctx, any, any> };
  readonly nested: { readonly [K in keyof M]: NestedValue<M[K]> };
  readonly routes: ReadonlyArray<string>;
};

export type AnyEmailCatalog = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: any;
  readonly emails: Record<string, EmailDefinition<any, any, any>>;
  readonly nested: Record<string, unknown>;
  readonly routes: ReadonlyArray<string>;
};

type IsCatalog<T> = T extends { readonly _brand: typeof CATALOG_BRAND } ? true : false;

type NestedValue<V> = IsCatalog<V> extends true
  ? V
  : V extends EmailBuilder<any, any>
    ? EmailDefinitionOf<V>
    : never;

type FlatKeys<M> = {
  [K in keyof M & string]: IsCatalog<M[K]> extends true
    ? M[K] extends { readonly emails: infer SubEmails }
      ? `${K}.${keyof SubEmails & string}`
      : never
    : K;
}[keyof M & string];

export type ValidateCatalog<M> = {
  [K in keyof M]: IsCatalog<M[K]> extends true
    ? M[K]
    : M[K] extends EmailBuilder<any, infer S>
      ? S extends {
          input: AnyStandardSchema;
          subject: unknown;
          template: TemplateAdapter<any, any>;
        }
        ? M[K]
        : `Email "${K & string}" is incomplete: input, subject, and template are required.`
      : `Value at "${K & string}" is not an EmailBuilder or EmailCatalog.`;
};

export const isEmailCatalog = (v: unknown): v is AnyEmailCatalog => {
  return !!v && typeof v === 'object' && (v as { _brand?: string })._brand === CATALOG_BRAND;
};

const builderToDefinition = (
  builder: { _state?: Record<string, unknown> },
  id: string,
): EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>> => {
  const state = builder._state as
    | {
        schema?: AnyStandardSchema;
        subject?: unknown;
        template?: TemplateAdapter<unknown, unknown>;
        from?: unknown;
        replyTo?: unknown;
        tags?: unknown;
        priority?: unknown;
        middleware?: ReadonlyArray<unknown>;
      }
    | undefined;
  if (!state || !state.schema || !state.subject || !state.template) {
    throw new Error(`Email "${id}" is incomplete: input/subject/template are required.`);
  }
  return {
    _ctx: undefined as never,
    id,
    schema: state.schema,
    subject: state.subject as never,
    template: state.template,
    from: state.from as never,
    replyTo: state.replyTo as never,
    tags: (state.tags as never) ?? {},
    priority: (state.priority as never) ?? 'normal',
    middleware: (state.middleware as never) ?? [],
  };
};

export const createCatalog = <const M extends Record<string, unknown>, Ctx = unknown>(
  map: M & ValidateCatalog<M>,
): EmailCatalog<M, Ctx> => {
  const flat: Record<string, EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>> = {};
  const nested: Record<string, unknown> = {};
  const routes: string[] = [];

  for (const key of Object.keys(map)) {
    const value = (map as Record<string, unknown>)[key];
    if (isEmailCatalog(value)) {
      nested[key] = value;
      for (const subKey of value.routes) {
        const flatKey = `${key}.${subKey}`;
        const subDef = value.emails[subKey];
        if (!subDef) continue;
        flat[flatKey] = { ...subDef, id: flatKey };
        routes.push(flatKey);
      }
    } else {
      const def = builderToDefinition(
        value as { _state?: Record<string, unknown> },
        key,
      );
      flat[key] = def;
      nested[key] = def;
      routes.push(key);
    }
  }

  return {
    _brand: CATALOG_BRAND,
    _ctx: undefined as never,
    emails: flat as EmailCatalog<M, Ctx>['emails'],
    nested: nested as EmailCatalog<M, Ctx>['nested'],
    routes,
  };
};

type SchemaOf<B> = B extends EmailBuilder<any, infer S>
  ? S extends { input: infer TSchema }
    ? TSchema extends AnyStandardSchema
      ? TSchema
      : never
    : never
  : never;

type CatalogOf<R> = R extends EmailCatalog<infer M, any> ? M : never;

export type CtxOf<R> = R extends EmailCatalog<any, infer Ctx> ? Ctx : unknown;

export type InputOf<R extends AnyEmailCatalog, K extends keyof CatalogOf<R> & string> = InferInput<
  SchemaOf<CatalogOf<R>[K]>
>;

export type OutputOf<R extends AnyEmailCatalog, K extends keyof CatalogOf<R> & string> = InferOutput<
  SchemaOf<CatalogOf<R>[K]>
>;

export type CatalogMap = Record<string, unknown>;
