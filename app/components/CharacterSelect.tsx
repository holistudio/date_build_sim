"use client";

import Image from "next/image";
import type { Guide } from "../lib/guide";

// The first screen: pick who guides the build. The choice is final for
// the visit — the video is seeded with this character's sprite and every
// prompt describes them — so there is no switcher in the game itself.
export function CharacterSelect({
  guides,
  onSelect,
}: {
  guides: ReadonlyArray<Guide>;
  onSelect: (guide: Guide) => void;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="petals" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </div>

      <header className="relative px-4 pt-8 text-center md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-blush-deep md:text-sm">
          PC Build Route ♡
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-ink md:text-5xl">
          Choose your guide
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink/60 md:text-base">
          Who will build the Great Intel Gaming PC with you?
        </p>
      </header>

      <main className="relative mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 content-center gap-5 px-4 py-6 sm:grid-cols-2 md:gap-8 md:py-10">
        {guides.map((g) => (
          <button
            key={g.id}
            onClick={() => onSelect(g)}
            style={{ "--accent": g.color } as React.CSSProperties}
            className="group flex flex-col overflow-hidden rounded-3xl border-2 border-white bg-white text-left shadow-[0_12px_40px_-16px_var(--color-shadow)] transition-all hover:-translate-y-1 hover:border-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none"
          >
            <div className="relative aspect-[4/5] w-full bg-[#d6d6d6] sm:aspect-[3/4]">
              <Image
                src={g.image}
                alt={`${g.name}, full-body portrait`}
                fill
                priority
                sizes="(min-width: 640px) 420px, 100vw"
                className="object-cover object-[50%_8%] transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4 md:p-5">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-2xl font-extrabold md:text-3xl"
                  style={{ color: g.color }}
                >
                  {g.name}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink/50">
                  {g.title}
                </span>
              </div>
              <p className="text-sm text-ink/80 md:text-[15px]">{g.blurb}</p>
              <span
                style={{ backgroundColor: g.color }}
                className="mt-3 self-start rounded-full px-4 py-1.5 text-sm font-extrabold text-white shadow-sm transition-transform group-hover:translate-x-1"
              >
                Build with {g.name} ▶
              </span>
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}
