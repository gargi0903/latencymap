import Link from "next/link";
import { LatencymapWordmark } from "@/components/latencymap-wordmark";
import { VARIANT_LIST } from "@/components/variants/registry";
import { cn } from "@/lib/utils";

export function VariantPicker() {
  return (
    <main className="picker">
      <header className="picker__header">
        <LatencymapWordmark className="text-[clamp(1.35rem,3vw,2rem)]" />
        <p className="picker__lede">
          Five interactive UI versions of the same tool. Pick one — paste a URL, run a real test, see the globe.
        </p>
      </header>

      <ol className="picker__list">
        {VARIANT_LIST.map((variant) => (
          <li key={variant.id}>
            <Link
              href={`/v/${variant.id}`}
              className={cn("picker__card", variant.id === "4" && "picker__card--chosen")}
            >
              <span className="picker__id">{variant.id}</span>
              <span className="picker__body">
                <span className="picker__title">{variant.title}</span>
                <span className="picker__summary">{variant.summary}</span>
              </span>
              <span className="picker__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
