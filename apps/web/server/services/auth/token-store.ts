// 서명 키와 refresh 세션. 새로고침해도 로그인이 유지되도록 IndexedDB에 둔다(서버 DB 역할).

import { createStore, del, get, set } from "idb-keyval";
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  type CryptoKey as JoseKey,
  type JWK,
} from "jose";

export const ALG = "ES256";

type StoredKey = { kid: string; privateJwk: JWK; publicJwk: JWK };
type SigningKey = { kid: string; privateKey: JoseKey; publicJwk: JWK };

const store = () => createStore("vis-a-lot-auth", "kv");

let signingKey: Promise<SigningKey> | undefined;

/** 처음 한 번 키 쌍을 만들어 저장하고, 이후에는 저장된 키를 쓴다. */
export function getSigningKey() {
  signingKey ??= (async () => {
    let stored = await get<StoredKey>("signing-key", store());
    if (!stored) {
      const { privateKey, publicKey } = await generateKeyPair(ALG, {
        extractable: true,
      });
      const kid = crypto.randomUUID();
      stored = {
        kid,
        privateJwk: await exportJWK(privateKey),
        publicJwk: {
          ...(await exportJWK(publicKey)),
          kid,
          alg: ALG,
          use: "sig",
        },
      };
      await set("signing-key", stored, store());
    }
    const privateKey = (await importJWK(stored.privateJwk, ALG)) as JoseKey;
    return { kid: stored.kid, privateKey, publicJwk: stored.publicJwk };
  })();
  return signingKey;
}

type Session = { sub: string; exp: number };

export function saveSession(jti: string, session: Session) {
  return set(`session:${jti}`, session, store());
}

export async function takeSession(jti: string) {
  const session = await get<Session>(`session:${jti}`, store());
  if (session) await del(`session:${jti}`, store());
  return session;
}

export function dropSession(jti: string) {
  return del(`session:${jti}`, store());
}
