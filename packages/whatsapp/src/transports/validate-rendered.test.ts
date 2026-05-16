import { describe, expect, it } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import { validateRenderedWhatsApp } from './validate-rendered.js';
import type { RenderedWhatsApp } from '../types.js';

const ctx = { route: 'whatsapp.test', messageId: 'msg_1' };

describe('validateRenderedWhatsApp', () => {
  it('returns undefined for a valid text message', () => {
    const result = validateRenderedWhatsApp(
      { action: 'text', to: '+5511999999999', body: 'Hi' },
      ctx,
    );
    expect(result).toBeUndefined();
  });

  it('returns VALIDATION error when "to" is empty', () => {
    const result = validateRenderedWhatsApp({ action: 'text', to: '', body: 'Hi' }, ctx);
    expect(result).toBeInstanceOf(NotifyRpcError);
    expect(result?.code).toBe('VALIDATION');
    expect(result?.message).toContain('recipient');
    expect(result?.route).toBe(ctx.route);
    expect(result?.messageId).toBe(ctx.messageId);
  });

  it('returns VALIDATION error when interactive has both buttons and sections', () => {
    const rendered: RenderedWhatsApp = {
      action: 'interactive',
      to: '+5511999999999',
      body: 'Pick',
      buttons: [{ id: 'b', title: 'B' }],
      sections: [{ title: 'S', rows: [{ id: 'r', title: 'R' }] }],
    };
    const result = validateRenderedWhatsApp(rendered, ctx);
    expect(result).toBeInstanceOf(NotifyRpcError);
    expect(result?.code).toBe('VALIDATION');
    expect(result?.message).toContain('both buttons and sections');
  });

  it('returns VALIDATION error when interactive has neither buttons nor sections', () => {
    const result = validateRenderedWhatsApp(
      { action: 'interactive', to: '+5511999999999', body: 'Empty' },
      ctx,
    );
    expect(result).toBeInstanceOf(NotifyRpcError);
    expect(result?.code).toBe('VALIDATION');
    expect(result?.message).toContain('either buttons or sections');
  });

  it('returns VALIDATION error when interactive has empty buttons and empty sections arrays', () => {
    const result = validateRenderedWhatsApp(
      {
        action: 'interactive',
        to: '+5511999999999',
        body: 'Empty arrays',
        buttons: [],
        sections: [],
      },
      ctx,
    );
    expect(result).toBeInstanceOf(NotifyRpcError);
    expect(result?.message).toContain('either buttons or sections');
  });

  it('returns undefined for valid interactive with buttons only', () => {
    const result = validateRenderedWhatsApp(
      {
        action: 'interactive',
        to: '+5511999999999',
        body: 'Pick',
        buttons: [{ id: 'b', title: 'B' }],
      },
      ctx,
    );
    expect(result).toBeUndefined();
  });

  it('returns undefined for valid interactive with sections only', () => {
    const result = validateRenderedWhatsApp(
      {
        action: 'interactive',
        to: '+5511999999999',
        body: 'Pick',
        sections: [{ title: 'S', rows: [{ id: 'r', title: 'R' }] }],
      },
      ctx,
    );
    expect(result).toBeUndefined();
  });
});
