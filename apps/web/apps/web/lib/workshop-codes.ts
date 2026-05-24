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
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return s
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
