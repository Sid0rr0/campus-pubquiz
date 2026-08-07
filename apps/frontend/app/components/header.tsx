import Link from 'next/link';

export function Header({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between px-4 py-4">
      <Link href="/" className="font-display text-lg text-magenta">
        Campus Pub Quiz
      </Link>
      <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
        {children}
      </div>
    </header>
  );
}
