import Link from "next/link";
import { LatencymapWordmark } from "@/components/latencymap-wordmark";

type Props = {
  id: string;
  title: string;
  inverted?: boolean;
};

export function VariantToolbar({ id, title, inverted }: Props) {
  return (
    <header className="variant-toolbar">
      <Link href="/" className="variant-toolbar__back">
        ← Versions
      </Link>
      <p className="variant-toolbar__label">
        <span className="variant-toolbar__id">{id}</span>
        {title}
      </p>
      <LatencymapWordmark inverted={inverted} className="variant-toolbar__mark" />
    </header>
  );
}
