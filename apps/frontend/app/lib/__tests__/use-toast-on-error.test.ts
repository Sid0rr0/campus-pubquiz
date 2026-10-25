import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastOnError } from '@/app/lib/use-toast-on-error';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('useToastOnError', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('toasts the error message', () => {
    renderHook(() => useToastOnError('Could not load teams'));

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith('Could not load teams');
  });

  it('toasts nothing without a message', () => {
    renderHook(() => useToastOnError(null));
    renderHook(() => useToastOnError(''));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('toasts once per distinct message, not once per render', () => {
    const { rerender } = renderHook(
      ({ message }: { message: string | null }) => useToastOnError(message),
      { initialProps: { message: 'first' as string | null } },
    );
    rerender({ message: 'first' });
    expect(toast.error).toHaveBeenCalledTimes(1);

    rerender({ message: 'second' });
    expect(toast.error).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenLastCalledWith('second');
  });
});
