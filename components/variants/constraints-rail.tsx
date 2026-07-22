export function ConstraintsRail({ className }: { className?: string }) {
  return (
    <dl className={className}>
      <div>
        <dt>Method</dt>
        <dd>GET</dd>
      </div>
      <div>
        <dt>Timeout</dt>
        <dd>5 s</dd>
      </div>
      <div>
        <dt>Redirects</dt>
        <dd>3 max</dd>
      </div>
    </dl>
  );
}
