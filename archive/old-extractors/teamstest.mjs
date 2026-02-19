// try-all-targets.mjs
// npm install chrome-remote-interface
import { spawn } from "child_process";
import CDP from "chrome-remote-interface";

const TEAMS_BIN = "/Applications/Microsoft Teams.app/Contents/MacOS/MSTeams";
const CDP_PORT = 9222;
const STARTUP_DELAY_MS = 3000;
const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1000;
const PAUSE_BETWEEN_TARGETS = 500;

console.log("🚀 Launching MS Teams (Electron) with CDP enabled...");
const teams = spawn(TEAMS_BIN, [`--remote-debugging-port=${CDP_PORT}`], {
  detached: true,
  stdio: "ignore",
});
teams.unref();

async function connectAndTryAll() {
  try {
    console.log("🔌 Fetching available targets...");
    const targets = await CDP.List({ port: CDP_PORT });

    const pageTargets = targets.filter((t) => t.type === "page");
    if (pageTargets.length === 0) {
      console.log("❌ No page targets yet, retrying...");
      return setTimeout(connectAndTryAll, 1000);
    }

    console.log(`✅ Found ${pageTargets.length} page targets. Trying all...`);

    for (const t of pageTargets) {
      console.log(`\n➡️ Trying target: ${t.url || "(no url)"}`);

      try {
        const client = await CDP({ target: t, port: CDP_PORT });
        const { Runtime } = client;

        for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
          console.log(`⏳ Attempt ${attempt}/${POLL_ATTEMPTS} on this target...`);

          const js = `
            (function(){
              try {
                const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                const match = buttons.find(el => {
                  const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                  const txt = (el.innerText || el.textContent || '').toLowerCase();
                  return aria.includes('assignments') || txt.includes('assignments');
                });
                return {
                  ok: !!match,
                  clicked: match ? (match.click(), true) : false,
                  foundCount: buttons.length,
                  ariaLabels: buttons.slice(0,5).map(b => b.getAttribute('aria-label'))
                };
              } catch (e) {
                return { ok: false, error: String(e) };
              }
            })();
          `;

          const result = await Runtime.evaluate({ expression: js }).catch(() => null);
          const val = result?.result?.value;

          if (!val) {
            console.log("⚠️ Could not evaluate script on this target.");
          } else if (val.ok) {
            console.log("✅ SUCCESS: Clicked Assignments!");
            console.log(`   Buttons seen: ${val.foundCount}, first labels:`, val.ariaLabels);
            await client.close();
            process.exit(0);
          } else {
            console.log(`❌ Not found (buttons seen: ${val.foundCount ?? "?"}), labels:`, val.ariaLabels);
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        await client.close();
      } catch (err) {
        console.log(`⚠️ Error on target ${t.url || "(no url)"}:`, err.message);
      }

      await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_TARGETS));
    }

    console.log("\n⏳ Tried all targets, retrying full scan...");
    setTimeout(connectAndTryAll, 2000);
  } catch (err) {
    console.error("❌ Error listing targets:", err.message);
    setTimeout(connectAndTryAll, 1000);
  }
}

setTimeout(connectAndTryAll, STARTUP_DELAY_MS);