import { describe, it, expect } from "vitest";
import { signEd25519, verifyEd25519, getDidDocument, publicJwk } from "./passport-crypto";

describe("Passport Cryptography (NEW-03)", () => {
  it("generates a genuine Ed25519 JWS and verifies it", () => {
    const payload = JSON.stringify({
      learner: "did:pathfinder:learner:123",
      skills: ["Python", "Machine Learning"],
      issuedAt: "2026-09-09T00:00:00.000Z",
    });

    const jws = signEd25519(payload);
    expect(jws.split(".")).toHaveLength(3);
    expect(jws).not.toContain("...");

    const isValid = verifyEd25519(jws);
    expect(isValid).toBe(true);

    // Tampering with payload should fail verification
    const parts = jws.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ learner: "attacker" })).toString("base64url");
    const tamperedJws = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect(verifyEd25519(tamperedJws)).toBe(false);
  });

  it("produces a valid W3C DID document containing the Ed25519 public key", () => {
    const host = "pathfinder-ai-61aq.onrender.com";
    const didDoc = getDidDocument(host);

    expect(didDoc.id).toBe(`did:web:${host}`);
    expect(didDoc.verificationMethod[0].controller).toBe(`did:web:${host}`);
    expect(didDoc.verificationMethod[0].publicKeyJwk).toEqual(publicJwk);
    expect(didDoc.assertionMethod).toContain(`did:web:${host}#key-1`);
  });
});
