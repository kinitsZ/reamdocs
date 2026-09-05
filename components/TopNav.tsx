import Link from "next/link";
import { Logo } from "./Logo";
import { SignOutButton } from "./SignOutButton";

interface Props {
  user: { name: string; initials: string };
}

export function TopNav({ user }: Props) {
  return (
    <div
      className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b px-5 py-2.5"
      style={{ background: "var(--ream-surface)", borderColor: "var(--ream-border)" }}
    >
      <Link href="/documents" className="no-underline hover:no-underline">
        <Logo />
      </Link>
      <div className="flex-1" />
      <Link href="/documents" className="text-[13px] no-underline" style={{ color: "var(--ream-ink-soft)" }}>
        Documents
      </Link>
      <div
        className="flex items-center gap-2 border-l pl-3"
        style={{ borderColor: "var(--ream-border)" }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ background: "var(--ream-accent)" }}
        >
          {user.initials}
        </div>
        <div className="text-[13px]" style={{ color: "var(--ream-ink-soft)" }}>
          {user.name}
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
