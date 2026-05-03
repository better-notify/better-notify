import { describe, expect, it } from 'vitest';
import { escapeMarkdownV2, md } from './escape.js';

describe('escapeMarkdownV2', () => {
  it('escapes all MarkdownV2 special characters', () => {
    expect(escapeMarkdownV2('hello.world')).toBe('hello\\.world');
    expect(escapeMarkdownV2('v2.4.0')).toBe('v2\\.4\\.0');
    expect(escapeMarkdownV2('a_b*c[d]e(f)g~h`i>j#k+l-m=n|o{p}q!r')).toBe(
      'a\\_b\\*c\\[d\\]e\\(f\\)g\\~h\\`i\\>j\\#k\\+l\\-m\\=n\\|o\\{p\\}q\\!r',
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeMarkdownV2('hello world')).toBe('hello world');
  });

  it('escapes backslash itself', () => {
    expect(escapeMarkdownV2('path\\to')).toBe('path\\\\to');
  });

  it('handles empty string', () => {
    expect(escapeMarkdownV2('')).toBe('');
  });
});

describe('md tagged template', () => {
  it('escapes interpolated values fully', () => {
    const version = '2.4.0';
    const result = md`*bold* v${version}`;
    expect(result).toBe('*bold* v2\\.4\\.0');
  });

  it('preserves formatting characters in template strings', () => {
    const name = 'my_service';
    const result = md`*${name}* is running`;
    expect(result).toBe('*my\\_service* is running');
  });

  it('escapes non-formatting reserved chars in template strings', () => {
    const service = 'api';
    const result = md`# Alert! ${service} is down.`;
    expect(result).toBe('\\# Alert\\! api is down\\.');
  });

  it('handles multiple interpolations', () => {
    const service = 'api';
    const version = '1.0.0';
    const status = 'healthy!';
    const result = md`*${service}* deployed v${version} Status: ${status}`;
    expect(result).toBe('*api* deployed v1\\.0\\.0 Status: healthy\\!');
  });

  it('handles no interpolations', () => {
    const result = md`
_bold_ _italic_
    `;
    expect(result).toBe('*bold* _italic_');
  });

  it('coerces non-string values to string', () => {
    const count = 42;
    const result = md`count: ${count}`;
    expect(result).toBe('count: 42');
  });

  it('preserves link syntax in template', () => {
    const url = 'https://example.com/path?a=1&b=2';
    const result = md`[click here](${url})`;
    expect(result).toBe('[click here](https://example\\.com/path?a\\=1&b\\=2)');
  });
});
