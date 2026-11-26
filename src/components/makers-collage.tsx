// A loose collage of what creators get: README badges, a support page and a payment, gently floating.

function Badge({ count }: { count: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 shadow-[0_8px_20px_-12px_rgba(28,28,30,0.45)]">
      <span className="grid size-5 place-items-center rounded-full bg-lilac">
        <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden>
          <path
            d="M5.5 4.75 2.25 8l3.25 3.25M10.5 4.75 13.75 8l-3.25 3.25M9 3.25 7 12.75"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="whitespace-nowrap text-[11px] font-semibold">Buy me AI tokens</span>
      <span className="h-3 w-px bg-line" />
      <span className="text-[11px] font-bold tabular-nums text-iris">{count}</span>
    </span>
  );
}

function Readme({ name, about, count }: { name: string; about: string; count: string }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-30px_rgba(28,28,30,0.55)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-paper px-3.5 py-2">
        <span className="size-1.5 rounded-full bg-line" />
        <span className="size-1.5 rounded-full bg-line" />
        <span className="size-1.5 rounded-full bg-line" />
        <span className="ml-1.5 font-mono text-[10px] text-muted">README.md</span>
      </div>
      <div className="p-4">
        <p className="font-display text-lg font-semibold tracking-[-0.03em]">{name}</p>
        <p className="mt-0.5 text-[11px] text-muted">{about}</p>
        <div className="mt-3">
          <Badge count={count} />
        </div>
      </div>
    </div>
  );
}

const float = "motion-safe:animate-[float_6s_ease-in-out_infinite_alternate]";

export function MakersCollage() {
  return (
    // On phones the cards are stacked further apart, so none of them covers another's text.
    <div aria-hidden className="relative mx-auto h-[500px] w-full max-w-[560px] select-none sm:h-[480px]">
      <div className={`absolute left-0 top-2 w-[min(280px,80%)] -rotate-[4deg] sm:w-[min(280px,72%)] ${float}`}>
        <Readme name="tiny-cli" about="Zero-config CLI scaffolder" count="131M" />
      </div>

      <div className={`absolute right-0 top-[172px] w-[min(250px,72%)] rotate-[3deg] sm:top-16 sm:w-[min(250px,64%)] ${float} [animation-delay:-2s]`}>
        <div className="rounded-2xl bg-white p-4 shadow-[0_30px_60px_-30px_rgba(28,28,30,0.55)]">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-lilac text-xs font-bold">MH</span>
            <div>
              <p className="text-sm font-semibold">Mira Holt</p>
              <p className="text-[10px] text-muted">Maintainer, vectorlite</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            {[1, 3, 5].map((u) => (
              <span
                key={u}
                className={`rounded-lg border py-1.5 text-[12px] font-bold ${u === 3 ? "border-iris bg-lilac-soft" : "border-line"}`}
              >
                {u}M
              </span>
            ))}
          </div>
          <span className="mt-2.5 block rounded-full bg-iris py-2 text-center text-[11px] font-semibold text-white">
            Support with $15
          </span>
        </div>
      </div>

      <div className={`absolute left-0 top-[340px] w-[min(310px,96%)] -rotate-[2deg] sm:top-[250px] sm:w-[min(310px,84%)] ${float} [animation-delay:-4s]`}>
        <div className="flex items-center gap-3 rounded-2xl bg-ink p-3.5 text-white shadow-[0_30px_60px_-30px_rgba(28,28,30,0.7)]">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-fuel text-[12px] font-bold text-ink">J</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-snug sm:truncate">Jonas bought you 5M AI tokens</p>
            <p className="text-[11px] text-white/55 sm:truncate">to your USDC wallet · just now</p>
          </div>
          <span className="font-display text-lg font-semibold text-emerald-400">+$25</span>
        </div>
      </div>

      <div className={`absolute bottom-2 right-[2%] hidden w-[min(240px,62%)] rotate-[4deg] sm:block ${float} [animation-delay:-1s]`}>
        <Readme name="vectorlite" about="Vector search for SQLite" count="89M" />
      </div>

      <div className={`absolute bottom-4 right-[4%] -rotate-[6deg] sm:bottom-10 sm:left-[4%] sm:right-auto ${float} [animation-delay:-3s]`}>
        <span className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-display text-lg font-semibold tracking-[-0.02em] text-white shadow-[0_24px_50px_-24px_rgba(28,28,30,0.8)] sm:text-xl">
          <span className="text-fuel">0%</span> platform fee
        </span>
      </div>
    </div>
  );
}
