import { Link2Icon, UploadIcon } from '@radix-ui/react-icons';
import { Button } from '@/app/components/button';
import type { QuizImport } from '@/app/quizzes/[id]/use-quiz-import';

interface QuizImportControlsProps {
  variant: 'empty' | 'toolbar';
  quizImport: QuizImport;
}

/** The file input, Google Sheets link form and (toolbar only) the "add to quiz" choice — one implementation for both places an import starts. */
export function QuizImportControls({
  variant,
  quizImport,
}: QuizImportControlsProps) {
  const {
    handleCsvFile,
    handleSheetUrlSubmit,
    sheetUrlInput,
    setSheetUrlInput,
    appendImport,
    setAppendImport,
    isSheetPending,
  } = quizImport;
  const isToolbar = variant === 'toolbar';

  const fileInput = (
    <input
      type="file"
      accept=".csv,text/csv"
      onChange={(event) => void handleCsvFile(event)}
      className="hidden"
    />
  );
  const sheetInput = (
    <input
      type="url"
      value={sheetUrlInput}
      onChange={(event) => setSheetUrlInput(event.target.value)}
      placeholder={
        !isToolbar
          ? 'Paste a Google Sheets link'
          : appendImport
            ? 'Add more from Google Sheets'
            : 'Re-import from Google Sheets'
      }
      aria-label="Google Sheets link"
      className={
        isToolbar
          ? 'min-w-0 flex-1 bg-transparent text-xs font-bold outline-none placeholder:text-background/40'
          : 'min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-foreground/40'
      }
    />
  );

  if (!isToolbar) {
    return (
      <>
        <label className="flex min-h-16 min-w-56 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-foreground bg-white px-6 font-display text-lg text-foreground">
          <UploadIcon aria-hidden="true" />
          Import CSV
          {fileInput}
        </label>
        <form
          onSubmit={handleSheetUrlSubmit}
          className="flex min-h-16 min-w-72 items-center gap-2 rounded-2xl border-2 border-foreground bg-white px-4 text-foreground"
        >
          <Link2Icon aria-hidden="true" className="shrink-0" />
          {sheetInput}
          <Button
            type="submit"
            disabled={isSheetPending}
            className="shrink-0 rounded-xl bg-foreground px-3 py-2 text-xs font-extrabold text-background disabled:opacity-50"
          >
            {isSheetPending ? 'Importing…' : 'Import'}
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <label className="flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap px-1 text-xs font-bold text-background/80">
        <input
          type="checkbox"
          checked={appendImport}
          onChange={(event) => setAppendImport(event.target.checked)}
        />
        Add to quiz instead of replacing
      </label>
      <label className="flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-background/50 px-4 text-xs font-extrabold text-background">
        <UploadIcon aria-hidden="true" />
        Import CSV
        {fileInput}
      </label>
      <form
        onSubmit={handleSheetUrlSubmit}
        className="flex min-h-10 min-w-56 items-center gap-1.5 rounded-xl border-2 border-background/50 px-3 text-background"
      >
        <Link2Icon aria-hidden="true" className="shrink-0" />
        {sheetInput}
        <Button
          type="submit"
          disabled={isSheetPending}
          size="sm"
          className="shrink-0 rounded-lg bg-background/20 px-2 py-1 text-xs font-extrabold text-background disabled:opacity-50"
        >
          {isSheetPending ? '…' : 'Import'}
        </Button>
      </form>
    </>
  );
}
