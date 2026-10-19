import { QUESTION_KINDS, QUESTION_TYPES } from '@campus-pubquiz/types';
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

const SHORTCUT_BULLETS = Object.values(ADMIN_SHORTCUTS).map(
  (shortcut) => `${shortcut.keyName} — ${shortcut.description}`,
);

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Before the night',
    paragraphs: [
      'Build the quiz (see "Creating a quiz") and open it once from the Sessions page to check it.',
      'Put /display on the big screen and /control on your laptop; teams join on their phones with the join code.',
      'A block is a run of rounds graded and revealed together. It ends at a round marked to break after it, and the last round always ends one.',
    ],
  },
  {
    title: 'Starting a session',
    paragraphs: [
      'In the lobby, Session Settings sets the quiz, rules text and bonus categories. Then press Start Quiz.',
      'Advance shows the rules, the round overview, then the first round title card. While the rules show, Previous returns to the lobby.',
    ],
  },
  {
    title: 'Running questions',
    paragraphs: [
      'Each round opens with a round title card, then Advance opens questions one at a time. Teams can change answers to any question opened this block.',
      "Advance on a block's last question starts the final countdown, then the break. In a kahoot round every question is its own block.",
    ],
  },
  {
    title: 'Media and sound',
    paragraphs: [
      'On a video or audio question, Pause and "Play again" sit below the Leaderboard row on Control. Moving to another question restarts the media.',
      'The Display sound toggle mutes the big screen; phones never play sound.',
    ],
  },
  {
    title: 'Grading',
    paragraphs: [
      'Grade an answer as soon as it arrives, in the teams/answers table; finish the rest in the break: the quiz will not leave the break while an answer is ungraded.',
      'A graded answer that a team changes so it no longer matches is cleared for you to regrade. Grading by question type:',
    ],
    bullets: QUESTION_TYPE_BULLETS,
  },
  {
    title: 'The break and break review',
    paragraphs: [
      'When a block ends, answers close and the big screen shows a break card with a timer; finish grading now. Break End Time sets or extends it.',
      'Fun facts rotate on the card; switch them off in Session Settings (lobby only).',
      "Previous steps back through the block's questions with answers hidden: the break review.",
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
      'Join overlay on Control covers the big screen with the QR code and join code for late teams while the quiz carries on; press it again to hide it.',
      'When teams tie for first place after a reveal, the Showdown panel offers a tiebreak between them.',
    ],
  },
  {
    title: 'Teams',
    paragraphs: [
      'The Teams panel shows who is connected and has answered; kick a team here to remove it.',
      'Phones and the big screen pick up where the quiz is on reconnecting. A stuck phone offers "Tap to reconnect" after 10 seconds; the big screen shows "Reconnecting…" meanwhile.',
      'Each team shows its player count, entered by the team. Above the "max players per team" setting it is flagged as over the player cap; nothing is deducted automatically, so give a negative bonus for a house-rules penalty.',
      'To correct a count, press Edit, type a whole number from 1 to 20 and press Save.',
      "Bonus points: open the team's actions menu, choose Award bonus, pick a category, set the points (negative is a penalty) and press Award.",
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
      'Remote (Sessions page) is a phone-friendly page with notes, a next-up preview and Previous, Advance and leaderboard controls.',
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
      '"New Quiz" on the Sessions page opens the editor. Fill rounds in by hand or import a CSV; everything stays editable until you press Save quiz.',
      'To add to a saved quiz, tick "Add to quiz instead of replacing" when importing. If a live-session save is refused, reload and save again.',
    ],
    bullets: [
      'Round note: up to 500 characters, for you on Remote. "Show on screen" adds the big screen; phones never see it.',
      'Media: paste a picture, audio, YouTube or video file link into Media URL (or Answer media URL). Video files have no controls: run them from Control.',
      'Number question: the margin row has a number field and a % / absolute switch, starting at 10%. A CSV has no margin column, so imports get 10%.',
      'Video question: tick "Hide video (sound only)" to cover the video until the reveal. In a CSV, write hideVideo: true inside the {…} group in the notes cell.',
      'Clip and Reveal start and end take seconds, M:SS or H:MM:SS. In a CSV: {start: "1:22", end: "2:20", revealStart: "2:30", revealEnd: "2:45"}.',
      `CSV: one row per question; a round ends a block once any row has break_after = 1. By hand, fill category, author, round_note, show_round_note (1 shows it on screen) and notes. The type column takes ${CSV_TYPE_IDENTIFIERS}. The template shows every column.`,
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
