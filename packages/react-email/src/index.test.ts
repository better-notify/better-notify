import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { reactEmail } from './index.js';

const Welcome = ({ name }: { name: string }): ReactElement =>
  createElement(
    'html',
    null,
    createElement('body', null, createElement('h1', null, `Hello, ${name}!`)),
  );

describe('reactEmail', () => {
  it('produces html only by default', async () => {
    const result = await reactEmail(Welcome, { name: 'John' });
    expect(result.html).toContain('Hello, John!');
    expect(result.text).toBeUndefined();
  });

  it('produces both html and text when plainText: true', async () => {
    const result = await reactEmail(Welcome, { name: 'John' }, { plainText: true });
    expect(result.html).toContain('Hello, John!');
    expect(result.text).toBeDefined();
    expect(result.text).toContain('Hello, John!');
    expect(result.text).not.toContain('<h1');
  });

  it('passes resolved props through to the component', async () => {
    const result = await reactEmail(Welcome, { name: 'mapped-name' });
    expect(result.html).toContain('mapped-name');
  });

  it('propagates errors thrown from the component', async () => {
    const Boom: typeof Welcome = () => {
      throw new Error('component boom');
    };
    await expect(reactEmail(Boom, { name: 'John' })).rejects.toThrow('component boom');
  });

  it('pretty: true produces multi-line html', async () => {
    const result = await reactEmail(Welcome, { name: 'John' }, { pretty: true });
    expect(result.html).toContain('\n');
  });

  it('handles UTF-8 props with accents and emoji', async () => {
    const result = await reactEmail(Welcome, { name: 'José García 🌍' });
    expect(result.html).toContain('José García 🌍');
  });

  it('wraps output with XHTML 1.0 Transitional DOCTYPE', async () => {
    const result = await reactEmail(Welcome, { name: 'John' });
    expect(result.html).toMatch(
      /^<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD XHTML 1\.0 Transitional\/\/EN"/,
    );
  });

  it('preserves heading case in plain-text output (NO_UPPERCASE_SELECTORS)', async () => {
    const result = await reactEmail(Welcome, { name: 'World' }, { plainText: true });
    expect(result.text).toContain('Hello, World!');
    expect(result.text).not.toContain('HELLO, WORLD!');
  });

  it('pretty and plainText together produce formatted html and text', async () => {
    const result = await reactEmail(Welcome, { name: 'John' }, { pretty: true, plainText: true });
    expect(result.html).toContain('\n');
    expect(result.text).toBeDefined();
    expect(result.text).toContain('Hello, John!');
  });
});
