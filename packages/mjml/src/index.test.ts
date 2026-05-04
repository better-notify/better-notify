import { describe, expect, it } from 'vitest';
import { mjmlTemplate } from './index.js';

const MINIMAL_MJML = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{name}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`;

describe('mjmlTemplate', () => {
  it('compiles MJML to responsive HTML and interpolates input', async () => {
    const adapter = mjmlTemplate<{ name: string }>(MINIMAL_MJML);
    const result = await adapter.render({ input: { name: 'John' }, ctx: {} });
    expect(result.html).toContain('Hello John');
    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain('<table');
  });

  it('renders text alternative when provided', async () => {
    const adapter = mjmlTemplate<{ name: string }>(MINIMAL_MJML, {
      text: 'Hello {{name}}',
    });
    const result = await adapter.render({ input: { name: 'Jane' }, ctx: {} });
    expect(result.text).toBe('Hello Jane');
  });

  it('renders subject when provided', async () => {
    const adapter = mjmlTemplate<{ name: string }>(MINIMAL_MJML, {
      subject: 'Welcome, {{name}}!',
    });
    const result = await adapter.render({ input: { name: 'Alice' }, ctx: {} });
    expect(result.subject).toBe('Welcome, Alice!');
  });

  it('supports nested input paths', async () => {
    const mjml = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hi {{user.name}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
    const adapter = mjmlTemplate<{ user: { name: string } }>(mjml);
    const result = await adapter.render({ input: { user: { name: 'Bob' } }, ctx: {} });
    expect(result.html).toContain('Hi Bob');
  });

  it('supports custom helpers', async () => {
    const mjml = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>{{upper name}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
    const adapter = mjmlTemplate<{ name: string }>(mjml, {
      helpers: { upper: (str: string) => str.toUpperCase() },
    });
    const result = await adapter.render({ input: { name: 'alice' }, ctx: {} });
    expect(result.html).toContain('ALICE');
  });

  it('throws on malformed MJML source', () => {
    expect(() => mjmlTemplate('<invalid>not mjml</invalid>')).toThrow(/Malformed MJML/);
  });

  it('throws on MJML with validation errors by default', () => {
    const mjml = `
<mjml>
  <mj-body>
    <mj-invalid>test</mj-invalid>
  </mj-body>
</mjml>`;
    expect(() => mjmlTemplate(mjml)).toThrow(/MJML compilation failed/);
  });

  it('allows validation skip via mjml options', async () => {
    const mjml = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hello {{name}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
    const adapter = mjmlTemplate<{ name: string }>(mjml, {
      mjml: { validationLevel: 'skip' },
    });
    const result = await adapter.render({ input: { name: 'Test' }, ctx: {} });
    expect(result.html).toContain('Hello Test');
  });

  it('supports each blocks', async () => {
    const mjml = `
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        {{#each items}}
        <mj-text>{{this}}</mj-text>
        {{/each}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
    const adapter = mjmlTemplate<{ items: string[] }>(mjml);
    const result = await adapter.render({ input: { items: ['a', 'b'] }, ctx: {} });
    expect(result.html).toContain('a');
    expect(result.html).toContain('b');
  });
});
