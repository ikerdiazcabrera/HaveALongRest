/** Esqueleto mostrado al instante mientras llega la página (loading.tsx). */
export function PageSkeleton() {
  return (
    <div className="panel animate-pulse p-5 sm:p-8" aria-busy="true" aria-label="Cargando página">
      <div className="mb-4 h-3 w-40 rounded bg-card-hover" />
      <div className="mb-6 h-8 w-2/3 rounded bg-card-hover" />
      <div className="mb-8 h-px bg-line" />
      <div className="flex flex-col gap-3">
        {[95, 88, 92, 70, 0, 90, 84, 60].map((w, i) =>
          w ? <div key={i} className="h-3.5 rounded bg-card" style={{ width: `${w}%` }} /> : <div key={i} className="h-3" />,
        )}
      </div>
    </div>
  );
}
