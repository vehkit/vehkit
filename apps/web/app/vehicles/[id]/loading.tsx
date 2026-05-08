export default function VehicleLoading() {
  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <div className="h-3 w-16 bg-iron rounded animate-pulse" />

        {/* Hero photo skeleton */}
        <div className="mt-4 w-full aspect-[16/9] bg-iron rounded-DEFAULT animate-pulse" />

        {/* Hero card skeleton */}
        <div className="card p-6 md:p-8 mt-4 space-y-3">
          <div className="h-3 w-20 bg-iron rounded animate-pulse" />
          <div className="h-12 w-3/4 bg-iron rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-iron rounded animate-pulse" />
          <div className="pt-6 border-t border-seam">
            <div className="h-3 w-16 bg-iron rounded animate-pulse" />
            <div className="h-12 w-40 bg-iron rounded animate-pulse mt-2" />
          </div>
        </div>

        {/* Timeline skeleton */}
        <div className="mt-10 space-y-3">
          <div className="h-3 w-32 bg-iron rounded animate-pulse" />
          {[1, 2].map((i) => (
            <div key={i} className="card p-5 space-y-2">
              <div className="h-4 w-32 bg-iron rounded animate-pulse" />
              <div className="h-3 w-48 bg-iron rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
