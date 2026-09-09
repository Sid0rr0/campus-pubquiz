import Link from 'next/link';

interface HeaderProps {
  children: React.ReactNode;
  /** Hides the bar below the md breakpoint — used on /control, whose mobile drawer already surfaces the same nav. */
  isHiddenOnMobile?: boolean;
  /** Optional content pinned to the exact horizontal center of the bar, absolutely positioned so it doesn't shift with the width of the logo or `children`. */
  center?: React.ReactNode;
}

export function Header({
  children,
  isHiddenOnMobile = false,
  center,
}: HeaderProps) {
  return (
    <header
      className={`relative h-(--site-header-height) items-center justify-between px-4 ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      <Link
        href="/"
        className="font-display text-xl font-extrabold text-magenta"
      >
        Campus Pub Quiz
      </Link>
      {center && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {center}
        </div>
      )}
      <div className="flex items-center gap-3 text-sm font-extrabold tracking-wide">
        {children}
      </div>
    </header>
  );
}
