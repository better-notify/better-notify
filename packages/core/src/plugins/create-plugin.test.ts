import { describe, it, expect, vi } from 'vitest';
import { createPlugin } from './create-plugin.js';

describe('createPlugin', () => {
  it('returns the plugin object unchanged', () => {
    const plugin = createPlugin({
      name: 'test',
      middleware: [],
    });
    expect(plugin.name).toBe('test');
    expect(plugin.middleware).toEqual([]);
  });

  it('preserves hooks', () => {
    const onError = vi.fn();
    const plugin = createPlugin({
      name: 'with-hooks',
      hooks: { onError },
    });
    expect(plugin.hooks?.onError).toBe(onError);
  });

  it('preserves lifecycle callbacks', () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    const plugin = createPlugin({
      name: 'lifecycle',
      onCreate,
      onClose,
    });
    expect(plugin.onCreate).toBe(onCreate);
    expect(plugin.onClose).toBe(onClose);
  });

  it('works with only a name', () => {
    const plugin = createPlugin({ name: 'minimal' });
    expect(plugin.name).toBe('minimal');
    expect(plugin.middleware).toBeUndefined();
    expect(plugin.hooks).toBeUndefined();
  });
});
