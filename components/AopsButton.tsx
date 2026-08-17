"use client";

import { useState } from "react";
import Button, { buttonClassName } from "./ui/Button";
import ConfirmDialog from "./ui/ConfirmDialog";

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
          className={buttonClassName("secondary", "aops-btn")}
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

  return (
    <div className="aops">
      <Button variant="secondary" className="aops-btn" onClick={() => setPending(true)}>
        FULL SOLUTIONS ON AOPS &rarr;
      </Button>
      <span className="aops-note">
        No hint ladder for this one yet, so this goes straight to the answer.
      </span>
      <ConfirmDialog
        open={pending}
        title="See full solutions?"
        description="This opens a community solution page and may show the answer immediately."
        confirmLabel="SHOW SOLUTIONS"
        onConfirm={() => {
          onView();
          setShown(true);
          setPending(false);
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        onCancel={() => setPending(false)}
      />
    </div>
  );
}
