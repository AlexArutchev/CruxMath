"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

export const TOUR_KEY = "crux.tourDone";

/** Forces the tour open regardless of the stored flag: /browse?tour=1 */
export const TOUR_PARAM = "tour";

/**
 * Runs before the body is parsed, so a visitor who has already taken the tour
 * never gets a frame of it. Kept to one statement on purpose: it is render
 * blocking. Paired with the `[data-tour="done"]` rule in globals.css.
 */
export const TOUR_NOFLASH = `try{if(localStorage.getItem('${TOUR_KEY}')==='1')document.documentElement.setAttribute('data-tour','done')}catch(e){}`;

/**
 * Three real rows. Ladder coverage is AIME 2020 onwards and problems 21-25 of
 * the AMCs from 2022, so the 2019 AMC row genuinely has no dot. Showing a real
 * gap rather than a decorative one keeps the illustration honest, and this
 * audience does check. Statements are plain text, not KaTeX: the modal has to
 * paint on the first frame, and typesetting three throwaway previews is the one
 * thing that would stand in the way.
 */
const DEMO_ROWS = [
  {
    src: "2023 AIME I · 12",
    stmt: "Equilateral triangle ABC has side length 55. Points D, E, F lie on BC, CA, AB…",
    diff: "5.5",
    ladder: true,
  },
  {
    src: "2019 AMC 10B · 11",
    stmt: "Two jars each contain the same number of marbles, and every marble is either…",
    diff: "2.0",
    ladder: false,
  },
  {
    src: "2025 AMC 10B · 22",
    stmt: "A seven-digit positive integer is chosen at random. What is the probability…",
    diff: "3.5",
    ladder: true,
  },
];

/**
 * Captions describe solveCost, which prices a wrong answer exactly like a
 * revealed hint. "No hints" alone would be a promise the scoring does not keep:
 * a clean solve on the second guess is a silver, and a student who read only
 * this would think it a bug.
 */
const MEDALS = [
  { key: "gold", name: "GOLD", cap: "no hints, no wrong answers" },
  { key: "silver", name: "SILVER", cap: "one hint, or one wrong answer" },
  { key: "bronze", name: "BRONZE", cap: "two or more" },
] as const;

const FOCUSABLE = "button, [href]";

export default function Tour() {
  // Starts open so the modal is in the server HTML and paints with the first
  // frame, ahead of the library query. Returning visitors are covered by the
  // blocking script above, which hides it until the effect below unmounts it.
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const modal = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const forced =
      new URLSearchParams(window.location.search).get(TOUR_PARAM) === "1";
    let done = false;
    try {
      done = window.localStorage.getItem(TOUR_KEY) === "1";
    } catch {
      // Private mode. Treat as unseen: showing the tour twice is a smaller cost
      // than never showing it.
    }
    if (done && !forced) {
      setOpen(false);
      return;
    }
    // A replay has to beat the pre-paint guard, which has already run.
    document.documentElement.removeAttribute("data-tour");
    opener.current = document.activeElement as HTMLElement | null;
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // Nothing to do. It reappears next visit, which is the safe direction.
    }
    document.documentElement.setAttribute("data-tour", "done");
    opener.current?.focus?.();
  }, []);

  // Escape closes, Tab stays inside. A modal that leaks focus to the filter
  // rail behind the scrim is worse than no modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !modal.current) return;
      const items = Array.from(
        modal.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !modal.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
    };
  }, [open, close]);

  // Focus moves to the modal once it is shown, not on every step, so paging
  // does not yank focus off the button the reader is already using.
  useEffect(() => {
    if (open) modal.current?.focus();
  }, [open]);

  const replay = (
    // Always in the markup, hidden while the modal is up. Rendering it only in
    // the closed branch would mean returning visitors wait for hydration to see
    // it; the CSS guard above pairs with `hidden` to put it on the first frame.
    <button
      className="tour-replay"
      hidden={open}
      onClick={() => {
        document.documentElement.removeAttribute("data-tour");
        setStep(1);
        setOpen(true);
      }}
    >
      REPLAY TOUR
    </button>
  );

  if (!open) return replay;

  return (
    <>
      {replay}
    <div
      className="tour-scrim"
      // Clicking the scrim dismisses, but only the scrim itself: without this
      // check any click inside the modal bubbles up and closes it.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="tour-modal"
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
      >
        <div className="tour-hd">
          <span className="tour-eyebrow">WELCOME TO CRUX MATH · {step} OF 2</span>
          <button className="tour-skip" onClick={close}>
            SKIP
          </button>
        </div>

        {step === 1 ? (
          <div className="tour-body">
            <h2 className="tour-h" id="tour-title">
              Some problems have hint ladders.
            </h2>
            <p className="tour-p">
              We have written hint ladders for every AIME from 2020 onwards, and for
              the last five problems of each AMC since 2022. They are marked by this
              dot: <span className="tour-dot" />
            </p>
            <div className="tour-demo">
              {DEMO_ROWS.map((r, i) => (
                <div className={"tour-row" + (r.ladder ? " r" + i : "")} key={r.src}>
                  <span className={"tour-rdot" + (r.ladder ? " on" : "")} />
                  <span className="tour-rsrc">{r.src}</span>
                  <span className="tour-rstmt">{r.stmt}</span>
                  <span className="tour-rdiff">{r.diff}</span>
                </div>
              ))}
              <svg
                className="tour-cursor"
                width="15"
                height="18"
                viewBox="0 0 15 18"
                aria-hidden="true"
              >
                <path
                  d="M1.5 1 L1.5 14.5 L4.8 11.4 L7 16.4 L9.6 15.2 L7.4 10.3 L11.8 10 Z"
                  fill="#1C1A17"
                  stroke="#FBFAF7"
                  strokeWidth="1"
                />
              </svg>
            </div>
          </div>
        ) : (
          <div className="tour-body">
            <h2 className="tour-h" id="tour-title">
              Fewer hints, finer metal.
            </h2>
            <p className="tour-p">
              Every solve earns a medal for how independently you found it. Gold
              means you got it first try, with the ladder untouched.
            </p>
            <div className="tour-medals">
              {MEDALS.map((m, i) => (
                <div
                  className="tour-mrow"
                  key={m.key}
                  style={{ animationDelay: i * 0.15 + "s" }}
                >
                  <span
                    className={"tour-mdot " + m.key}
                    style={{ animationDelay: i * 0.3 + "s" }}
                  />
                  <span className="tour-mname">{m.name}</span>
                  <span className="tour-mcap">{m.cap}</span>
                </div>
              ))}
              <div className="tour-mfoot">
                <span className="tour-mfoot-l">YOUR STATS ARE IN</span>
                <Link className="tour-mfoot-a" href="/progress" onClick={close}>
                  PROGRESS
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="tour-ft">
          <span className="tour-sdots" aria-hidden="true">
            <span className={"tour-sdot" + (step === 1 ? " on" : "")} />
            <span className={"tour-sdot" + (step === 2 ? " on" : "")} />
          </span>
          <span className="tour-btns">
            {step === 2 && (
              <button className="tour-back" onClick={() => setStep(1)}>
                BACK
              </button>
            )}
            <button
              className="tour-next"
              onClick={() => (step === 1 ? setStep(2) : close())}
            >
              {step === 1 ? "NEXT" : "START SOLVING"}
            </button>
          </span>
        </div>
      </div>
    </div>
    </>
  );
}
