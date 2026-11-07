# Task for Codex: Squad Surge Tactics Update, tuning pass (A2)

Repo: /home/user/my-first-repo/squad-surge. You built the Tactics Update. Read design/strategy.md and
tools/tactics-notes.md again. This pass may edit `index.html`, `js/juice.js`, `js/meta.js` and `tools/bot-tactics.js`.
No other run is active. Do not run git.

## Findings from real-browser testing (orchestrator)
- Balance bot (casual steering, 2 runs): ALL policies win levels 1–8, with no errors. Score: smart is 1.6–2.7× never;
  random is about the same as never. Good.
- **Problem 1, no stakes.** The end-of-level squad is almost the same for never and smart (level 7: 541 vs 531).
  `liveThreat()` caps losses at `min(10 or 12, ceil(squad*0.24))`, which is 2–5% of a 200–550 squad. Stars (3★ at
  ≥30+10×level) are trivially met. So ignoring threats costs nothing except score, and the strategy does not condition
  survival.
- **Problem 2, the reward is hidden.** In design/qa/tactics/L4-perfect-shield.png, the PERFECT SHIELD callout was queued
  behind a "NICE x1.5" combo callout, and a "TROPHY: CENTURION" toast overlapped the callout panel.

## Do
1. **Threat stakes scale with the squad.**
   - The loss cap per uncountered threat is `ceil(squad * pct)`, where pct is 0.12 (levels 2–3), 0.16 (4–6) or 0.20
     (7+), with a minimum of 4. One threat never takes the squad below 60% of its pre-threat size.
   - Make the threats actually reach that cap when ignored (playtest the numbers with the bot):
     - mortar shells kill `max(2, ceil(3% of squad))` per hit
     - barricade contact kills enough to matter
     - SWARM size scales with the squad: `clamp(round(squad*0.3), 12+3*level, 90)`
   - With the counter used in time, losses stay at about 0.
2. **Stars reward keeping the squad**, which is clear conditioning.
   - Track `L.peakSquad`, the maximum squad size before the boss.
   - 3★ needs `bossSoldiers ≥ 30+10*level` AND kept ≥ 65% of the peak.
   - 2★ needs `bossSoldiers ≥ 10+3*level` AND kept ≥ 35%.
   - Otherwise 1★.
   - Add `keptPct` to the win data.
   - meta.js results: show "SQUAD KEPT 82%" in the tally, plus the hint "Counter threats to keep your squad" when kept
     < 65%.
3. **The PERFECT callout preempts:** it shows immediately and does not wait behind combo or tier callouts, which can
   follow afterwards. Trophy and mission toasts must never overlap the central callout: stack them lower or delay them
   by ≥ 1.2 s.
4. **Bot:** report `stars` and `keptPct` per run, and print a summary table (wins, average stars and average kept per
   policy).
   - Target: **never** still wins 100% of levels 1–8 with casual steering, at mostly 2★ from level 4 on.
   - Target: **smart** gets 3★ clearly more often than never.
   - Keep the threats survivable. The user has said in the past "Too tough" and "I always lose level 7", so do not make
     losing likely.
5. `node --check` everything, including the extracted inline scripts. Finish with a short summary and the final tuning
   values.
