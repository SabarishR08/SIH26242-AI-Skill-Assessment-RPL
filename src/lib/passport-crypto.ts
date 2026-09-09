import crypto from "crypto";

const pkcs8Prefix = Buffer.from("302e020100300506032b657004220420", "hex");
const seed = crypto
  .createHash("sha256")
  .update(process.env.PASSPORT_SIGNING_KEY || "pathfinder-authority-master-seed-2026")
  .digest();

export const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([pkcs8Prefix, seed]),
  format: "der",
  type: "pkcs8",
});

export const publicKey = crypto.createPublicKey(privateKey);
export const publicJwk = publicKey.export({ format: "jwk" }) as {
  kty: string;
  crv: string;
  x: string;
};

export function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf-8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Sign a payload with Ed25519 producing a valid JWS.
 */
export function signEd25519(payload: string): string {
  const header = { alg: "EdDSA", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(payload);
  const dataToSign = Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf-8");
  const signature = crypto.sign(null, dataToSign, privateKey);
  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

/**
 * Verify a JWS string using the Ed25519 public key.
 */
export function verifyEd25519(jws: string): boolean {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) return false;
    const dataToVerify = Buffer.from(`${parts[0]}.${parts[1]}`, "utf-8");
    const signature = Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64");
    return crypto.verify(null, dataToVerify, publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * Generate a standard W3C DID document for the current host.
 */
export function getDidDocument(host: string) {
  const cleanHost = host.split(":")[0];
  const did = `did:web:${cleanHost}`;
  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1",
    ],
    id: did,
    verificationMethod: [
      {
        id: `${did}#key-1`,
        type: "Ed25519VerificationKey2020",
        controller: did,
        publicKeyJwk: publicJwk,
      },
    ],
    authentication: [`${did}#key-1`],
    assertionMethod: [`${did}#key-1`],
  };
}
