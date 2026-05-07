'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
    >
      Save as PDF →
    </button>
  )
}
