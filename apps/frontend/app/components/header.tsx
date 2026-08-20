import Link from 'next/link';

interface HeaderProps {
  children: React.ReactNode;
  /** Hides the bar below the md breakpoint — used on /admin, whose mobile drawer already surfaces the same nav. */
  isHiddenOnMobile?: boolean;
}

export function Header({ children, isHiddenOnMobile = false }: HeaderProps) {
  return (
    <header
      className={`h-(--site-header-height) items-center justify-between px-4 ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      <Link
        href="/"
        className="font-display text-xl font-extrabold text-magenta"
      >
        Campus Pub Quiz
      </Link>
      <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
        {children}
      </div>
    </header>
  );
}
