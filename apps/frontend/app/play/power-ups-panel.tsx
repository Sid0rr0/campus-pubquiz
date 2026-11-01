import { PowerUpsList } from '@/app/play/power-ups-list';
import type { ComponentProps } from 'react';

/** Sticky sidebar between the answer history and the bonus points on wider screens; on mobile MobileQuizActionsBar's drawer shows the same list. */
export function PowerUpsPanel(props: ComponentProps<typeof PowerUpsList>) {
  return (
    <section className="hidden md:sticky md:top-5 md:flex md:max-h-[calc(100vh-2.5rem)] md:w-80 md:shrink-0 md:flex-col md:gap-2 md:self-start">
      <h2 className="font-display text-lg text-magenta">Power-ups</h2>
      <div className="overflow-y-auto pr-1">
        <PowerUpsList {...props} />
      </div>
    </section>
  );
}
