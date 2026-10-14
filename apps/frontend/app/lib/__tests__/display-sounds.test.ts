import { describe, expect, it, vi } from 'vitest';
import { DISPLAY_SOUNDS, createDisplaySounds } from '@/app/lib/display-sounds';

function setup() {
  const play = vi.fn().mockResolvedValue(undefined);
  const createAudio = vi.fn((src: string) => ({ src, play, currentTime: 0 }));
  const sounds = createDisplaySounds(createAudio);
  return { sounds, play, createAudio };
}

describe('display sound registry', () => {
  it('plays nothing before sound is unlocked', () => {
    const { sounds, play } = setup();

    sounds.play('chime');

    expect(play).not.toHaveBeenCalled();
  });

  it('plays the named sound once unlocked', () => {
    const { sounds, play, createAudio } = setup();
    sounds.unlock();

    sounds.play('chime');

    expect(createAudio).toHaveBeenCalledWith(DISPLAY_SOUNDS.chime);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays nothing while muted', () => {
    const { sounds, play } = setup();
    sounds.unlock();
    sounds.setMuted(true);

    sounds.play('chime');

    expect(play).not.toHaveBeenCalled();
  });

  it('plays again after being unmuted', () => {
    const { sounds, play } = setup();
    sounds.unlock();
    sounds.setMuted(true);
    sounds.setMuted(false);

    sounds.play('fanfare');

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected play() so a blocked sound never throws', () => {
    const { sounds, play } = setup();
    play.mockRejectedValue(new Error('blocked'));
    sounds.unlock();

    expect(() => sounds.play('sting')).not.toThrow();
  });
});
