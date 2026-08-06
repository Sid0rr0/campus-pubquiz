import Link from 'next/link';

export function PendingApprovalView() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center text-foreground">
      <p className="font-display text-xl">
        Your account is awaiting admin approval
      </p>
      <p className="text-sm text-foreground/70">
        An existing admin needs to approve your account and assign a role before
        you can log in.
      </p>
      <Link
        href="/login"
        className="mt-2 flex min-h-11 items-center rounded-lg bg-magenta px-4 text-sm font-extrabold text-white"
      >
        Back to login
      </Link>
    </div>
  );
}
