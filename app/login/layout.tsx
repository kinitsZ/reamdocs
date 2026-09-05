import { Logo } from "@/components/Logo";

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div
        className="flex items-center gap-4 border-b px-5 py-2.5"
        style={{ background: "var(--ream-surface)", borderColor: "var(--ream-border)" }}
      >
        <Logo />
      </div>
      {children}
    </div>
  );
}
