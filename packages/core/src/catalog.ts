import type { AnyStandardSchema, InferInput, InferOutput } from './schema.js';
import type { ChannelDefinition } from './channel/types.js';

const CATALOG_BRAND = 'Catalog' as const;

export type Catalog<M, Ctx = unknown> = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: Ctx;
  readonly definitions: { readonly [k: string]: ChannelDefinition<any, any> };
  readonly nested: { readonly [K in keyof M]: NestedValue<M[K]> };
  readonly routes: ReadonlyArray<string>;
};

export type AnyCatalog = {
  readonly _brand: typeof CATALOG_BRAND;
  readonly _ctx: any;
  readonly definitions: Record<string, ChannelDefinition<any, any>>;
  readonly nested: Record<string, unknown>;
  readonly routes: ReadonlyArray<string>;
};

type IsCatalog<T> = T extends { readonly _brand: typeof CATALOG_BRAND } ? true : false;

type NestedValue<V> = IsCatalog<V> extends true ? V : V;

type FlatKeys<M> = {
  [K in keyof M & string]: IsCatalog<M[K]> extends true
    ? M[K] extends { readonly definitions: infer Defs }
      ? `${K}.${keyof Defs & string}`
      : never
    : K;
}[keyof M & string];

export type ValidateCatalog<M> = {
  [K in keyof M]: IsCatalog<M[K]> extends true
    ? M[K]
    : M[K] extends { readonly _channel: string; _finalize: (id: string) => any }
      ? M[K]
      : `Value at "${K & string}" is not a channel route or sub-catalog.`;
};

export const isCatalog = (v: unknown): v is AnyCatalog => {
  return !!v && typeof v === 'object' && (v as { _brand?: string })._brand === CATALOG_BRAND;
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
  const definitions: Record<string, ChannelDefinition<any, any>> = {};
  const nested: Record<string, unknown> = {};
  const routes: string[] = [];

  for (const key of Object.keys(map)) {
    const value = (map as Record<string, unknown>)[key];
    if (isCatalog(value)) {
      nested[key] = value;
      for (const subKey of value.routes) {
        const flatKey = `${key}.${subKey}`;
        const subDef = value.definitions[subKey];
        if (subDef) {
          definitions[flatKey] = { ...subDef, id: flatKey };
          routes.push(flatKey);
        }
      }
    } else if (isChannelBuilder(value)) {
      const def = value._finalize(key);
      definitions[key] = def;
      nested[key] = def;
      routes.push(key);
    } else {
      throw new Error(`Catalog key "${key}" is not a channel route or sub-catalog.`);
    }
  }

  return {
    _brand: CATALOG_BRAND,
    _ctx: undefined as never,
    definitions,
    nested: nested as Catalog<M, Ctx>['nested'],
    routes,
  };
};

type SchemaOf<B> = B extends { readonly schema: infer S } ? S : never;

type CatalogOf<R> = R extends Catalog<infer M, any> ? M : never;

export type CtxOf<R> = R extends Catalog<any, infer Ctx> ? Ctx : unknown;

export type InputOf<R extends AnyCatalog, K extends keyof CatalogOf<R> & string> = InferInput<
  SchemaOf<CatalogOf<R>[K]>
> extends never
  ? unknown
  : InferInput<SchemaOf<CatalogOf<R>[K]>>;

export type OutputOf<R extends AnyCatalog, K extends keyof CatalogOf<R> & string> = InferOutput<
  SchemaOf<CatalogOf<R>[K]>
> extends never
  ? unknown
  : InferOutput<SchemaOf<CatalogOf<R>[K]>>;

export type CatalogMap = Record<string, unknown>;

export type FlatRoutes<M> = FlatKeys<M>;
