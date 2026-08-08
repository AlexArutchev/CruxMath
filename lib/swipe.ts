"use client";

import { useCallback, useRef } from "react";

/** Only the mobile suite has sheets to drag; above this the layouts are docked. */
const MOBILE = "(max-width: 719px)";

/**
 * Movement before we commit to an axis. Under this it is still a tap.
 * Deliberately loose: a thumb reaching for a chip at the bottom of a sheet
 * rolls several pixels, and at 6px that read as a drag and made the panel
 * twitch under every press.
 */
const AXIS_PX = 12;

/** A press starting on one of these is aiming at the control, not the sheet. */
const CONTROLS = "button, a, input, select, textarea, label, [role='button']";

/** A flick this fast dismisses even if it never travelled far. */
const FLICK_PX_PER_MS = 0.45;

type Opts = {
  /** Whether a downward drag should move the sheet and dismiss it right now. */
  enabled: boolean;
  onDismiss: () => void;
  /** Supplied only when there is something to expand INTO; omit once open. */
  onExpand?: () => void;
  /** How far down the sheet may travel. Defaults to its own height. */
  maxTravel?: (el: HTMLElement) => number;
  /**
   * Selector for the part of the sheet that is the grab surface. Omit and the
   * whole sheet drags, which only suits a sheet whose body is mostly reading
   * material. A panel full of filters needs the handle, or every press near a
   * chip starts a drag.
   */
  fromHandle?: string;
};

type Drag = {
  x: number;
  y: number;
  lastY: number;
  lastT: number;
  velocity: number;
  dy: number;
  axis: "none" | "ours" | "theirs";
  travel: number;
};

/**
 * True if the gesture began inside something already scrolled.
 *
 * Mid-scroll a downward drag means "scroll up", and only at the very top of the
 * content does it mean "put this away". The walk stops AT the bound element,
 * inclusive: the ladder scrolls in a child, but the filter drawer scrolls in
 * the panel the listeners sit on, and excluding the root missed that entirely.
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

function reduceMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Put the sheet back where it belongs, optionally easing there.
 *
 * Writes an explicit zero rather than clearing the property. Clearing hands the
 * transform back to the cascade, and a sheet that also carries a CSS entry
 * animation ends up pinned wherever that animation last computed, so a drag
 * released short of the threshold stuck mid-pull instead of returning.
 */
function settle(el: HTMLElement, animate: boolean) {
  el.style.transition = animate ? "transform .22s cubic-bezier(.22,1,.36,1)" : "none";
  el.style.transform = "translateY(0px)";
}

/**
 * Drag-to-dismiss for the mobile sheets: the ladder, the filter drawer, and the
 * tour card. Returns a ref callback; put it on the sheet's own root.
 *
 * The sheet tracks the finger for the whole gesture rather than waiting for a
 * threshold at the end. That is the entire point: a sheet that does not move
 * while you push it gives no feedback about whether the gesture registered or
 * how far is far enough, so every dismissal is a guess.
 *
 * Listeners are attached natively rather than through React props because
 * `touchmove` has to be non-passive. React registers its own touchmove handler
 * passively, so preventDefault there is refused and the page scrolls behind the
 * sheet while you drag it.
 */
export function useDragToDismiss(opts: Opts) {
  // Read through a ref so changing callbacks never re-attach listeners, which
  // mid-gesture would drop the drag on the floor.
  const cfg = useRef(opts);
  cfg.current = opts;

  const drag = useRef<Drag | null>(null);
  const bound = useRef<HTMLElement | null>(null);

  return useCallback((el: HTMLElement | null) => {
    const prev = bound.current;
    if (prev) {
      const h = (prev as HTMLElement & { _cruxDrag?: () => void })._cruxDrag;
      h?.();
    }
    bound.current = el;
    if (!el) return;

    const start = (e: TouchEvent) => {
      // Cleared before every decision below, so a declined gesture can never
      // leave the previous one's start point behind for the next touchend to
      // measure against.
      drag.current = null;
      const t = e.touches[0];
      // A second finger mid-drag means a pinch or a scroll, not our gesture.
      if (!t || e.touches.length > 1) return;
      if (!window.matchMedia(MOBILE).matches) return;
      if (insideScrolledContent(e.target, el)) return;

      const target = e.target as HTMLElement | null;
      const handle = cfg.current.fromHandle;
      if (handle && !target?.closest?.(handle)) return;
      if (target?.closest?.(CONTROLS)) return;

      const max = cfg.current.maxTravel?.(el) ?? el.offsetHeight;
      drag.current = {
        x: t.clientX,
        y: t.clientY,
        lastY: t.clientY,
        lastT: e.timeStamp,
        velocity: 0,
        dy: 0,
        axis: "none",
        travel: Math.max(1, max),
      };
      el.style.transition = "none";
      // Grab a sheet within the third of a second its entry animation runs and
      // the animation keeps winning over the inline transform, so the drag has
      // no visible effect. Whoever is already touching it has seen it arrive.
      // Cancelled rather than overridden with `animation: none`: clearing that
      // inline value afterwards counts as the animation being applied afresh,
      // so the drawer replayed its slide-in every time a gesture settled. A
      // cancelled animation stays cancelled and restarts on its own when the
      // sheet is displayed again.
      el.getAnimations?.().forEach((a) => a.cancel());
    };

    const move = (e: TouchEvent) => {
      const d = drag.current;
      const t = e.touches[0];
      if (!d || !t || d.axis === "theirs") return;

      const dy = t.clientY - d.y;
      const dx = t.clientX - d.x;

      if (d.axis === "none") {
        if (Math.abs(dy) < AXIS_PX && Math.abs(dx) < AXIS_PX) return;
        // Sideways belongs to whatever it started on, such as the chip row.
        if (Math.abs(dx) > Math.abs(dy)) {
          d.axis = "theirs";
          return;
        }
        const wantsDown = dy > 0 && cfg.current.enabled;
        const wantsUp = dy < 0 && !!cfg.current.onExpand;
        // Nothing for us in this direction: hand the gesture back so the page
        // or the ladder body scrolls normally.
        if (!wantsDown && !wantsUp) {
          d.axis = "theirs";
          return;
        }
        d.axis = "ours";
      }

      const dt = e.timeStamp - d.lastT;
      if (dt > 0) d.velocity = (t.clientY - d.lastY) / dt;
      d.lastY = t.clientY;
      d.lastT = e.timeStamp;
      d.dy = dy;

      if (e.cancelable) e.preventDefault();
      // Only downward moves the sheet. Translating it up would lift a
      // bottom-docked panel off the edge and show a strip of page beneath it.
      if (dy > 0 && cfg.current.enabled) {
        el.style.transform = `translateY(${Math.min(dy, d.travel)}px)`;
      }
    };

    const end = () => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.axis !== "ours") {
        settle(el, false);
        return;
      }

      const far = d.dy > Math.min(96, d.travel * 0.3);
      const flicked = d.dy > 16 && d.velocity > FLICK_PX_PER_MS;
      if (cfg.current.enabled && (far || flicked)) {
        // Cleared without easing: the state change that follows hides or
        // collapses the sheet in the same frame, so there is nothing to ease.
        settle(el, false);
        cfg.current.onDismiss();
        return;
      }
      if (d.dy < 0 && cfg.current.onExpand) {
        settle(el, false);
        cfg.current.onExpand();
        return;
      }
      // Short of the threshold: ride back home. The drag itself is direct
      // manipulation and stays under reduced motion; only this easing goes.
      settle(el, !reduceMotion());
    };

    // The browser took the gesture over, so there is no release to read an
    // intent from. Put the sheet back rather than sharing touchend's handler,
    // which would let a cancelled drag dismiss something the reader never let
    // go of.
    const cancel = () => {
      drag.current = null;
      settle(el, !reduceMotion());
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", cancel);

    (el as HTMLElement & { _cruxDrag?: () => void })._cruxDrag = () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, []);
}
