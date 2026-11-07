// node art-src/units2/shot.js OUT.png  (needs the static server on :8765 serving squad-surge/)
const { chromium } = require("playwright");
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  await p.goto("http://localhost:8765/tests/units2.html"); await p.waitForTimeout(1500);
  await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close(); })();
