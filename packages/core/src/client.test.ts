import { describe, it, expectTypeOf } from 'vitest';
import type {
  ProviderEntry,
  ClientHooks,
  CreateClientOptions,
  SendOptions,
} from './client.js';
import type { Provider } from './provider.js';
import type { AnyEmailRouter } from './router.js';
import type { SendResult } from './types.js';

describe('client types', () => {
  it('SendOptions infers provider names from the providers tuple', () => {
    type Entries = readonly [
      { name: 'ses'; provider: Provider; priority: 1 },
      { name: 'smtp'; provider: Provider; priority: 2 },
    ];
    type Opts = SendOptions<Entries>;
    expectTypeOf<Opts['provider']>().toEqualTypeOf<'ses' | 'smtp' | undefined>();
  });

  it('ProviderEntry has correct shape', () => {
    expectTypeOf<ProviderEntry>().toMatchTypeOf<{
      name: string;
      provider: Provider;
      priority: number;
    }>();
  });
});
