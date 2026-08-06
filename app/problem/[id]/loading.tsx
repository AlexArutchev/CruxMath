import Header from "@/components/Header";

/**
 * Shown the instant a problem link is clicked, while the server fetches the
 * problem and its ladder. Without this boundary the browser sits on the previous
 * page for the whole round trip and the click feels dead.
 *
 * The shapes mirror the real solve layout so nothing jumps when content lands.
 */
export default function Loading() {
  return (
    <>
      <Header />
      <div className="stage" aria-hidden="true">
        <div className="col">
          <div className="sk-meta">
            <span className="sk-bar" style={{ width: 190 }} />
            <span className="sk-bar" style={{ width: 120, animationDelay: ".05s" }} />
            <span className="sk-bar" style={{ width: 150, animationDelay: ".1s" }} />
          </div>

          <div className="sk-stack" style={{ maxWidth: 640 }}>
            {["96%", "92%", "78%", "54%"].map((w, i) => (
              <span
                key={i}
                className="sk-bar"
                style={{
                  width: w,
                  height: 13,
                  animationDelay: (0.15 + i * 0.05).toFixed(2) + "s",
                }}
              />
            ))}
          </div>

          <div className="answer" style={{ marginTop: 34 }}>
            <span className="sk-bar" style={{ width: 180, animationDelay: ".35s" }} />
            <span className="sk-bar" style={{ width: 250, height: 46, animationDelay: ".4s" }} />
            <span className="sk-bar" style={{ width: 92, height: 40, animationDelay: ".45s" }} />
          </div>
        </div>

        <aside>
          <div className="ltop">
            <span className="sk-bar" style={{ width: 96 }} />
            <span className="sk-bar" style={{ width: 110, animationDelay: ".05s" }} />
          </div>
          <div style={{ height: 14 }} />
          {[0, 1, 2, 3].map((i) => (
            <div className="sk-aside-rung" key={i}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  className="sk-bar"
                  style={{ width: 14, animationDelay: (0.1 + i * 0.08).toFixed(2) + "s" }}
                />
                <span
                  className="sk-bar"
                  style={{
                    width: i === 0 ? "72%" : "58%",
                    animationDelay: (0.14 + i * 0.08).toFixed(2) + "s",
                  }}
                />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
