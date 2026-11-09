import Image from 'next/image';
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
      className={`relative h-(--site-header-height) items-center justify-between gap-4 px-4 ${isHiddenOnMobile ? 'hidden md:flex' : 'flex'}`}
    >
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 rounded-lg font-display text-display-xl font-extrabold text-magenta focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-magenta"
      >
        <Image src="/cpq.svg" alt="" width={40} height={40} priority />
        Campus Pub Quiz
      </Link>
      {center && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {center}
        </div>
      )}
      <div className="flex items-center gap-3 text-display-sm font-extrabold tracking-wide">
        {children}
      </div>
    </header>
  );
}
