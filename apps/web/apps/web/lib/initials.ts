/**
 * Derive 1-2 character initials for avatar fallback.
 * Prefers full name; falls back to email local-part; final fallback "?".
 */
export function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || ''
  if (!source) return '?'
  const parts = source.split(/[\s.\-_]+/).filter(Boolean)
  const a = parts[0]
  const b = parts[1]
  if (a && b) {
    return (a.charAt(0) + b.charAt(0)).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}
