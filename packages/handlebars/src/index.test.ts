import { describe, expect, it } from 'vitest';
import { handlebarsTemplate } from './index.js';

describe('handlebarsTemplate', () => {
  it('renders html with input data', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('<h1>Hello {{name}}</h1>');
    const result = await adapter.render({ input: { name: 'John' }, ctx: {} });
    expect(result.html).toBe('<h1>Hello John</h1>');
    expect(result.text).toBeUndefined();
    expect(result.subject).toBeUndefined();
  });

  it('renders text alternative when provided', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('<h1>Hello {{name}}</h1>', {
      text: 'Hello {{name}}',
    });
    const result = await adapter.render({ input: { name: 'Jane' }, ctx: {} });
    expect(result.html).toBe('<h1>Hello Jane</h1>');
    expect(result.text).toBe('Hello Jane');
  });

  it('renders subject when provided', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('<p>Welcome</p>', {
      subject: 'Welcome, {{name}}!',
    });
    const result = await adapter.render({ input: { name: 'Alice' }, ctx: {} });
    expect(result.subject).toBe('Welcome, Alice!');
  });

  it('supports nested object paths', async () => {
    const adapter = handlebarsTemplate<{ user: { name: string } }>('<p>Hi {{user.name}}</p>');
    const result = await adapter.render({ input: { user: { name: 'Bob' } }, ctx: {} });
    expect(result.html).toBe('<p>Hi Bob</p>');
  });

  it('supports custom helpers', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('<p>{{upper name}}</p>', {
      helpers: { upper: (str: string) => str.toUpperCase() },
    });
    const result = await adapter.render({ input: { name: 'alice' }, ctx: {} });
    expect(result.html).toBe('<p>ALICE</p>');
  });

  it('supports partials', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('<div>{{> greeting}}</div>', {
      partials: { greeting: '<span>Hello {{name}}</span>' },
    });
    const result = await adapter.render({ input: { name: 'Eve' }, ctx: {} });
    expect(result.html).toBe('<div><span>Hello Eve</span></div>');
  });

  it('supports each blocks for lists', async () => {
    const adapter = handlebarsTemplate<{ items: string[] }>(
      '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
    );
    const result = await adapter.render({ input: { items: ['a', 'b', 'c'] }, ctx: {} });
    expect(result.html).toBe('<ul><li>a</li><li>b</li><li>c</li></ul>');
  });

  it('supports conditional blocks', async () => {
    const adapter = handlebarsTemplate<{ show: boolean }>('{{#if show}}<p>visible</p>{{/if}}');
    const shown = await adapter.render({ input: { show: true }, ctx: {} });
    expect(shown.html).toBe('<p>visible</p>');
    const hidden = await adapter.render({ input: { show: false }, ctx: {} });
    expect(hidden.html).toBe('');
  });

  it('preserves explicit empty text/subject templates', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('<h1>Hello {{name}}</h1>', {
      text: '',
      subject: '',
    });
    const result = await adapter.render({ input: { name: 'Jane' }, ctx: {} });
    expect(result.text).toBe('');
    expect(result.subject).toBe('');
  });

  it('accepts a pre-configured handlebars instance', async () => {
    const { default: Handlebars } = await import('handlebars');
    const hbs = Handlebars.create();
    hbs.registerHelper('shout', (str: string) => `${str.toUpperCase()}!!!`);

    const adapter = handlebarsTemplate<{ name: string }>('<p>{{shout name}}</p>', {
      handlebars: hbs,
    });
    const result = await adapter.render({ input: { name: 'hey' }, ctx: {} });
    expect(result.html).toBe('<p>HEY!!!</p>');
  });
});
