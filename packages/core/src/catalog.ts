import type { AnyStandardSchema, InferInput, InferOutput } from './schema.js';
import type { TemplateAdapter } from './template.js';
import type { EmailBuilder, EmailDefinition, EmailDefinitionOf } from './builder.js';
import type { ChannelDefinition } from './channel/types.js';

const CATALOG_BRAND = 'Catalog' as const;

export type Catalog<M, Ctx = unknown> = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: Ctx;
  readonly emails: { readonly [K in FlatKeys<M> & string]: EmailDefinition<Ctx, any, any> };
  readonly definitions: { readonly [k: string]: ChannelDefinition<any, any> };
  readonly nested: { readonly [K in keyof M]: NestedValue<M[K]> };
  readonly routes: ReadonlyArray<string>;
};

export type AnyCatalog = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: any;
  readonly emails: Record<string, EmailDefinition<any, any, any>>;
  readonly definitions: Record<string, ChannelDefinition<any, any>>;
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
    : M[K] extends { readonly _channel: string; _finalize: (id: string) => any }
      ? M[K]
      : M[K] extends EmailBuilder<any, infer S>
        ? S extends {
            input: AnyStandardSchema;
            subject: unknown;
            template: TemplateAdapter<any, any>;
          }
          ? M[K]
          : `Email "${K & string}" is incomplete: input, subject, and template are required.`
        : `Value at "${K & string}" is not an EmailBuilder or Catalog.`;
};

export const isCatalog = (v: unknown): v is AnyCatalog => {
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

const isChannelBuilder = (
  v: unknown,
): v is { _channel: string; _finalize: (id: string) => ChannelDefinition<any, any> } => {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as { _channel?: unknown })._channel === 'string' &&
    typeof (v as { _finalize?: unknown })._finalize === 'function'
  );
};

export const createCatalog = <const M extends Record<string, unknown>, Ctx = unknown>(
  map: M & ValidateCatalog<M>,
): Catalog<M, Ctx> => {
  const flat: Record<string, EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>>> = {};
  const definitions: Record<string, ChannelDefinition<any, any>> = {};
  const nested: Record<string, unknown> = {};
  const routes: string[] = [];

  for (const key of Object.keys(map)) {
    const value = (map as Record<string, unknown>)[key];
    if (isCatalog(value)) {
      nested[key] = value;
      for (const subKey of value.routes) {
        const flatKey = `${key}.${subKey}`;
        const subDef = value.emails[subKey];
        const subChannelDef = value.definitions?.[subKey];
        if (subDef) {
          flat[flatKey] = { ...subDef, id: flatKey };
        }
        if (subChannelDef) {
          definitions[flatKey] = { ...subChannelDef, id: flatKey };
        }
        if (subDef || subChannelDef) routes.push(flatKey);
      }
    } else if (isChannelBuilder(value)) {
      const def = value._finalize(key);
      definitions[key] = def;
      if (def.channel === 'email') {
        const runtime = def.runtime as {
          subject: unknown;
          template: TemplateAdapter<unknown, unknown>;
          from?: unknown;
          replyTo?: unknown;
          tags?: unknown;
          priority?: unknown;
        };
        const emailDef: EmailDefinition<unknown, AnyStandardSchema, TemplateAdapter<unknown, unknown>> = {
          _ctx: undefined as never,
          id: key,
          schema: def.schema,
          subject: runtime.subject as never,
          template: runtime.template,
          from: runtime.from as never,
          replyTo: runtime.replyTo as never,
          tags: (runtime.tags as never) ?? {},
          priority: (runtime.priority as never) ?? 'normal',
          middleware: def.middleware,
        };
        flat[key] = emailDef;
        nested[key] = emailDef;
      } else {
        nested[key] = def;
      }
      routes.push(key);
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
    emails: flat as Catalog<M, Ctx>['emails'],
    definitions,
    nested: nested as Catalog<M, Ctx>['nested'],
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

type CatalogOf<R> = R extends Catalog<infer M, any> ? M : never;

export type CtxOf<R> = R extends Catalog<any, infer Ctx> ? Ctx : unknown;

export type InputOf<R extends AnyCatalog, K extends keyof CatalogOf<R> & string> = InferInput<
  SchemaOf<CatalogOf<R>[K]>
>;

export type OutputOf<R extends AnyCatalog, K extends keyof CatalogOf<R> & string> = InferOutput<
  SchemaOf<CatalogOf<R>[K]>
>;

export type CatalogMap = Record<string, unknown>;
