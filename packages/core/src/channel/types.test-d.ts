import { expectTypeOf, describe, it } from 'vitest';
import type {
  Channel,
  ChannelDefinition,
  AnyChannel,
  TransportsFor,
  ArgsFor,
  RenderedFor,
  BuilderFor,
} from './types.js';

type FakeArgs = { to: string; input: { x: string } };
type FakeRendered = { body: string };
type FakeBuilder = { _brand: 'FakeBuilder' };
type FakeTransport = { send: (r: FakeRendered) => Promise<void> };

type Ch = Channel<'fake', FakeBuilder, FakeArgs, FakeRendered, FakeTransport>;

describe('Channel<...> contract', () => {
  it('exposes the channel name as a literal', () => {
    expectTypeOf<Ch['name']>().toEqualTypeOf<'fake'>();
  });

  it('createBuilder is callable and returns the builder type', () => {
    expectTypeOf<Ch['createBuilder']>().toBeFunction();
  });

  it('Channel widens to AnyChannel', () => {
    expectTypeOf<Ch>().toMatchTypeOf<AnyChannel>();
  });

  it('TransportsFor maps a ChannelMap to a record of transport types keyed by channel name', () => {
    type M = { fake: Ch };
    expectTypeOf<TransportsFor<M>>().toEqualTypeOf<{ fake: FakeTransport }>();
  });

  it('ArgsFor / RenderedFor / BuilderFor extract the matching type parameter', () => {
    expectTypeOf<ArgsFor<Ch>>().toEqualTypeOf<FakeArgs>();
    expectTypeOf<RenderedFor<Ch>>().toEqualTypeOf<FakeRendered>();
    expectTypeOf<BuilderFor<Ch>>().toEqualTypeOf<FakeBuilder>();
  });

  it('ChannelDefinition has channel-tagged metadata', () => {
    type Def = ChannelDefinition<FakeArgs, FakeRendered>;
    expectTypeOf<Def['channel']>().toEqualTypeOf<string>();
    expectTypeOf<Def['id']>().toEqualTypeOf<string>();
  });
});
