export default function Loading() {
  return (
    <main className="min-h-[100svh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-pill border-2 border-seam border-t-volt animate-spin" />
        <p className="text-xs tracking-widest uppercase text-ash">Loading</p>
      </div>
    </main>
  )
}
