import Link from "next/link";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-sm p-8 shadow-2xl">
        <Link href="/" className="mb-6 block text-center">
          <div aria-hidden className="text-4xl">🌙</div>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-3">{subtitle}</p>
        </Link>
        {children}
      </div>
    </main>
  );
}
