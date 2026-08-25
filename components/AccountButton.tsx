"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";

/** Optional account upgrade. Anonymous practice remains available to everyone. */
export default function AccountButton() {
  return (
    <div className="account-actions">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="account-signin mono" type="button">
            SIGN IN TO SYNC
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton
          appearance={{
            elements: {
              avatarBox: "account-avatar",
            },
          }}
        />
      </Show>
    </div>
  );
}
