"use client";

import { useState } from "react";

/**
 * Link out to the AoPS wiki page.
 *
 * When the problem has a ladder the link only appears once nothing is left to
 * spoil (solved, or every rung revealed). When there is no ladder there is
 * nothing to protect, so it appears immediately but behind the same
 * are-you-sure gate the rungs use, since it still goes straight to the answer.
 */
export default function AopsButton({
  url,
  hasLadder,
  earned,
  onView,
}: {
  url: string | null;
  hasLadder: boolean;
  earned: boolean;
  onView: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(false);

  if (!url || !earned) return null;

  const gated = !hasLadder && !shown;

  if (!gated) {
    return (
      <div className="aops">
        <a
          className="aops-btn"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onView}
        >
          FULL SOLUTIONS ON AOPS &rarr;
        </a>
        <span className="aops-note">Community solutions.</span>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="aops">
        <div className="confirm aops-confirm">
          <div className="q">Are you sure you want to see the full solutions?</div>
          <div className="row">
            <a
              className="cbtn yes"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onView();
                setShown(true);
                setPending(false);
              }}
            >
              SHOW SOLUTIONS
            </a>
            <button className="cbtn no" onClick={() => setPending(false)}>
              NOT YET
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aops">
      <button className="aops-btn" onClick={() => setPending(true)}>
        FULL SOLUTIONS ON AOPS &rarr;
      </button>
      <span className="aops-note">
        No hint ladder for this one yet, so this goes straight to the answer.
      </span>
    </div>
  );
}
