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
});
