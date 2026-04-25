import { describe, expect, it } from 'vitest'
import { mjmlTemplate } from '../src/index.js'

describe('@emailrpc/mjml (stub)', () => {
  it('returns an adapter that throws not-implemented at render time', async () => {
    const adapter = mjmlTemplate<{ name: string }>('<mjml></mjml>')
    await expect(adapter.render({ name: 'x' })).rejects.toThrow(/not implemented/)
  })
})
