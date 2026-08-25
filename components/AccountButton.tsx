"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

/** Optional account upgrade. Anonymous practice remains available to everyone. */
export default function AccountButton() {
  const { isSignedIn } = useAuth();

  return (
    <div className="account-actions">
      {isSignedIn === true ? (
        <UserButton
          appearance={{
            elements: {
              avatarBox: "account-avatar",
            },
          }}
        />
      ) : (
        <SignInButton mode="modal">
          <button className="account-signin mono" type="button">
            SIGN IN TO SYNC
          </button>
        </SignInButton>
      )}
    </div>
  );
}
