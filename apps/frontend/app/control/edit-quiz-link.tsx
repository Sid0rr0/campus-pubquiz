import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';

interface EditQuizLinkProps {
  quizId: number | null;
  className?: string;
}

/** Jumps the quiz master straight to the quiz editor for the running session's quiz. Renders nothing until a quiz is actually active (e.g. still in the lobby). */
export function EditQuizLink({ quizId, className = '' }: EditQuizLinkProps) {
  if (quizId === null) return null;

  return (
    <Link
      href={`/quizzes/${quizId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex min-h-8 w-fit items-center gap-1 rounded-lg border-2 border-cyan px-3 py-1.5 text-sm font-extrabold text-cyan ${className}`}
    >
      <ExternalLinkIcon aria-hidden="true" />
      Edit quiz
    </Link>
  );
}
