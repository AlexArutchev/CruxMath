/**
 * Placeholder for the whole Progress page.
 *
 * Used in two places so they cannot drift apart: the route's loading boundary
 * (shown the moment PROGRESS is clicked, while the server renders) and
 * ProgressClient itself (shown while the device's record is fetched in the
 * browser). Shapes mirror the real bands so nothing jumps when data lands.
 */
export default function ProgressSkeleton() {
  const delay = (n: number) => ({ animationDelay: (n * 0.05).toFixed(2) + "s" });

  return (
    <div aria-hidden="true">
      {/* stat band */}
      <div className="pg-band">
        <div className="lead">
          <span className="sk-bar" style={{ width: 120 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12 }}>
            <span className="sk-bar" style={{ width: 78, height: 38, ...delay(1) }} />
            <span className="sk-bar" style={{ width: 150, ...delay(2) }} />
          </div>
          <span
            className="sk-bar"
            style={{ height: 5, maxWidth: 360, width: "100%", marginTop: 16, ...delay(3) }}
          />
        </div>
        <div className="counters">
          {[0, 1, 2].map((i) => (
            <div className="counter" key={i}>
              <span className="sk-bar" style={{ width: 74, ...delay(2 + i) }} />
              <span
                className="sk-bar"
                style={{ width: 44, height: 26, marginTop: 8, ...delay(3 + i) }}
              />
              <span className="sk-bar" style={{ width: 96, marginTop: 8, ...delay(4 + i) }} />
            </div>
          ))}
        </div>
      </div>

      {/* by contest / by difficulty */}
      <div className="pg-mid">
        <div className="pg-contests">
          <span className="sk-bar" style={{ width: 88 }} />
          {[0, 1, 2].map((i) => (
            <div className="pg-crow" key={i}>
              <span className="sk-bar" style={{ width: 56, ...delay(1 + i) }} />
              <span>
                <span className="sk-bar" style={{ width: 130, ...delay(2 + i) }} />
                <span
                  className="sk-bar"
                  style={{
                    height: 4,
                    maxWidth: 260,
                    width: "100%",
                    marginTop: 8,
                    ...delay(3 + i),
                  }}
                />
              </span>
              <span
                className="sk-bar"
                style={{ width: 64, justifySelf: "end", ...delay(4 + i) }}
              />
            </div>
          ))}
        </div>

        <div className="pg-hist">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="sk-bar" style={{ width: 140 }} />
            <span className="sk-bar" style={{ width: 96, ...delay(1) }} />
          </div>
          <div className="pg-bars" style={{ marginTop: 16 }}>
            {[29, 47, 70, 91, 65, 44, 26, 15, 9, 5].map((h, i) => (
              <div className="pg-col" key={i}>
                <span className="sk-bar" style={{ height: h + "%", ...delay(i) }} />
              </div>
            ))}
          </div>
          <div className="pg-axis">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i}>
                <span className="sk-bar" style={{ width: 8, margin: "0 auto", ...delay(i) }} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ledger */}
      <div className="pg-ledger">
        <div className="pg-filters">
          <span className="sk-bar" style={{ width: 108 }} />
          <span className="sk-bar" style={{ width: 320, ...delay(1) }} />
          <span className="sk-bar" style={{ width: 180, ...delay(2) }} />
        </div>
        <div className="pg-matchbar">
          <span className="sk-bar" style={{ width: 210 }} />
          <span className="sk-bar" style={{ width: 100, ...delay(1) }} />
        </div>
        {["58%", "74%", "66%", "80%", "62%", "70%", "54%", "76%"].map((w, i) => (
          <div className="pg-lrow" key={i}>
            <span
              className="sk-bar"
              style={{ width: 11, height: 11, borderRadius: "50%", ...delay(i) }}
            />
            <span className="sk-bar" style={{ width: "78%", ...delay(i + 1) }} />
            <span className="sk-bar" style={{ width: w, ...delay(i + 2) }} />
            <span className="sk-bar" style={{ width: 26, ...delay(i + 3) }} />
            <span
              className="sk-bar"
              style={{ width: "72%", justifySelf: "end", ...delay(i + 4) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
