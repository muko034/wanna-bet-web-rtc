type ClickEvent = { preventDefault: () => void; stopPropagation: () => void };

/**
 * Runs `onHome` for a tap on the Home link instead of letting it navigate. `preact-router`
 * routes every `<a href>` click from a document-level listener that ignores `defaultPrevented`,
 * so the click must also be stopped before it bubbles there.
 */
export function handleHomeClick(event: ClickEvent, onHome: () => void): void {
  event.preventDefault();
  event.stopPropagation();
  onHome();
}
