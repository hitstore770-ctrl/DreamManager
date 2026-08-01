// AES-256-CTR encryption for Vault notes, entirely local: aes-js does the
// cipher (pure JS, no native/network dependency), expo-crypto supplies
// cryptographically secure randomness and SHA-256 hashing.
//
// This is "encrypt, then MAC": every ciphertext is paired with a keyed
// checksum (`mac`) computed over key+iv+ciphertext. Decryption recomputes
// and compares that checksum *before* trusting the plaintext, which is what
// catches a wrong PIN or a tampered row -- plain AES-CTR alone has no
// integrity check and would otherwise silently return garbage.
//
// This protects notes if the SQLite file is copied off the device. It is
// not a vetted password-hashing scheme (no Argon2/PBKDF2/scrypt available
// offline here) and not an audited crypto library -- adequate for a local,
// single-user vault, not a claim of military-grade security.
import * as Crypto from "expo-crypto";
import aesjs from "aes-js";

const MAGIC = "SBVAULT1:";
const KDF_ITERATIONS = 3000;
export const VAULT_VERIFIER_PLAINTEXT = "second-brain-vault-verifier";

async function sha256Hex(str) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, str, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

// PIN -> 256-bit key, stretched with salted, iterated SHA-256.
export async function deriveVaultKey(pin) {
  let hex = String(pin);
  for (let i = 0; i < KDF_ITERATIONS; i++) {
    hex = await sha256Hex(`${hex}:second-brain-vault:${i}`);
  }
  return aesjs.utils.hex.toBytes(hex);
}

async function macFor(keyBytes, ivHex, cipherHex) {
  return sha256Hex(`${aesjs.utils.hex.fromBytes(keyBytes)}:${ivHex}:${cipherHex}`);
}

export async function encryptText(plainText, keyBytes) {
  const ivBytes = await Crypto.getRandomBytesAsync(16);
  const ivHex = aesjs.utils.hex.fromBytes(ivBytes);
  const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(ivBytes));
  const cipherBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(MAGIC + plainText));
  const cipherHex = aesjs.utils.hex.fromBytes(cipherBytes);
  const mac = await macFor(keyBytes, ivHex, cipherHex);
  return { cipherHex, ivHex, mac };
}

// Returns the plaintext, or null if the key/PIN is wrong (MAC or magic
// prefix mismatch) rather than throwing -- callers treat null as "wrong PIN".
export async function decryptText(cipherHex, ivHex, mac, keyBytes) {
  if (!cipherHex || !ivHex || !mac) return null;
  const expectedMac = await macFor(keyBytes, ivHex, cipherHex);
  if (expectedMac !== mac) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(aesjs.utils.hex.toBytes(ivHex)));
  const bytes = cipher.decrypt(aesjs.utils.hex.toBytes(cipherHex));
  let text;
  try {
    text = aesjs.utils.utf8.fromBytes(bytes);
  } catch {
    return null;
  }
  if (!text.startsWith(MAGIC)) return null;
  return text.slice(MAGIC.length);
}
