interface PendingApprovalViewProps {
  onLogout: () => void;
}

export function PendingApprovalView({ onLogout }: PendingApprovalViewProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <p className="font-display text-xl">Your account is awaiting admin approval</p>
      <p className="text-sm text-foreground/70">
        An existing admin needs to approve your account and assign a role before you can log in.
      </p>
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 min-h-11 rounded-lg bg-magenta px-4 text-sm font-extrabold text-white"
      >
        Back to login
      </button>
    </main>
  );
}
