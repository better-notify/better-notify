import { describe, expect, it } from 'vitest';
import { generateVapidKeys, createVapidJwt, encryptPayload } from './crypto.js';

const toBase64Url = (buf: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const concat = (...buffers: Uint8Array[]): Uint8Array => {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
};

describe('generateVapidKeys', () => {
  it('generates a valid key pair', async () => {
    const keys = await generateVapidKeys();
    expect(typeof keys.publicKey).toBe('string');
    expect(typeof keys.privateKey).toBe('string');
    expect(keys.publicKey.length).toBeGreaterThan(0);
    expect(keys.privateKey.length).toBeGreaterThan(0);
  });

  it('generates unique key pairs', async () => {
    const a = await generateVapidKeys();
    const b = await generateVapidKeys();
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.privateKey).not.toBe(b.privateKey);
  });
});

describe('createVapidJwt', () => {
  it('produces a valid VAPID authorization header', async () => {
    const keys = await generateVapidKeys();
    const result = await createVapidJwt(
      'https://fcm.googleapis.com/fcm/send/abc',
      'mailto:test@example.com',
      keys.privateKey,
      keys.publicKey,
    );
    expect(result.authorization).toMatch(/^vapid t=.+,k=.+$/);
  });

  it('JWT contains correct audience', async () => {
    const keys = await generateVapidKeys();
    const result = await createVapidJwt(
      'https://fcm.googleapis.com/fcm/send/abc',
      'mailto:test@example.com',
      keys.privateKey,
      keys.publicKey,
    );
    const jwt = result.authorization.replace('vapid t=', '').split(',k=')[0]!;
    const parts = jwt.split('.');
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    expect(payload.aud).toBe('https://fcm.googleapis.com');
    expect(payload.sub).toBe('mailto:test@example.com');
    expect(typeof payload.exp).toBe('number');
  });
});

describe('encryptPayload', () => {
  it('encrypts a payload for a subscription', async () => {
    const receiverKeys = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', receiverKeys.publicKey));
    const authBytes = crypto.getRandomValues(new Uint8Array(16));

    const result = await encryptPayload(
      JSON.stringify({ title: 'Test', body: 'Hello' }),
      toBase64Url(rawPublic),
      toBase64Url(authBytes),
    );

    expect(result.ciphertext).toBeInstanceOf(Uint8Array);
    expect(result.ciphertext.length).toBeGreaterThan(0);
    expect(result.serverPublicKey).toBeInstanceOf(Uint8Array);
    expect(result.serverPublicKey.length).toBe(65);
  });

  it('round-trips: decrypt matches original plaintext', async () => {
    const receiverKeys = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const receiverPublicRaw = new Uint8Array(
      await crypto.subtle.exportKey('raw', receiverKeys.publicKey),
    );
    const authSecret = crypto.getRandomValues(new Uint8Array(16));

    const plaintext = JSON.stringify({ title: 'Round-trip', body: 'Verify me' });
    const { ciphertext } = await encryptPayload(
      plaintext,
      toBase64Url(receiverPublicRaw),
      toBase64Url(authSecret),
    );

    const salt = ciphertext.slice(0, 16);
    const rs = new DataView(ciphertext.buffer, ciphertext.byteOffset).getUint32(16);
    expect(rs).toBe(4096);
    const keyIdLen = ciphertext[20]!;
    expect(keyIdLen).toBe(65);
    const senderPublicKeyRaw = ciphertext.slice(21, 21 + keyIdLen);
    const encryptedBody = ciphertext.slice(21 + keyIdLen);

    const senderPublicKey = await crypto.subtle.importKey(
      'raw',
      senderPublicKeyRaw,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      [],
    );

    const sharedSecret = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'ECDH', public: senderPublicKey },
        receiverKeys.privateKey,
        256,
      ),
    );

    const encoder = new TextEncoder();
    const ikmInfo = concat(
      encoder.encode('WebPush: info\0'),
      receiverPublicRaw,
      senderPublicKeyRaw,
    );

    const hkdfExtract = async (hkdfSalt: Uint8Array, ikm: Uint8Array) => {
      const key = await crypto.subtle.importKey(
        'raw',
        hkdfSalt.length > 0 ? hkdfSalt : new Uint8Array(32),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
    };

    const hkdfExpand = async (prk: Uint8Array, info: Uint8Array, length: number) => {
      const key = await crypto.subtle.importKey(
        'raw',
        prk,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const expanded = new Uint8Array(
        await crypto.subtle.sign('HMAC', key, concat(info, new Uint8Array([1]))),
      );
      return expanded.slice(0, length);
    };

    const ikmPrk = await hkdfExtract(authSecret, sharedSecret);
    const ikm = await hkdfExpand(ikmPrk, ikmInfo, 32);

    const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
    const nonceInfo = encoder.encode('Content-Encoding: nonce\0');

    const cekPrk = await hkdfExtract(salt, ikm);
    const cek = await hkdfExpand(cekPrk, cekInfo, 16);
    const nonce = await hkdfExpand(cekPrk, nonceInfo, 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, [
      'decrypt',
    ]);
    const decrypted = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aesKey, encryptedBody),
    );

    const lastByte = decrypted[decrypted.length - 1];
    expect(lastByte).toBe(2);
    const decoded = new TextDecoder().decode(decrypted.slice(0, -1));
    expect(decoded).toBe(plaintext);
  });
});
