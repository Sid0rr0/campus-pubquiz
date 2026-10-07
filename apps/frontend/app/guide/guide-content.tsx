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

const CSV_TYPE_BULLETS = QUESTION_TYPES.map(
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
      'Build the quiz ahead of time (see "Creating a quiz" below) and open it once from the Sessions page to check every round and question. Have the big screen open on /display and your own laptop on /control; teams join from their phones with the join code.',
      'The quiz is split into blocks: a run of rounds that is graded and revealed together, ending at a round you marked to break after it. The last round always ends a block.',
    ],
  },
  {
    title: 'Starting a session',
    paragraphs: [
      'While teams are joining, the Session Settings panel lets you pick the quiz, edit the rules text, and enable bonus categories before pressing Start Quiz. The big screen shows the join code and QR code until you start.',
      'Starting shows the rules, then an overview of every round, then the first round title card. Each press of Advance moves on.',
    ],
  },
  {
    title: 'Running questions',
    paragraphs: [
      'Each round opens with a round title card, then Advance opens its questions one at a time. Teams can answer or change their answer on any question already opened in the current block, so earlier questions stay answerable until the block ends.',
      'On the last question of a block, Advance starts the final countdown (with a sound near the end). Teams can still answer until it runs out and the break starts. Previous is only available while it would not undo grading already done.',
      'In a kahoot round every question is its own block, so each one is scored and revealed before the next opens.',
    ],
  },
  {
    title: 'Grading',
    paragraphs: [
      'You can grade an answer as soon as it arrives, in the teams/answers table. Typed answers (free text, audio, YouTube) that match the answer text are graded correct automatically; any other typed answer waits for you. If a team changes an answer you already graded so that it no longer matches, the mark is cleared and you need to grade it again. Whatever is still ungraded must be finished during the break: the quiz will not leave the break while an answer is ungraded. While one is, the preview on the Remote page says Advance is waiting for grading; once the last answer is graded it names the reveal.',
      'How each question type is graded:',
    ],
    bullets: QUESTION_TYPE_BULLETS,
  },
  {
    title: 'The break and break review',
    paragraphs: [
      'When a block ends, the questions stop accepting answers and the break starts. The big screen shows a break card with the break timer and the bonus categories; use this time to finish grading. The Break End Time control sets or extends how long the break countdown runs.',
      "To show a question to the room again during the break, press Previous to step back through the block's questions. Answers stay hidden while you do this (break review). Stepping back across the start of a round shows that round's title card again.",
    ],
  },
  {
    title: 'The reveal',
    paragraphs: [
      'Once grading is finished, Advance leaves the break and reveals the block: each round shows a title card announcing its answers, then each question appears with its correct answer. Teams see their own answer, the correct answer and their points on their phones.',
      'After the last reveal of the last block, Advance ends the quiz.',
    ],
  },
  {
    title: 'Feedback from teams',
    paragraphs: [
      'The "Collect feedback" switch in the Session Settings panel is on by default and can only be changed in the lobby, like every other setting. While it is on, teams can rate the rounds from their phones, and it is always optional.',
      'In each break, a "Rate these rounds" card sits above the block browser on the phone, with 1–5 stars for each round of the block that just ended. When the quiz ends, and any showdown is decided, the phone shows "Quiz complete!" followed by a final form: every round with its stars (kahoot rounds are only rated here), an "Anything else?" box and topic suggestions for future rounds.',
      'With the switch off, phones show no rating card and no final form — the end screen is just "Quiz complete!" — and ratings and comments are refused. Results are anonymous and appear only on the session stats page, never on Control: each round\'s average rating in the rounds table, then a Comments section (newest first) and a Topic suggestions section (grouped and sorted by how many teams gave them). A session run with the switch off shows "Feedback was off for this session" there instead.',
    ],
  },
  {
    title: 'The leaderboard',
    paragraphs: [
      'The leaderboard can be shown or hidden at any point without disrupting grading or the flow of the quiz; hiding it resumes exactly where you were. While it is showing, Advance and Previous only work the leaderboard and never move the quiz underneath.',
    ],
  },
  {
    title: 'Ties and showdowns',
    paragraphs: [
      'When teams are tied for first place at a point where answers have been revealed, the Showdown panel becomes available. A showdown is a tiebreak between just the tied teams, who take turns in a fixed seat order.',
    ],
  },
  {
    title: 'Teams',
    paragraphs: [
      'The Teams panel shows which teams are connected and, while a question is open, which of them have answered yet. Kick a team here if it needs to be removed from the session. A phone that drops its connection picks up exactly where the quiz is when it reconnects.',
      'To give a team bonus points, open its actions menu in the Teams panel and choose Award bonus. Pick a category, check the points (a negative number is a penalty; a custom award needs a reason) and press Award. When the server accepts it, a green toast confirms the signed points, the category and the team — for example "+1 Selfie → The Quizzly Bears" — even if that team\'s phone is offline. If the award is refused, you get an error toast instead and the dialog stays open with what you typed, so you can fix it and press Award again.',
    ],
  },
  {
    title: 'Remote and keyboard shortcuts',
    paragraphs: [
      "From the Sessions page, the Remote link opens a phone-friendly companion page for a session — the current question's notes, a preview of what's up next, and Previous/Advance/leaderboard controls, so you can walk the room instead of staying at the laptop. It shares the same admin connection as Control, so actions taken from either one stay in sync.",
      'On the Control page these keyboard shortcuts work anywhere except while typing in a form field (so grading a text answer never gets hijacked by a stray arrow key):',
    ],
    bullets: SHORTCUT_BULLETS,
  },
  {
    title: 'Ending',
    paragraphs: [
      'The quiz ends after the last reveal, or earlier with End Quiz. Close Session shuts the session down entirely — use it once the event is over.',
    ],
  },
  {
    title: 'Creating a quiz',
    paragraphs: [
      'From the Sessions page, "New Quiz" opens the quiz editor. Start from a blank round and fill it in by hand, or import a CSV export of a spreadsheet to populate rounds and questions automatically — either way, everything stays editable before you press Save quiz. Reopening a saved quiz from the Sessions page lets you keep editing it, including importing another CSV: by default a fresh import replaces the rounds currently in the editor (save first if you want to keep both versions), but checking "Add to quiz instead of replacing" first appends the import instead — questions land in an existing round when its title matches, otherwise the CSV\'s round is added as a new one, so you can top up a quiz with just a round or a handful of questions at a time.',
      'You can keep editing a quiz while a session is playing it, as long as you leave alone what the game has already reached. A save made just as the quiz moves on may be refused, because a question you changed has just opened. Reload the quiz and save again.',
      "CSV columns: round, type, question, options, answer, points, media_url, answer_media_url, notes, break_after. One row per question; a round ends a block once any of its rows has break_after = 1 — the last round always does, since the game can't reveal answers otherwise. The type column takes one of the identifiers below; what each type needs:",
    ],
    bullets: CSV_TYPE_BULLETS,
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
