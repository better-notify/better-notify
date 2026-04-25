import { describe, expect, it } from 'vitest'
import { ses, sesAdapter } from '../src/index.js'

describe('@emailrpc/ses (stub)', () => {
  it('ses() throws not-implemented', () => {
    expect(() => ses({ region: 'eu-west-1' })).toThrow(/not implemented/)
  })

  it('sesAdapter() throws not-implemented', () => {
    expect(() => sesAdapter()).toThrow(/not implemented/)
  })
})
