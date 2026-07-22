type Props = {
  className?: string;
};

export function LatencymapMark({ className }: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <path d="M8 13.5 24 7l16 6.5v21L24 41 8 34.5v-21Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m11.5 17 12.5 5 12.5-5M24 22v15.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="22" r="5.75" fill="currentColor" />
      <path d="M21.5 22h5M24 19.5v5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
