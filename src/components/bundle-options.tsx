// Rendered only inside client components (it takes an onChange callback).
export const BUNDLES = [1, 3, 5];

export function BundleOptions({ value, onChange }: { value: number | null; onChange: (units: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BUNDLES.map((units) => {
        const active = value === units;
        return (
          <button
            key={units}
            type="button"
            data-units={units}
            aria-pressed={active}
            onClick={() => onChange(units)}
            className={`rounded-xl border px-2 py-3 text-center transition max-[360px]:px-1 ${
              active ? "border-iris bg-lilac-soft" : "border-line bg-white hover:border-ink/30"
            }`}
          >
            <span className="block text-lg font-bold leading-tight tracking-[-0.04em] text-ink">{units}M</span>
            <span className={`block text-[11px] max-[360px]:text-[10px] ${active ? "text-iris" : "text-muted"}`}>AI tokens × {units}</span>
          </button>
        );
      })}
    </div>
  );
}
