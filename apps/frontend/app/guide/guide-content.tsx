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
    `${type} (${QUESTION_KINDS[type].label}) — ${QUESTION_KINDS[type].moderatorNote}`,
);

const SHORTCUT_BULLETS = Object.values(ADMIN_SHORTCUTS).map(
  (shortcut) => `${shortcut.keyName} — ${shortcut.description}`,
);

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Before the night',
    paragraphs: [
      'Build the quiz (see "Creating a quiz") and open it once from the Sessions page to check every round.',
      'Put /display on the big screen and /control on your laptop. Teams join from their phones with the join code.',
      'A block is a run of rounds graded and revealed together. It ends at a round marked to break after it; the last round always ends a block.',
    ],
  },
  {
    title: 'Starting a session',
    paragraphs: [
      'While teams join, Session Settings lets you pick the quiz, edit the rules text and enable bonus categories. Then press Start Quiz.',
      'Advance shows the rules, the round overview, then the first round title card. While the rules show, Previous returns to the lobby.',
    ],
  },
  {
    title: 'Running questions',
    paragraphs: [
      'Each round opens with a round title card. Advance then opens its questions one at a time. Teams can change answers on any question opened in the current block.',
      "Advance on a block's last question starts the final countdown, then the break. In a kahoot round every question is its own block.",
    ],
  },
  {
    title: 'Media and sound',
    paragraphs: [
      'While a video or audio question is open, Pause and "Play again" sit below the Leaderboard row on Control. Moving to another question restarts its media.',
      'The Display sound toggle mutes the big screen for everyone. Phones never play sound.',
    ],
  },
  {
    title: 'Grading',
    paragraphs: [
      'Grade an answer as soon as it arrives, in the teams/answers table. Anything still ungraded must be finished during the break: the quiz will not leave the break while an answer is ungraded.',
      'If a team changes a graded answer so it no longer matches, the mark clears and you grade it again. How each question type is graded:',
    ],
    bullets: QUESTION_TYPE_BULLETS,
  },
  {
    title: 'The break and break review',
    paragraphs: [
      'When a block ends, answers close and the big screen shows the break card with a timer. Use the time to finish grading. Break End Time sets or extends the countdown.',
      'Fun facts rotate on the card; switch them off with "Fun facts on the break screen" in Session Settings (lobby only).',
      "Press Previous to step back through the block's questions with answers hidden: this is the break review.",
    ],
  },
  {
    title: 'The reveal',
    paragraphs: [
      'Once grading is finished, Advance reveals the block: each round title card, then each question with its correct answer. After the last block, Advance ends the quiz.',
    ],
  },
  {
    title: 'Leaderboard, late joiners and ties',
    paragraphs: [
      'Show or hide the leaderboard at any time. While it shows, Advance reveals one more rank, from last place up.',
      'Join overlay on Control covers the big screen with the QR code and join code for late teams; the quiz carries on underneath. Press it again to hide it.',
      'When teams tie for first place after a reveal, the Showdown panel appears: a tiebreak between only the tied teams.',
    ],
  },
  {
    title: 'Teams',
    paragraphs: [
      'The Teams panel shows who is connected and who has answered. Kick a team here to remove it. A phone that reconnects picks up where the quiz is; the big screen does too.',
      'Each team shows its player count, entered by the team. A count above the "max players per team" setting is flagged as over the player cap; no points are taken off automatically.',
      'To correct a count, press Edit, type a whole number from 1 to 20 and press Save.',
      "For bonus points, open the team's actions menu, choose Award bonus, pick a category, check the points (negative is a penalty) and press Award.",
    ],
  },
  {
    title: 'Feedback from teams',
    paragraphs: [
      'The "Collect feedback" switch in Session Settings is on by default and can only change in the lobby.',
      'While on, each break shows a "Rate these rounds" card on phones, and "Quiz complete!" is followed by a final form. Results are anonymous and appear only on the session stats page.',
    ],
  },
  {
    title: 'Remote and keyboard shortcuts',
    paragraphs: [
      'Remote, from the Sessions page, is a phone-friendly page with notes, a preview of what is next and the Previous, Advance and leaderboard controls.',
      'These shortcuts work on Control except while typing in a form field:',
    ],
    bullets: SHORTCUT_BULLETS,
  },
  {
    title: 'Ending',
    paragraphs: [
      'The quiz ends after the last reveal, or earlier with End Quiz. Close Session shuts the session down once the event is over.',
    ],
  },
  {
    title: 'Creating a quiz',
    paragraphs: [
      'From the Sessions page, "New Quiz" opens the editor. Fill rounds in by hand or import a CSV; everything stays editable until you press Save quiz.',
      'To add to a saved quiz, tick "Add to quiz instead of replacing" before importing. If a save during a live session is refused, reload the quiz and save again.',
      'Round note: up to 500 characters, for you on Remote. Tick "Show on screen" to put it on the big screen too; it never reaches phones.',
      'Media: paste a picture, audio, YouTube or video file link into Media URL (or Answer media URL). Video files have no controls, so run them from Control. Use short clips.',
      'Number question: the margin row has a number field and a % / absolute switch, starting at 10%. A CSV has no margin column, so imports get 10%.',
      'Video question: tick "Hide video (sound only)" to cover the video until the reveal. In a CSV, write hideVideo: true inside the {…} group in the notes cell.',
      'Clip start and end, and Reveal start and end, take seconds, M:SS or H:MM:SS. In a CSV: {start: "1:22", end: "2:20", revealStart: "2:30", revealEnd: "2:45"}.',
      'CSV: one row per question; a round ends a block once any row has break_after = 1. The template shows every column.',
    ],
    link: {
      href: '/sample-quiz-import.csv',
      label: 'Download sample CSV (one row per question type)',
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
