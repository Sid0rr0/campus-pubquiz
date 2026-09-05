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

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: 'Session lifecycle',
    paragraphs: [
      'A session moves through lobby → rules → question open → locked → break (grading) → reveal → ended.',
      'Question open, break, and reveal are the only states that can be repeated multiple times in a single session.',
    ],
    bullets: [
      'Lobby — teams can join, settings can be changed, and the moderator can start the quiz.',
      'Rules — read the rules',
      'Question open — a question is open for teams to answer.',
      'Break (grading) — the question is locked, and grading is finishing during this break.',
      'Reveal — the question is revealed to all teams, and the leaderboard shows who got it right.',
      'Ended — the quiz has finished; no more questions will be opened.',
    ],
  },
  {
    title: 'Starting a session',
    paragraphs: [
      'While the session is in the lobby, the Session Settings panel lets you pick the quiz, edit the rules text, and enable bonus categories before pressing Start Quiz.',
    ],
  },
  {
    title: 'Running questions',
    paragraphs: [
      'Previous and Advance step through the game. Advance opens a question, then locks it (with a countdown sound near the end), then reveals it. Previous is only available while it would not undo grading already done.',
    ],
  },
  {
    title: 'Keyboard shortcuts',
    paragraphs: [
      'Available anywhere on the admin page except while typing in a form field (so grading a text answer never gets hijacked by a stray arrow key):',
    ],
    bullets: [
      'Right arrow — reveal the next team on the leaderboard if one is waiting, otherwise Advance (or hide the leaderboard once every team is revealed).',
      'Left arrow — Previous, when available and the leaderboard isn’t showing.',
      'Up arrow — show the leaderboard.',
      'Down arrow — hide the leaderboard.',
    ],
  },
  {
    title: 'Grading',
    paragraphs: [
      'Grading happens during the break, in the teams/answers table.',
    ],
    bullets: [
      'Free text, and YouTube questions need your judgement — grade each answer by hand.',
      'Multiple choice, sort, and match are auto-graded the moment a team submits.',
      'Closest guess is graded in one batch once the question locks: every team tied for the smallest distance gets full points, everyone else gets zero.',
    ],
  },
  {
    title: 'Break & leaderboard',
    paragraphs: [
      'The Break End Time control sets or extends how long the break countdown runs on the display. The leaderboard toggle is independent of the game status — it is safe to show or hide it at any point without disrupting grading or question flow.',
    ],
  },
  {
    title: 'Showdown',
    paragraphs: [
      'When teams are tied for first place at a reveal-eligible point in the game, the Showdown panel becomes available. Creating a showdown round adds a tiebreaker round for just the tied teams.',
    ],
  },
  {
    title: 'Teams',
    paragraphs: [
      'The Teams panel shows which teams are connected and, while a question is open, which of them have answered yet. Kick a team here if it needs to be removed from the session.',
    ],
  },
  {
    title: 'Ending',
    paragraphs: [
      'End Quiz finishes the current quiz and moves the session to its ended state. Close Session shuts the session down entirely — use it once the event is over.',
    ],
  },
  {
    title: 'Creating a quiz',
    paragraphs: [
      'From the Sessions page, "New Quiz" opens the quiz editor. Start from a blank round and fill it in by hand, or import a CSV export of a spreadsheet to populate rounds and questions automatically — either way, everything stays editable before you press Save quiz. Reopening a saved quiz from the Sessions page lets you keep editing it, including importing a fresh CSV (which replaces the rounds currently in the editor, so save first if you want to keep both versions).',
      'CSV columns: round, type, question, options, answer, points, media_url, answer_media_url, notes, break_after. One row per question; a round grades (breaks) after itself once any of its rows has break_after = 1 — the last round always breaks regardless, since the game can’t reveal answers otherwise.',
    ],
    bullets: [
      'free_text — no options; answer is graded by hand, so it just needs to be the reference text.',
      'multiple_choice — options pipe-separated (e.g. Paris|London|Berlin); answer must match one option exactly.',
      'audio — media_url is required (any http audio link); graded by hand like free_text.',
      'youtube — media_url must be a youtube.com/youtu.be link; notes can clip it, e.g. {start: "0:10", end: "0:25"}.',
      'sort — options pipe-separated in any order; answer lists them pipe-separated in the correct order.',
      'match — options packs both lists as left1|left2+right1|right2; answer pairs them left+right, pipe-separated (e.g. Paris+France|Tokyo+Japan).',
      'closest_guess — answer is a number; graded once the question locks, and every team tied for the closest guess gets full points.',
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
