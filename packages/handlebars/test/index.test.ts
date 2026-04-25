import { describe, expect, it } from 'vitest'
import { handlebarsTemplate } from '../src/index.js'

describe('@emailrpc/handlebars (stub)', () => {
  it('returns an adapter that throws not-implemented at render time', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('Hello {{name}}')
    await expect(adapter.render({ name: 'x' })).rejects.toThrow(/not implemented/)
  })
})
