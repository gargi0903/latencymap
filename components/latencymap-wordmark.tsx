import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  inverted?: boolean;
};

const label = "Latency Map";

export function LatencymapWordmark({ className, inverted = false }: Props) {
  return (
    <span
      className={cn(
        "wordmark wordmark--mono wordmark--spaced",
        inverted && "wordmark--inverted",
        className,
      )}
      aria-label={label}
    >
      <span className="wordmark__latency">latency</span>
      <span className="wordmark__map">map</span>
    </span>
  );
}
