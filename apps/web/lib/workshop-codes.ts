/**
 * Workshop code format helpers.
 *
 * 6 chars from a 30-character "no-confusables" alphabet:
 *   A-Z minus I, L, O, U  (22 letters)
 *   2-9                    (8 digits)
 *
 * 30^6 = 729,000,000 possible codes.
 * ~700× harder to brute force than a 6-digit numeric.
 *
 * Display as XXX-XXX with a hyphen for readability.
 * Storage is uppercase, no hyphen.
 */

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
export const CODE_LENGTH = 6

export function generateCode(): string {
  // CSPRNG — Math.random() is predictable; these codes grant vehicle
  // write/agent access, so they get cryptographic randomness. Web
  // Crypto is used (not node:crypto) because this module is also
  // imported by client components for formatCode/normalizeCode.
  // Rejection sampling avoids modulo bias.
  const out: string[] = []
  const max = 256 - (256 % CODE_ALPHABET.length) // 240 for a 30-char alphabet
  while (out.length < CODE_LENGTH) {
    const buf = new Uint8Array(CODE_LENGTH * 2)
    globalThis.crypto.getRandomValues(buf)
    for (const b of buf) {
      if (b < max && out.length < CODE_LENGTH) {
        out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]!)
      }
    }
  }
  return out.join('')
}

export function formatCode(code: string): string {
  if (code.length !== CODE_LENGTH) return code
  return code.slice(0, 3) + '-' + code.slice(3)
}

export function normalizeCode(input: string): string | null {
  if (!input) return null
  const cleaned = input.replace(/[-\s]/g, '').toUpperCase()
  if (cleaned.length !== CODE_LENGTH) return null
  for (const ch of cleaned) {
    if (!CODE_ALPHABET.includes(ch)) return null
  }
  return cleaned
}

export function isValidCodeShape(input: string): boolean {
  return normalizeCode(input) !== null
}
