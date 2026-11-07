/* Operation Homeward presentation. Engine events are authoritative; UI records live
   in ctx.save.storyUI (never a separate storage key). setup is safe to call twice. */
window.Story = (() => {
  'use strict';
  let ctx, game, overlay, panel, homeButton, focusBefore, pending = null;
  let ended = false, currentAssist = 0, lastResult = null, timers = [], disabled = [];
  const offers = {}, elite = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const campaign = () => window.Campaign;
  const missions = () => campaign()?.missions || {};
  const chapters = () => campaign()?.chapters || [];
  const all = () => chapters().flatMap(c => c.missions || []).map(id => missions()[id]).filter(Boolean);
  const ready = () => !!(all().length && typeof ctx?.goMission === 'function');
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function data() {
    if (!ctx.save) return null;
    const s = ctx.save.storyUI ||= {};
    s.records ||= {}; s.vignettes ||= {}; s.offers ||= {};
    return s;
  }
  const persist = () => { try { ctx.persist?.(); } catch (_) { /* memory-only is usable */ } };
  const record = id => data()?.records[id] || {};
  function stars(id) {
    const r = record(id), engine = ctx.save?.campaign;
    const v = r.stars ?? engine?.stars?.[id] ?? engine?.missions?.[id]?.stars ?? 0;
    return Array.isArray(v) ? v.filter(Boolean).length : Math.max(0, Math.min(3, Number(v) || 0));
  }
  const cleared = id => !!record(id).won || stars(id) > 0;
  const next = () => all().find(m => !cleared(m.id)) || all().at(-1);
  const open = id => { const list = all(), i = list.findIndex(m => m.id === id); return i === 0 || (i > 0 && cleared(list[i - 1].id)); };
  const chapterStars = c => c.missions.reduce((n, id) => n + stars(id), 0);
  const complete = c => c.missions.every(cleared);
  const bossNames = ['Ogre Warlord', 'Iron Bulwark', 'Dune Ravager', 'Harbor Gunner', 'Scrap Colossus', 'The Warlord, Reborn'];
  const enemies = ['Brute', 'Shieldbearer · flank its shield or use splash', 'Charger & Bomber · dodge the rush and fuse', 'Rifleman & Medic · move off lasers; target healers', 'Splitter · leave space for its minis', 'Every enemy · combine your counters'];
  const objectives = m => ['Win the mission', 'Keep at least 65% of your peak squad', m.skill?.text || 'Win without Assist'];
  const tag = m => m.tag === 'boss' ? '♛ BOSS' : m.tag === 'hard' ? '☠ HARD' : 'MISSION';
  function portrait(who) {
    const name = ['rook', 'mira', 'warlord'].includes(who) ? who : 'rook';
    return `<span class="st-portrait" aria-hidden="true"><b>${name[0].toUpperCase()}</b><img src="assets/story/${name}.webp" alt=""></span>`;
  }
  function line(pair) { return `<div class="st-radio">${portrait(pair?.[0])}<div><b>${esc(pair?.[0] || 'rook')}</b><p>${esc(pair?.[1] || '')}</p></div></div>`; }
  function imageFallback(root) { root.querySelectorAll('.st-portrait img').forEach(img => { img.onerror = () => img.remove(); }); }
  function close() {
    timers.forEach(clearTimeout); timers = [];
    overlay?.remove(); overlay = panel = null;
    game?.classList.remove('story-open');
    disabled.forEach(([el, was]) => { el.inert = was; }); disabled = [];
    if (focusBefore?.isConnected) focusBefore.focus();
  }
  function sheet(title, kind) {
    const oldFocus = overlay ? focusBefore : document.activeElement;
    close(); focusBefore = oldFocus;
    overlay = document.createElement('div'); overlay.className = 'st-overlay';
    overlay.innerHTML = `<section class="st-panel ${kind || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"></section>`;
    ['pointerdown', 'pointerup', 'click'].forEach(type => overlay.addEventListener(type, e => e.stopPropagation()));
    [...game.children].forEach(el => { disabled.push([el, el.inert]); el.inert = true; });
    game.appendChild(overlay); game.classList.add('story-open');
    panel = overlay.firstChild; panel.focus(); return panel;
  }
  function button(root, text, action, primary = false) {
    const b = document.createElement('button'); b.className = 'btn ' + (primary ? 'go' : 'alt'); b.textContent = text;
    b.onclick = action; root.appendChild(b); return b;
  }
  function refreshHome() {
    if (!homeButton) return;
    homeButton.hidden = !ready();
    const n = next(), started = data()?.started || all().some(m => cleared(m.id));
    homeButton.textContent = started && n ? `CONTINUE · Chapter ${n.chapter}` : 'STORY';
    game.classList.toggle('story-ready', ready());
    const play = document.getElementById('playBtn'); if (play && ready()) play.textContent = 'ARCADE';
  }
  function map(chapterId) {
    if (!ready()) return;
    const p = sheet('Operation Homeward chapter map', 'st-map');
    p.innerHTML = '<h2 class="stroke">OPERATION HOMEWARD</h2><p>Relight the valley. Bring everyone home.</p>';
    button(p, 'BACK', () => { if (lastResult) results(lastResult, true); else close(); });
    const target = next();
    chapters().forEach((c, i) => {
      const district = document.createElement('section'); district.className = 'st-district' + (complete(c) ? ' restored' : ''); district.id = `st-chapter-${c.id}`;
      const rescued = c.missions.reduce((n, id) => n + (Number(record(id).rescued) || 0), 0);
      district.innerHTML = `<h3 class="stroke">${complete(c) ? '☀ ' : ''}CHAPTER ${esc(c.id)} · ${esc(c.name)}</h3><p>${rescued} settlers rescued · ${chapterStars(c)}/18 ★</p><p>♛ ${esc(c.bossName || bossNames[i] || c.boss)}</p>`;
      if (chapterStars(c) >= 15) {
        const toggle = button(district, 'ELITE ' + (elite[c.id] ? 'ON' : 'OFF'), () => { elite[c.id] = !elite[c.id]; map(c.id); });
        toggle.setAttribute('aria-pressed', !!elite[c.id]);
      }
      const path = document.createElement('div'); path.className = 'st-path'; district.appendChild(path);
      c.missions.forEach(id => {
        const m = missions()[id]; if (!m) return;
        const unlocked = open(id), n = stars(id), b = document.createElement('button');
        b.className = 'st-node' + (id === target?.id ? ' next' : ''); b.disabled = !unlocked;
        b.innerHTML = `<strong>${unlocked ? esc(m.n) : '🔒'} ${m.tag === 'boss' ? '♛' : m.tag === 'hard' ? '☠' : ''}</strong><span>${esc(m.title)}</span><small>${'★'.repeat(n)}${'☆'.repeat(3 - n)}${record(id).assisted ? ' · ASSISTED' : ''}</small>`;
        b.setAttribute('aria-label', `${m.title}, ${tag(m)}, ${n} of 3 stars${unlocked ? '' : ', locked'}`);
        b.onclick = () => briefing(id); path.appendChild(b);
      });
      p.appendChild(district);
    });
    const selected = p.querySelector(`#st-chapter-${Number(chapterId || target?.chapter || 1)}`);
    if (selected) p.scrollTop = Math.max(0, selected.offsetTop - p.offsetTop - 100);
  }
  function assist(root, id) {
    const level = offers[id] || data()?.offers[id];
    const label = document.createElement('label'); label.className = 'st-assist'; label.hidden = !level;
    const input = document.createElement('input'); input.type = 'checkbox';
    label.append(input, document.createTextNode(` Assist${level >= 2 ? '+' : ''} · ${level >= 2 ? '35' : '20'}% fewer/weaker enemies + extra drop (max 2 stars)`)); root.appendChild(label);
    return () => input.checked ? (offers[id] || data()?.offers[id] || 1) : 0;
  }
  function launch(id, assistLevel, retry) {
    if (!ready()) { close(); return; }
    const m = missions()[id]; if (!m) return;
    close();
    if (retry && assistLevel === currentAssist && typeof ctx.restartSame === 'function') ctx.restartSame();
    else ctx.goMission(id, { assist: assistLevel, elite: !!elite[m.chapter] });
  }
  function briefing(id) {
    const m = missions()[id]; if (!m || !open(id)) return;
    const p = sheet(m.title);
    p.innerHTML = `<small>${tag(m)} · CHAPTER ${esc(m.chapter)}${elite[m.chapter] ? ' · ELITE' : ''}</small><h2 class="stroke">${esc(m.title)}</h2>` +
      (m.brief || [['rook', 'Squad, move out.'], ['mira', 'Bring our settlers home.']]).slice(0, 2).map(line).join('') +
      `<ul class="st-objectives">${objectives(m).map(t => `<li>☆ ${esc(t)}</li>`).join('')}</ul>`;
    imageFallback(p); const selection = assist(p, id);
    button(p, 'START', () => launch(id, selection()), true); button(p, 'MAP', () => map(m.chapter));
  }
  const tips = {
    'threat:swarm': 'Save AIRSTRIKE for the swarm warning.', 'threat:barricade': 'Use GIANT to break the barricade or steer through its gap.',
    'threat:mortars': 'Use SHIELD when mortars land, or leave the marked lane.', 'threat:mortar': 'Leave the mortar marker before impact.',
    rifleman: 'Change lanes as soon as a rifleman paints a laser.', charger: 'Sidestep the red lane arrow before the charger rushes.',
    bomber: 'Shoot bombers early or move outside their fuse ring.', 'boss:slam': 'Leave the slam marker; strike after the impact.',
    'boss:summon': 'Clear the summoned enemies before they surround you.', 'boss:charge': 'Move into a lane outside the boss charge arrows.',
    'boss:barrage': 'Move away from the marked barrage lanes.', 'boss:shieldWall': 'Flank the shield wall and fire when its core opens.',
    'boss:split': 'Keep space from both halves and use splash damage.', gate: 'Choose the safer gate; avoid subtracting from a small squad.',
    swarm: 'Use AIRSTRIKE before the swarm reaches your squad.', attrition: 'Take recruit gates and save counters for the next threat.'
  };
  function hint(cause) {
    return tips[cause] || (String(cause).startsWith('boss:') ? 'Dodge the marked attack, then fire during the weak point window.' : String(cause).startsWith('threat:') ? 'Watch the threat warning and use its matching counter.' : tips.attrition);
  }
  function vignette(c, m) {
    const p = sheet(`${c.name} restored`, 'st-vignette');
    const reward = window.Meta?.unlockChapter?.(c.id);
    p.innerHTML = `<div class="st-tower" aria-hidden="true">☀</div><h2 class="stroke">${esc(c.name)} LIGHTS UP!</h2>${line(m.win)}<p class="st-reward">ARMORY UNLOCKED<br>${esc(reward?.name || 'Chapter cosmetic')}</p>`;
    const i = chapters().findIndex(x => x.id === c.id), upcoming = chapters()[i + 1];
    p.innerHTML += upcoming ? `<h3>NEXT: ${esc(upcoming.name)}</h3><p>${esc(enemies[i + 1])}</p>` : '<h3>THE VALLEY IS HOME AGAIN.</h3>';
    imageFallback(p); const s = data(); if (s) { s.vignettes[c.id] = true; persist(); }
    button(p, upcoming ? 'NEXT DISTRICT' : 'MAP', () => map(upcoming?.id || c.id), true);
  }
  function results(d, replay = false) {
    const m = missions()[d.id]; if (!m || (ended && !replay)) return; ended = true; lastResult = d;
    const won = d.result === 'win' || d.result === 'won' || d.result === true;
    const bits = Array.isArray(d.stars) ? d.stars.map(Boolean) : [won, won && d.keptPct >= 65, won && !!d.skillOk];
    if (!won) bits.fill(false); if (d.assisted) bits[2] = false;
    const s = data(), old = record(d.id), fails = won ? 0 : (old.fails || 0) + 1;
    if (s && !replay) {
      s.records[d.id] = { ...old, won: old.won || won, stars: Math.max(stars(d.id), bits.filter(Boolean).length),
        rescued: Math.max(old.rescued || 0, won ? Number(d.rescued) || 0 : 0), fails,
        assisted: won ? (old.won ? old.assisted && !!d.assisted : !!d.assisted) : old.assisted };
      if (won) { delete s.offers[d.id]; delete offers[d.id]; }
      else if (fails >= 2) s.offers[d.id] = fails >= 4 ? 2 : 1;
      persist();
    }
    const c = chapters().find(c => c.id === m.chapter);
    if (won && c && complete(c)) window.Meta?.unlockChapter?.(c.id);
    const p = sheet(won ? 'Mission complete' : 'Squad wiped out');
    p.innerHTML = `<small>${esc(m.title)} · ${tag(m)}</small><h2 class="stroke">${won ? 'MISSION COMPLETE!' : 'SQUAD WIPED OUT'}</h2><ul class="st-objectives" aria-live="polite"></ul><h3>SETTLERS RESCUED +${Math.max(0, Number(d.rescued) || 0)}</h3>${d.assisted ? '<p>ASSISTED · third star unavailable</p>' : ''}${won ? line(m.win) : `<p class="st-tip">${esc(hint(d.cause))}</p>`}`;
    const list = p.querySelector('ul');
    objectives(m).forEach((text, i) => {
      const row = document.createElement('li'); row.textContent = `☆ ${text}`; list.appendChild(row);
      const reveal = () => { row.textContent = `${bits[i] ? '★ ✓' : '☆ —'} ${text}`; row.classList.toggle('earned', bits[i]); };
      if (reduced()) reveal(); else timers.push(setTimeout(reveal, 250 + i * 350));
    });
    imageFallback(p); const selection = assist(p, d.id);
    const after = all()[all().findIndex(x => x.id === d.id) + 1];
    const finish = action => { if (won && c && complete(c) && !data()?.vignettes[c.id]) vignette(c, m); else action(); };
    if (won && after) button(p, 'NEXT MISSION', () => finish(() => briefing(after.id)), true);
    else if (won && c && complete(c) && !data()?.vignettes[c.id]) button(p, 'DISTRICT RESTORED', () => vignette(c, m), true);
    button(p, 'RETRY', () => launch(d.id, selection(), true), !won);
    button(p, 'MAP', () => finish(() => map(m.chapter)));
    pending = { id: d.id, rerenderAssist: () => {
      const label = p.querySelector('.st-assist'); if (!label) return;
      const replacement = document.createElement('div'); assist(replacement, d.id);
      // Keep the selection closure attached to the original checkbox.
      label.hidden = false; label.lastChild.textContent = replacement.firstChild.lastChild.textContent;
    } };
    refreshHome();
  }
  function radio(d) {
    if (!d.text || !['play', 'boss', 'bonus'].includes(ctx.state)) return;
    const root = document.getElementById('storyRadio'); root.innerHTML = line([d.who, d.text]); root.hidden = false; imageFallback(root);
    clearTimeout(radio.timer); radio.timer = setTimeout(() => { root.hidden = true; }, 4500);
  }
  const CSS = `
#game.story-open{touch-action:pan-y}.st-overlay{position:absolute;inset:0;z-index:20;padding:12px;background:#0b1328df;display:grid;place-items:center;touch-action:pan-y}
.st-panel{width:100%;max-width:420px;max-height:100%;overflow:auto;overscroll-behavior:contain;box-sizing:border-box;border:3px solid #0d1630;border-radius:24px;padding:18px;background:linear-gradient(#304e87,#172647);color:#fff;text-align:center;font:800 14px Nunito,sans-serif;box-shadow:0 6px 0 #0d1630;touch-action:pan-y}
.st-panel h2,.st-panel h3{font-family:'Lilita One',sans-serif;font-weight:400;margin:10px 0}.st-panel h2{font-size:29px}.st-panel p{margin:7px 0}.st-panel .btn{font-size:20px;min-height:44px;margin-top:12px}.st-panel button:focus-visible,#storyHome:focus-visible{outline:3px solid #fff;outline-offset:3px}
#storyHome{font-size:24px;margin:0 auto 10px;width:90%;display:block}#storyHome[hidden]{display:none}.story-ready #playBtn{font-size:22px;min-height:46px}.story-ready .hint{display:none}.story-ready #home>div:last-child{padding-bottom:12px}.story-ready #home .playbtn{margin-bottom:0}
.st-map{background-image:var(--story-map,linear-gradient(150deg,#19273e,#485461));background-size:cover;background-position:center}.st-district{position:relative;margin:22px 0;padding:12px;border-radius:20px;border:2px solid #657283;background:linear-gradient(135deg,#3d4959ed,#243142ed);overflow:hidden}.st-district.restored{background:linear-gradient(135deg,#637d39ed,#238276ed);border-color:#ffdb68;box-shadow:inset 0 0 45px #ffc94b44}.st-district h3{font-size:23px}.st-district>p{font-size:12px}.st-path{position:relative;display:flex;flex-direction:column;align-items:center;gap:24px;padding:16px 0}.st-path:before{content:'';position:absolute;top:0;bottom:0;left:47%;width:6%;background:repeating-linear-gradient(#c8b88b 0 15px,#5e655f 15px 25px);border:4px solid #142339;transform:rotate(4deg)}
.st-node{position:relative;width:72%;min-height:90px;border:3px solid #0d1630;border-radius:20px;background:linear-gradient(#57b9ff,#2565d6);box-shadow:0 5px 0 #0d1630;color:white;display:grid;gap:3px;padding:10px;font:15px 'Lilita One',sans-serif}.st-node:nth-child(odd){align-self:flex-start}.st-node:nth-child(even){align-self:flex-end}.st-node strong{font-size:24px}.st-node small{color:#ffe478;font-size:20px}.st-node:disabled{background:#4e586b;color:#c4cad6}.st-node.next{animation:st-pulse 1.4s ease-in-out infinite}.st-radio{display:flex;align-items:center;gap:10px;text-align:left;padding:9px;background:#101d35c9;border-radius:14px;margin:8px 0}.st-radio b{text-transform:uppercase;color:#ffdb68}.st-radio p{font:800 13px/1.35 Nunito,sans-serif}.st-portrait{position:relative;flex:none;width:48px;height:54px;border:2px solid #0d1630;border-radius:12px;background:linear-gradient(#6bbbf0,#274d90);overflow:hidden;display:grid;place-items:center}.st-portrait>b{font:32px 'Lilita One',sans-serif}.st-portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.st-objectives{list-style:none;padding:0;text-align:left}.st-objectives li{padding:9px;border-bottom:1px solid #ffffff20;color:#b8c7de}.st-objectives .earned{color:#ffe278}.st-assist{display:flex;gap:9px;text-align:left;align-items:center;padding:12px;background:#263b60;border-radius:12px;font-size:12px}.st-assist[hidden]{display:none}.st-assist input{width:24px;height:24px;flex:none;accent-color:#ffc928}.st-tip,.st-reward{color:#ffdf84}.st-tower{font-size:90px;color:#ffdf69;text-shadow:0 0 45px #ffc928;animation:st-light 1.5s ease-out both}.st-vignette{background:radial-gradient(at top,#899f4b,#245865 65%,#182b49)}
#storyRadio{position:absolute;left:5%;right:5%;top:158px;z-index:7;pointer-events:none;color:white}#storyRadio[hidden]{display:none}#storyRadio .st-radio{box-shadow:0 3px 0 #0d1630}#storyRadio .st-portrait{width:36px;height:40px}
@keyframes st-pulse{50%{box-shadow:0 5px 0 #0d1630,0 0 0 6px #ffdb6877;filter:brightness(1.15)}}@keyframes st-light{from{filter:grayscale(1);opacity:.2}to{filter:none;opacity:1}}@media(prefers-reduced-motion:reduce){.st-node.next,.st-tower{animation:none}}@media(max-height:650px){.st-panel{padding:12px}.st-panel h2{font-size:24px}.st-radio{padding:6px}#storyHome{font-size:20px;min-height:44px}}
`;
  function setup(c) {
    if (ctx || !c?.bus || !c.gameEl) return;
    ctx = c; game = c.gameEl;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const play = document.getElementById('playBtn');
    if (play) {
      homeButton = document.createElement('button'); homeButton.id = 'storyHome'; homeButton.className = 'btn go stroke'; homeButton.hidden = true;
      homeButton.onclick = () => map(); homeButton.addEventListener('pointerdown', e => e.stopPropagation()); play.before(homeButton);
      const old = play.onclick; play.onclick = e => { if (typeof ctx.goArcade === 'function') ctx.goArcade(ctx.save?.level || 1); else old?.call(play, e); };
    }
    const toast = document.createElement('div'); toast.id = 'storyRadio'; toast.hidden = true; toast.setAttribute('aria-live', 'polite'); game.appendChild(toast);
    const art = new Image(); art.onload = () => game.style.setProperty('--story-map', 'url("assets/story/map.webp")'); art.src = 'assets/story/map.webp';
    c.bus.on('missionStart', d => { close(); currentAssist = Number(d.assist) || 0; ended = false; pending = null; lastResult = null; const s = data(); if (s) { s.started = true; persist(); } refreshHome(); });
    c.bus.on('missionEnd', d => results(d));
    c.bus.on('assistOffer', d => { offers[d.id] = d.level; const s = data(); if (s) { s.offers[d.id] = d.level; persist(); } if (pending?.id === d.id) pending.rerenderAssist(); });
    c.bus.on('radio', radio);
    c.bus.on('levelStart', () => { close(); toast.hidden = true; pending = null; ended = false; lastResult = null; });
    c.bus.on('state', d => { if (d.to === 'home') { close(); pending = null; lastResult = null; } if (!['play', 'boss', 'bonus'].includes(d.to)) toast.hidden = true; refreshHome(); });
    window.addEventListener('keydown', e => {
      if (!overlay) {
        if (ctx.state === 'home' && ready() && document.activeElement?.tagName === 'BUTTON' && ['Enter', ' '].includes(e.key)) e.stopImmediatePropagation();
        return;
      }
      e.stopImmediatePropagation();
      if (e.key === 'Escape') { e.preventDefault(); if (pending) map(missions()[pending.id]?.chapter); else close(); }
      if (e.key === 'Tab') {
        const nodes = [...panel.querySelectorAll('button:not(:disabled),input')].filter(el => !el.closest('[hidden]'));
        const index = nodes.indexOf(document.activeElement), nextIndex = (index + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
        e.preventDefault(); nodes[nextIndex]?.focus();
      }
    }, true);
    refreshHome();
  }
  return { setup, map, briefing, hint, refreshHome };
})();
