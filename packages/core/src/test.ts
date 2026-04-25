import { EmailRpcNotImplementedError } from './errors.js'
import type { Provider } from './provider.js'
import type { AnyEmailRouter } from './router.js'
import type { Sender } from './sender.js'

export interface MockProvider extends Provider {
  readonly sent: Array<{
    route: string
    to: string[]
    subject: string
    html: string
    text: string
  }>
  reset(): void
}

export function mockProvider(): MockProvider {
  throw new EmailRpcNotImplementedError('mockProvider() (Layer 2 test utilities)')
}

export interface CreateTestSenderOptions<R extends AnyEmailRouter> {
  router: R
  provider: Provider
  hooks?: HookRecorder
}

export function createTestSender<R extends AnyEmailRouter>(
  _opts: CreateTestSenderOptions<R>,
): Sender<R> {
  throw new EmailRpcNotImplementedError('createTestSender() (Layer 2 test utilities)')
}

export interface HookRecorder {
  readonly calls: Array<{ name: string; route: string; [k: string]: unknown }>
  reset(): void
}

export function recordHooks(): HookRecorder {
  throw new EmailRpcNotImplementedError('recordHooks() (Layer 2 test utilities)')
}
