const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (str: string): Uint8Array => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + '='.repeat(padding));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

const hkdf = async (
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> => {
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));
  const infoKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = new Uint8Array(
    await crypto.subtle.sign('HMAC', infoKey, concat(info, new Uint8Array([1]))),
  );
  return signed.slice(0, length);
};

const createContentInfo = (type: string): Uint8Array =>
  encoder.encode(`Content-Encoding: ${type}\0`);

export const createVapidJwt = async (
  endpoint: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string,
  expSeconds = 12 * 60 * 60,
): Promise<{ authorization: string }> => {
  const origin = new URL(endpoint).origin;
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: origin,
        exp: Math.floor(Date.now() / 1000) + expSeconds,
        sub: subject,
      }),
    ),
  );

  const privateKeyBytes = fromBase64Url(privateKeyBase64);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: toBase64Url(privateKeyBytes),
    x: toBase64Url(fromBase64Url(publicKeyBase64).slice(1, 33)),
    y: toBase64Url(fromBase64Url(publicKeyBase64).slice(33, 65)),
  };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signingInput = encoder.encode(`${header}.${payload}`);
  const rawSig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, signingInput),
  );
  const jwt = `${header}.${payload}.${toBase64Url(rawSig)}`;

  return {
    authorization: `vapid t=${jwt},k=${publicKeyBase64}`,
  };
};

export const encryptPayload = async (
  payload: string,
  subscriptionPublicKey: string,
  subscriptionAuth: string,
): Promise<{ ciphertext: Uint8Array; serverPublicKey: Uint8Array }> => {
  const clientPublicKeyBytes = fromBase64Url(subscriptionPublicKey);
  const authSecret = fromBase64Url(subscriptionAuth);

  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey),
  );

  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256),
  );

  const ikmInfo = concat(
    encoder.encode('WebPush: info\0'),
    clientPublicKeyBytes,
    serverPublicKeyRaw,
  );
  const ikm = await hkdf(authSecret, sharedSecret, ikmInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(salt, ikm, createContentInfo('aes128gcm'), 16);
  const nonce = await hkdf(salt, ikm, createContentInfo('nonce'), 12);

  const paddedPayload = concat(encoder.encode(payload), new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, [
    'encrypt',
  ]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload),
  );

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = serverPublicKeyRaw.length;

  const ciphertext = concat(header, serverPublicKeyRaw, encrypted);
  return { ciphertext, serverPublicKey: serverPublicKeyRaw };
};

export const generateVapidKeys = async (): Promise<{
  publicKey: string;
  privateKey: string;
}> => {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
  ]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return {
    publicKey: toBase64Url(publicRaw),
    privateKey: privateJwk.d as string,
  };
};
