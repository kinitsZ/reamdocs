export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 rounded-[5px]" style={{ background: "var(--ream-accent)" }} />
      <div
        className="text-[20px] font-semibold"
        style={{ fontFamily: "var(--font-doc)", letterSpacing: "-0.01em" }}
      >
        Ream
      </div>
      <div className="font-mono text-[11px]" style={{ color: "var(--ream-ink-faint)" }}>
        docs
      </div>
    </div>
  );
}
