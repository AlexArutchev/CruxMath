import Header from "@/components/Header";

export const metadata = { title: "Privacy Policy" };

// One place to change the address that appears throughout the policy.
const CONTACT_EMAIL = "support@cruxmath.com";
const LAST_UPDATED = "August 7, 2026";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <div className="legal">
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated: {LAST_UPDATED}</p>

        <p>
          CruxMath is a free, open-source practice tool for competition math. This policy
          explains what data is collected, why, and what choices you have. There are no
          accounts, and we collect as little as possible.
        </p>

        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>An anonymous device ID.</strong> The first time you open the site, your
            browser is issued a random identifier so your progress can be saved. It is not
            linked to a name, an email address, or any account, and we never ask you to sign
            in. Clearing your browser data discards it and creates a new one.
          </li>
          <li>
            <strong>Your practice record.</strong> Which problems you have solved, how many
            hints you revealed, how many wrong answers you submitted, the medal earned, and
            when. This is stored against the anonymous ID above and is what the Progress page
            reads back.
          </li>
          <li>
            <strong>Browser storage.</strong> Your session token is kept in local storage and
            your library filters in session storage, so the site remembers where you were.
            Neither is sent anywhere.
          </li>
          <li>
            <strong>Anonymous usage statistics.</strong> We use two analytics services.
            Vercel Analytics is cookieless and does not track you across sites. Google
            Analytics sets cookies in your browser (see section 3) and tells us things
            like which pages are read, how long people stay, which site or link sent
            them, and roughly which country and device type they used. Neither is given
            your name or your practice record, and neither is used to build an advertising
            profile of you: advertising features and Google Signals are switched off, both
            in our settings and in the code that loads the tag.
          </li>
        </ul>
        <p>
          We do not collect your name, email address, school, age, or any payment
          information, and we do not ask you to create an account.
        </p>

        <h2>2. Technical data our providers see</h2>
        <p>
          CruxMath cannot operate without its hosting and database
          providers briefly processing your <strong>IP address and browser user-agent</strong>{" "}
          in order to deliver pages, create your anonymous session, and block abuse. That
          happens inside Vercel and Supabase. We do not store it in the application, do not
          use it to build a profile of you, and do not combine it with your practice record.
        </p>
        <p>
          Google Analytics also receives your IP address and user-agent, because your
          browser contacts Google directly to load it. Google uses the IP address to
          estimate your country and does not share it back to us; we only ever see
          aggregate reports. If you would rather Google not receive it at all, section 6
          explains how to stop the tag from loading.
        </p>

        <h2>3. Cookies</h2>
        <p>
          CruxMath sets no advertising cookies, and nothing here is used to follow you
          around other websites.
        </p>
        <p>
          Google Analytics sets two first-party cookies in your browser, normally named{" "}
          <code>_ga</code> and <code>_ga_</code> followed by our measurement ID. They hold a
          randomly generated number that lets Google tell a returning visit from a new one,
          so that &ldquo;120 visits&rdquo; is not reported as 120 different people. They
          carry nothing about who you are, they are readable only on this site, and
          advertising features that would extend them across other sites are turned off.
          Vercel Analytics remains cookieless. Other than these, the only client-side
          storage we use is the local storage and session storage described in section 1.
        </p>

        <h2>4. Third-party services</h2>
        <ul>
          <li>
            <strong>Vercel</strong> hosts the site and provides the cookieless analytics.
          </li>
          <li>
            <strong>Google Analytics</strong> provides the more detailed usage statistics
            described in section 1. Your browser loads it from{" "}
            <code>googletagmanager.com</code>, so Google sees the request. Advertising
            features, Google Signals and ads personalisation are disabled.
          </li>
          <li>
            <strong>Supabase</strong> provides the database that holds problems, hint ladders,
            and your anonymous practice record.
          </li>
          <li>
            <strong>Art of Problem Solving</strong> hosts some official contest figures, which
            your browser loads directly from their servers, and is where the &ldquo;full
            solutions&rdquo; links point. Following those links takes you to a site with its
            own privacy policy.
          </li>
        </ul>

        <p>
          Fonts are served from CruxMath itself rather than from a font CDN, so nothing
          needed to <em>render</em> the page comes from a third party. The analytics tag
          above is the exception, and it loads after the page is already usable.
        </p>

        <h2>5. How long we keep it</h2>
        <ul>
          <li>
            <strong>Your practice record</strong> is kept until you clear your browser data or
            ask us to delete it. Clearing browser data leaves the record without any way to
            reach it, since the ID that pointed at it is gone.
          </li>
          <li>
            <strong>Analytics</strong> are retained according to each provider&rsquo;s own
            policy. For Google Analytics we set the shortest retention Google offers for
            visitor-level data, after which only aggregate reports remain.
          </li>
        </ul>

        <h2>6. Your choices</h2>
        <ul>
          <li>
            You can clear your progress at any time by clearing site data for CruxMath in your
            browser. No request to us is needed.
          </li>
          <li>
            You can ask us to delete the record tied to your device. Because we hold nothing
            that identifies you, you will need to send the anonymous ID stored in your
            browser, under the local storage key <code>cruxmath-auth</code>.
          </li>
          <li>
            You can stop Google Analytics from loading. Google publishes an official
            browser opt-out add-on, and any content blocker or a browser with tracking
            protection on will block the tag. Clearing site data also deletes the{" "}
            <code>_ga</code> cookies. Blocking it changes nothing about how the site
            works: the problems, the ladders and your progress all behave the same.
          </li>
          <li>
            Depending on where you live you may also have rights to access or correct your
            data, or to complain to a data protection authority.
          </li>
        </ul>

        <h2>7. Children</h2>
        <p>
          CruxMath is a study tool for contests that students under 13 regularly sit, so we
          expect younger users and have designed accordingly: there are no accounts, no
          personal details are requested, and nothing collected identifies a person. We do not
          knowingly collect personal information from anyone, children included. If you
          believe a child has provided personal information through this site, contact us and
          we will remove it.
        </p>
        <p>
          This shapes how the analytics are configured. Google Signals, ads personalisation
          and all advertising features are switched off, so nothing collected here feeds ad
          targeting or is joined to a Google account. The measurement that remains is
          aggregate: page views, referrers, approximate country, device type. If you are a
          parent or guardian and would prefer your child not be measured at all, section 6
          explains how to block the tag.
        </p>

        <h2>8. Changes</h2>
        <p>
          If this policy changes materially, the date at the top of the page will be updated.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions or deletion requests: <a href={"mailto:" + CONTACT_EMAIL}>{CONTACT_EMAIL}</a>.
          We aim to respond within 30 days.
        </p>
      </div>
    </>
  );
}
