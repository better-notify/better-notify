import { describe, expect, it } from 'vitest';
import { collectInputSchemaOverrides } from './list-overrides.js';

describe('collectInputSchemaOverrides', () => {
  it('returns an empty map when inputSchemas is undefined', () => {
    expect(collectInputSchemaOverrides(['a', 'b'], undefined).size).toBe(0);
  });

  it('skips routes that have no entry in inputSchemas', () => {
    const result = collectInputSchemaOverrides(['a', 'b'], { a: { type: 'object' } });
    expect(result.has('a.send')).toBe(true);
    expect(result.has('a.render')).toBe(true);
    expect(result.has('b.send')).toBe(false);
  });

  it('creates send and render entries for every overridden route', () => {
    const schema = { type: 'object', properties: {} };
    const result = collectInputSchemaOverrides(['welcome'], { welcome: schema });
    expect(result.get('welcome.send')).toBe(schema);
    expect(result.get('welcome.render')).toBe(schema);
  });

  it('ignores routes in inputSchemas that are not in the route list', () => {
    const result = collectInputSchemaOverrides(['welcome'], { stranger: { type: 'object' } });
    expect(result.size).toBe(0);
  });
});
