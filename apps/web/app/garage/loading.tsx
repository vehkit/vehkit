export default function GarageLoading() {
  return (
    <main className="min-h-[100svh] pb-24">
      <header className="px-6 pt-10 pb-6">
        <p className="nav-pill">vehkit</p>
        <div className="h-9 w-32 bg-iron rounded-DEFAULT mt-1 animate-pulse" />
      </header>
      <div className="max-w-3xl mx-auto px-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="flex justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 bg-iron rounded animate-pulse" />
                <div className="h-6 w-48 bg-iron rounded animate-pulse" />
                <div className="h-3 w-32 bg-iron rounded animate-pulse" />
              </div>
              <div className="h-10 w-20 bg-iron rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
