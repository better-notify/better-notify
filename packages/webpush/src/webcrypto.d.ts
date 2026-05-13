type BufferLike = ArrayBuffer | Uint8Array;

type JsonWebKey = {
  alg?: string;
  crv?: string;
  d?: string;
  dp?: string;
  dq?: string;
  e?: string;
  ext?: boolean;
  k?: string;
  key_ops?: string[];
  kty?: string;
  n?: string;
  oth?: { d?: string; r?: string; t?: string }[];
  p?: string;
  q?: string;
  qi?: string;
  use?: string;
  x?: string;
  y?: string;
};

type Algorithm = {
  name: string;
};

type KeyUsage =
  | 'encrypt'
  | 'decrypt'
  | 'sign'
  | 'verify'
  | 'deriveKey'
  | 'deriveBits'
  | 'wrapKey'
  | 'unwrapKey';

type CryptoKey = {
  readonly algorithm: Algorithm;
  readonly extractable: boolean;
  readonly type: 'public' | 'private' | 'secret';
  readonly usages: KeyUsage[];
};

type CryptoKeyPair = {
  readonly privateKey: CryptoKey;
  readonly publicKey: CryptoKey;
};

type SubtleCrypto = {
  generateKey(
    algorithm: Algorithm & { namedCurve?: string },
    extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKeyPair>;
  importKey(
    format: 'jwk',
    keyData: JsonWebKey,
    algorithm: Algorithm & { namedCurve?: string; hash?: string | Algorithm; length?: number },
    extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKey>;
  importKey(
    format: 'raw',
    keyData: BufferLike,
    algorithm: Algorithm & { namedCurve?: string; hash?: string | Algorithm; length?: number },
    extractable: boolean,
    keyUsages: string[],
  ): Promise<CryptoKey>;
  exportKey(format: 'raw', key: CryptoKey): Promise<ArrayBuffer>;
  exportKey(format: 'jwk', key: CryptoKey): Promise<JsonWebKey>;
  sign(
    algorithm: string | (Algorithm & { hash?: string | Algorithm }),
    key: CryptoKey,
    data: BufferLike,
  ): Promise<ArrayBuffer>;
  deriveBits(
    algorithm: { name: string; public: CryptoKey },
    baseKey: CryptoKey,
    length: number,
  ): Promise<ArrayBuffer>;
  encrypt(
    algorithm: Algorithm & { iv?: BufferLike },
    key: CryptoKey,
    data: BufferLike,
  ): Promise<ArrayBuffer>;
  decrypt(
    algorithm: Algorithm & { iv?: BufferLike },
    key: CryptoKey,
    data: BufferLike,
  ): Promise<ArrayBuffer>;
};

type Crypto = {
  readonly subtle: SubtleCrypto;
  getRandomValues<T extends Uint8Array>(array: T): T;
};

declare const crypto: Crypto;

type HeadersInit = [string, string][] | Record<string, string> | Headers;
