"use client";

import { useRef } from "react";
import type { TouchEvent } from "react";

/** Past this and it was a swipe, not a tap that drifted under a thumb. */
const SWIPE_PX = 40;

/**
 * True if the gesture began inside something the reader has already scrolled.
 *
 * This is what stops a sheet closing when someone drags the ladder text back
 * up: mid-scroll a downward drag means "scroll up", and only at the very top of
 * the content does it mean "put this away".
 *
 * The walk stops AT the bound element, inclusive, not before it. The ladder
 * scrolls in a child (`.lbody`) but the filter drawer scrolls in the panel the
 * handlers sit on, so excluding the root missed that case entirely. Anything
 * above the root is someone else's scroll and is not our business.
 */
function insideScrolledContent(target: EventTarget | null, root: HTMLElement): boolean {
  let el = target as HTMLElement | null;
  while (el) {
    if (el.scrollTop > 0) return true;
    if (el === root) return false;
    el = el.parentElement;
  }
  return false;
}

/**
 * Swipe-to-dismiss for the mobile sheets: the ladder, the filter drawer, and
 * the tour card. Spread the result onto the sheet's own root element, not onto
 * its handle, or the gesture only lives on a strip a few pixels tall and the
 * sheet reads as stuck.
 *
 * `onUp` is optional: the ladder expands on an upward swipe, the drawer and the
 * tour card have nothing to expand into.
 */
export function useSwipeDown(onDown: () => void, onUp?: () => void) {
  const start = useRef<{ x: number; y: number; blocked: boolean } | null>(null);

  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      const t = e.touches[0];
      if (!t) return;
      start.current = {
        x: t.clientX,
        y: t.clientY,
        blocked: insideScrolledContent(e.target, e.currentTarget),
      };
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      if (!s || s.blocked) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - s.y;
      // A mostly sideways drag belongs to whatever it started on, such as the
      // scrolling chip row, not to the sheet.
      if (Math.abs(t.clientX - s.x) > Math.abs(dy)) return;
      if (dy > SWIPE_PX) onDown();
      else if (onUp && dy < -SWIPE_PX) onUp();
    },
  };
}
