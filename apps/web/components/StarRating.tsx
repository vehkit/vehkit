/**
 * Read-only star rating display.
 * For interactive input, see ReviewForm.
 */
export function StarRating({
  rating,
  size = 'sm',
}: {
  rating: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const filled = Math.round(rating)
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-base' : 'text-xs'

  return (
    <span
      className={`font-mono tracking-tight ${sizeClass}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= filled ? 'text-wallet' : 'text-seam'}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  )
}
