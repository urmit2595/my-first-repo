const { open } = require("../tools/harness");
(async () => {
  for (const [tag, w, h, mobile] of [["p", 390, 844, true], ["l", 1280, 720, false]]) {
    const hh = await open("tests/ui.html", { w, h, mobile, dpr: 1 });
    const pg = hh.page;
    await pg.waitForFunction(() => window.__ready);
    const shot = async (n, wait = 1800) => { await pg.waitForTimeout(wait); await pg.screenshot({ path: `design/qa/ui/${n}-${tag}.png` }); };
    await pg.evaluate(() => Game.showTitle()); await shot("title");
    await pg.click('[data-act="map"]'); await shot("map");
    await pg.click('.sl-map [data-act="back"]'); await pg.waitForTimeout(600);
    await pg.click('[data-act="settings"]'); await shot("settings", 900);
    await pg.click('.sl-scr.vis [data-act="back"]'); await pg.waitForTimeout(500);
    await pg.click('[data-act="begin"]'); await shot("intro", 1400); await shot("hud", 3600);
    await pg.click('[data-act="hint"]'); await shot("hint", 700);
    await pg.click('[data-act="pause"]'); await shot("pause", 900);
    await pg.click('[data-act="resume"]'); await pg.waitForTimeout(500);
    await pg.evaluate(() => { Game.bus.emit("glimmer", { count: 1, total: 3 }); Game.bus.emit("levelComplete", { index: 0, glimmers: 2, total: 3, next: 1 }); }); await shot("complete", 3000);
    await pg.evaluate(() => { Game.levelIndex = 9; Game.bus.emit("levelComplete", { index: 9, glimmers: 0, total: 0, next: null }); }); await pg.waitForTimeout(800);
    await pg.click('[data-act="next"]'); await shot("ending", 1800);
    console.log(tag, hh.errors);
    await hh.close();
  }
})();
