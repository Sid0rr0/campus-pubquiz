import {
  QUESTION_KINDS,
  QUESTION_TYPES,
  SCORING_MODES_BY_TYPE,
} from '@campus-pubquiz/types';
import { ADMIN_SHORTCUTS } from '@/app/control/admin-keyboard-shortcuts';

interface GuideLink {
  href: string;
  label: string;
  download?: boolean;
}

interface GuideSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  link?: GuideLink;
}

const QUESTION_TYPE_BULLETS = QUESTION_TYPES.map(
  (type) =>
    `${QUESTION_KINDS[type].label} — ${QUESTION_KINDS[type].moderatorNote}`,
);

const CSV_TYPE_IDENTIFIERS = QUESTION_TYPES.join(', ');

/** e.g. "Sort / order: one_off, exact or per_item; Match pairs: per_item or one_off" */
export const SCORING_NOTE = QUESTION_TYPES.filter(
  (type) => type in SCORING_MODES_BY_TYPE,
)
  .map((type) => {
    const modes = QUESTION_KINDS[type].scoringModes;
    return `${QUESTION_KINDS[type].label}: ${modes.slice(0, -1).join(', ')} or ${modes.at(-1)}`;
  })
  .join('; ');

const SHORTCUT_BULLETS = Object.values(ADMIN_SHORTCUTS).map(
  (shortcut) => `${shortcut.keyName} — ${shortcut.description}`,
);

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Before the night',
    paragraphs: [
      'Build the quiz, then check it with Quiz preview (Preview in the editor, quiz list, waiting session), not a throwaway session.',
      'Put /display on the big screen and /control on your laptop; teams join on their phones.',
      'A block is a run of rounds graded and revealed together, ending at a round marked to break after it (the last round always does).',
    ],
  },
  {
    title: 'Starting a session',
    paragraphs: [
      'In the lobby, Session Settings sets the quiz, rules text and bonus categories. Then press Start Quiz.',
      'Tick the leagues this session counts towards when you start it, or in Session Settings until it ends.',
      'Advance shows the rules, the round overview, then the first round title card. While the rules show, Previous returns to the lobby.',
    ],
  },
  {
    title: 'Unlisted sessions',
    paragraphs: [
      'The "Show in the game list" switch in Session Settings (lobby only) keeps a session out of the game list; your session list marks it "Unlisted".',
      'Open display on Control shows the big screen. Teams join by scanning its QR code, or "Have a game code?" and typing the code.',
    ],
  },
  {
    title: 'Jokers',
    paragraphs: [
      'The "Jokers" switch in Session Settings (lobby only) turns on the round overview too. Each team picks a round whose points count double, bonus awards never (🃏 in Teams).',
      'Next is the joker pick; the big screen shows "N/M picked". "Countdown sound" covers the music.',
      'Close pick (Advance) ends it early; unpicked teams get a random round. Previous reopens it.',
      'Change a joker in the joker list until that round has started; its phone says it was changed by the quiz master.',
      'After a joker round, the team\'s leaderboard row gets a "2×" stamp, even on 0 points.',
    ],
  },
  {
    title: 'Running questions',
    paragraphs: [
      'Each round opens with a round title card, then Advance opens questions one at a time. Teams can change answers to any question opened this block.',
      "Advance on a block's last question starts the final countdown, then the break. In kahoot rounds every question is its own block, shut once revealed.",
    ],
  },
  {
    title: 'Media and sound',
    paragraphs: [
      'On a video or audio question (or its revealed answer), Pause and "Play again" sit below the Leaderboard row on Control.',
      'The Display sound toggle mutes the big screen, clips included; phones stay silent.',
    ],
  },
  {
    title: 'Grading',
    paragraphs: [
      'Grade an answer as soon as it arrives; finish the rest in the break: the quiz will not leave the break while an answer is ungraded.',
      'A graded answer that a team changes so it no longer matches is cleared for you to regrade. Grading by question type:',
    ],
    bullets: QUESTION_TYPE_BULLETS,
  },
  {
    title: 'The break and break review',
    paragraphs: [
      'When a block ends, answers close and the big screen shows a break card with a timer. Break End Time sets or extends it.',
      'Fun facts rotate on the card; switch them off in Session Settings (lobby only).',
      "Previous steps back through the block's questions, answers hidden: the break review.",
    ],
  },
  {
    title: 'The reveal',
    paragraphs: [
      'When grading is finished, Advance reveals the block: each round title card, then each question with its answer. After the last block it ends the quiz.',
    ],
  },
  {
    title: 'Leaderboard, late joiners and ties',
    paragraphs: [
      'Show or hide the leaderboard any time. While it shows, Advance reveals one rank at a time, from last place up.',
      'Join overlay on Control covers the big screen with the QR code and join code for late teams.',
      'When teams tie for first after a reveal, the Showdown panel offers a tiebreak.',
    ],
  },
  {
    title: 'Teams',
    paragraphs: [
      'The Teams panel shows who is connected and has answered; kick a team here to remove it.',
      'A stuck phone offers "Tap to reconnect" after 10 seconds; the big screen shows "Reconnecting…".',
      'Each team shows its player count, flagged as over the player cap above the "max players per team" setting; nothing is deducted automatically, so give a negative bonus as a penalty.',
      'To correct a count, press Edit, type a whole number from 1 to 20 and press Save.',
      "Bonus points: open the team's actions menu, choose Award bonus, pick a category, set the points (negative is a penalty) and press Award.",
      "A team forgot its code: open /teams, choose Show team code in the team's actions menu, and have the team rejoin with its name and code. If it already joined as a new team, press \"Merge with…\" on that team's page after the night; a merge can't be undone.",
    ],
  },
  {
    title: 'Feedback from teams',
    paragraphs: [
      'The "Collect feedback" switch in Session Settings is on by default and only changes in the lobby. While on, phones show a "Rate these rounds" card each break and a final form after "Quiz complete!". Results are anonymous and appear only on the session stats page.',
    ],
  },
  {
    title: 'Remote and keyboard shortcuts',
    paragraphs: [
      'Remote (Sessions page) is a phone-friendly page with Previous, Advance and leaderboard controls, a next-up preview and your notes. Space pauses media.',
      'These shortcuts work on Control except while typing in a form field:',
    ],
    bullets: SHORTCUT_BULLETS,
  },
  {
    title: 'Ending',
    paragraphs: [
      'The quiz ends after the last reveal or with End Quiz. Close Session shuts the session down afterwards.',
    ],
  },
  {
    title: 'Creating a quiz',
    paragraphs: [
      '"New Quiz" on the Sessions page opens the editor. Fill rounds in by hand or import a CSV.',
      'To add to a saved quiz, tick "Add to quiz instead of replacing" when importing. If a live save is refused, reload and save again.',
    ],
    bullets: [
      'Round note: up to 500 characters, for Remote and Control. "Show on screen" adds the big screen; phones never see it.',
      'Media: paste a picture, audio, YouTube or video file link into Media URL (or Answer media URL). Run video files from Control.',
      `Number: the margin row has a number field and % / absolute switch. CSV: {margin: "5%"}; {scoring: …} sets ${SCORING_NOTE}.`,
      'Video question: tick "Hide video (sound only)" to cover the video until the reveal. In a CSV, write hideVideo: true inside the {…} group in the notes cell.',
      'Clip and Reveal start and end take seconds, M:SS or H:MM:SS. In a CSV: {start: "1:22", end: "2:20", revealStart: "2:30", revealEnd: "2:45"}.',
      `CSV: one row per question; a round ends a block once any row has break_after = 1. By hand, fill category, author, round_note, show_round_note (1 shows it on screen) and notes. The type column takes ${CSV_TYPE_IDENTIFIERS}.`,
    ],
    link: {
      href: '/sample-quiz-import.csv',
      label: 'Download sample CSV template',
      download: true,
    },
  },
];

export function GuideContent() {
  return (
    <div className="flex flex-col gap-8 text-left max-w-3xl">
      <h1 className="text-center font-display text-3xl">
        <span className="text-magenta">Moderator Guide</span>
      </h1>
      {GUIDE_SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="font-display text-xl text-cyan">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-lg">
              {paragraph}
            </p>
          ))}
          {section.bullets && (
            <ul className="flex flex-col gap-2 pl-1">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-lg">
                  <span aria-hidden="true" className="text-cyan">
                    •
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
          {section.link && (
            <a
              href={section.link.href}
              download={section.link.download}
              className="mt-1 self-start rounded-lg border-2 border-cyan px-4 py-2 font-extrabold text-cyan underline"
            >
              {section.link.label}
            </a>
          )}
        </section>
      ))}
    </div>
  );
}
