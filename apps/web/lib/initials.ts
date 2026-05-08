/**
 * Derive 1-2 character initials for avatar fallback.
 * Prefers full name; falls back to email local-part; final fallback "?".
 */
export function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || ''
  if (!source) return '?'
  const parts = source.split(/[\s.\-_]+/).filter(Boolean)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}
