/** Every display (big screen) sound, by name. Files live in public/sounds/. */
export const DISPLAY_SOUNDS = {
  sting: '/sounds/sting.mp3',
  chime: '/sounds/chime.mp3',
  drumroll: '/sounds/drumroll.mp3',
  reveal: '/sounds/reveal.mp3',
  slam: '/sounds/slam.mp3',
  burst: '/sounds/burst.mp3',
  fanfare: '/sounds/fanfare.mp3',
  timeUp: '/sounds/time-up.mp3',
} as const;

export type DisplaySoundName = keyof typeof DISPLAY_SOUNDS;

interface PlayableAudio {
  currentTime: number;
  play: () => Promise<void>;
}

export interface DisplaySounds {
  /** Call once from a real user gesture ("Enable sound"). */
  unlock: () => void;
  /** The session's display-sound-muted setting. */
  setMuted: (isMuted: boolean) => void;
  /** Silent while muted or before unlock; never throws. */
  play: (name: DisplaySoundName) => void;
}

export function createDisplaySounds(
  createAudio: (src: string) => PlayableAudio,
): DisplaySounds {
  let isUnlocked = false;
  let isMuted = false;
  return {
    unlock() {
      isUnlocked = true;
    },
    setMuted(next) {
      isMuted = next;
    },
    play(name) {
      if (!isUnlocked || isMuted) {
        return;
      }
      const audio = createAudio(DISPLAY_SOUNDS[name]);
      audio.currentTime = 0;
      audio.play().catch(() => {});
    },
  };
}

/** The tab-wide registry every display effect plays through. */
export const displaySounds = createDisplaySounds((src) => new Audio(src));
