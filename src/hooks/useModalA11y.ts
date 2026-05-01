import { useEffect, useRef, type RefObject } from 'react';

interface UseModalA11yOptions {
  /** Whether the modal is currently open. */
  isOpen: boolean;
  /** Called when the user presses Escape while the modal is open. */
  onClose: () => void;
  /**
   * Whether to return focus to the element that had focus before the modal
   * opened. Defaults to `true` to satisfy WCAG 2.4.3 (focus order).
   */
  restoreFocus?: boolean;
}

interface UseModalA11yResult<TInitial extends HTMLElement> {
  /** Attach to the element that should receive focus when the modal opens. */
  initialFocusRef: RefObject<TInitial | null>;
  /** Attach to the top-level dialog container element (used for the focus trap). */
  dialogRef: RefObject<HTMLElement | null>;
}

// Tabbable selector used by the focus trap. Kept here (not inlined) so the
// focusable-element contract is editable in one place.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const getTabbableElements = (root: HTMLElement): HTMLElement[] => {
  const nodes = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
  // Exclude elements explicitly hidden from assistive tech. We only drop
  // `aria-hidden="true"` — `aria-hidden="false"` is a valid way to force
  // visibility, so presence alone is not a safe filter.
  return nodes.filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
};

const handleTabKey = (event: KeyboardEvent, root: HTMLElement | null) => {
  if (!root) return;
  const tabbable = getTabbableElements(root);
  if (tabbable.length === 0) return;
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

/**
 * Unifies the accessibility contract for every modal in the app:
 *
 * - Focuses `initialFocusRef` when the modal opens (keyboard users land
 *   inside the dialog instead of behind it).
 * - Traps `Tab` / `Shift+Tab` inside the dialog container so focus cannot
 *   escape back into the inert page content behind the modal.
 * - Calls `onClose` when Escape is pressed while the modal is open.
 * - Locks body scrolling while the modal is open and restores it on close.
 * - Restores focus to whatever element was focused before the modal opened,
 *   so keyboard users don't get dumped at the top of the page on close.
 *
 * `onClose` is read through a ref so the lifecycle effect only re-runs when
 * `isOpen` or `restoreFocus` actually changes — without this, every parent
 * re-render would tear down and re-install the listener and snap focus back
 * to `initialFocusRef`, breaking text inputs inside the dialog.
 */
export function useModalA11y<TInitial extends HTMLElement = HTMLElement>(
  { isOpen, onClose, restoreFocus = true }: UseModalA11yOptions
): UseModalA11yResult<TInitial> {
  const initialFocusRef = useRef<TInitial | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;

    initialFocusRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        handleTabKey(event, dialogRef.current);
        return;
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (restoreFocus) {
        previousActiveElementRef.current?.focus?.();
      }
    };
  }, [isOpen, restoreFocus]);

  return { initialFocusRef, dialogRef };
}
