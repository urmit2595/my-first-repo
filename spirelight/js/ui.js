/* SPIRELIGHT UI: DOM + CSS screens (title, spires map, HUD, intro card, pause, settings, complete card, ending).
   Plain script, one global: UI.setup(Game). Everything lives inside Game.ui. */
var UI = (function () {
  "use strict";
  var SRC = "";
  try { SRC = (document.currentScript && document.currentScript.src) || ""; } catch (e) {}
  var ASSETS = SRC ? SRC.replace(/js\/ui\.js(\?.*)?$/, "") + "assets/ui/" : "assets/ui/";

  var CHAPTERS = [
    { n: 1, roman: "I", name: "Embers", theme: "dusk", blurb: "Where the last light lingers" },
    { n: 2, roman: "II", name: "Lanterns", theme: "night", blurb: "A thousand small flames" },
    { n: 3, roman: "III", name: "Veils", theme: "aurora", blurb: "What the eye joins, the road follows" },
    { n: 4, roman: "IV", name: "Daybreak", theme: "dawn", blurb: "The sky remembers the sun" }
  ];
  var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  var ICONS = {
    pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M5 8h14M5 12h14M5 16h14"/></svg>',
    restart: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2.2-5.1"/><path d="M19.5 4.5v4.2h-4.2"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M9.2 17.5h5.6M10 20.5h4"/><path d="M12 3.5a5.6 5.6 0 0 0-3.4 10.1c.6.5.9 1.2.9 1.9h5c0-.7.3-1.4.9-1.9A5.6 5.6 0 0 0 12 3.5z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11"/></svg>'
  };
  var SPARK = '<svg class="spark" viewBox="0 0 24 24"><path d="M12 1.5c.7 5.6 2.4 8.9 5.4 9.9-3 1-4.7 4.3-5.4 11.1-.7-6.8-2.4-10.1-5.4-11.1 3-1 4.7-4.3 5.4-9.9z"/></svg>';
  // a small spire silhouette used on the map nodes
  var SPIRE = '<svg class="spire" viewBox="0 0 40 56"><path class="s-body" d="M20 2l2 6h-4zM17 8h6l1.5 8h-9zM14 16h12l2 12H12zM11 28h18l3 14H8zM8 42h24l-6 10h-4l-2 4-2-4h-4z"/><path class="s-win" d="M18 20h4v5h-4zM16 33h3v5h-3zM21 33h3v5h-3z"/></svg>';

  var CSS = [
    ".sl{position:absolute;inset:0;overflow:hidden;font-family:Georgia,'Times New Roman',serif;color:#fff4e2;--brass:#c8963e;--glow:#ffd27a;--amber:#ffb35a;--ink:#120d24;--teal:#4fd6c9;--cream:#efe2c6;" +
      "--sat:env(safe-area-inset-top,0px);--sar:env(safe-area-inset-right,0px);--sab:env(safe-area-inset-bottom,0px);--sal:env(safe-area-inset-left,0px);-webkit-font-smoothing:antialiased}",
    ".sl *{box-sizing:border-box}",
    ".sl{pointer-events:none}.sl-scr.sl-hud.vis,.sl-scr.sl-intro.vis{pointer-events:none}",
    ".sl button{font:inherit;color:inherit;cursor:pointer;-webkit-appearance:none;appearance:none;touch-action:manipulation}",
    ".sl button:focus{outline:none}",
    ".sl button:focus-visible{outline:2px solid var(--glow);outline-offset:3px;box-shadow:0 0 0 5px #ffd27a33,0 0 24px #ffb35a88}",
    ".sl .disp{font-family:'Sl Display',Georgia,serif}",
    ".sl-scr{position:absolute;inset:0;display:none;opacity:0;transition:opacity .45s ease;pointer-events:none}",
    ".sl-scr.on{display:block}",
    ".sl-scr.vis{opacity:1;pointer-events:auto}",
    /* buttons */
    ".btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;min-width:200px;padding:0 30px;border-radius:999px;border:1px solid #c8963eaa;background:linear-gradient(180deg,#3a2a48ee,#1d1530ee);color:#ffe9c4;font-family:'Sl Display',Georgia,serif;font-weight:700;font-size:15px;letter-spacing:.16em;text-transform:uppercase;text-shadow:0 1px 0 #0008;box-shadow:inset 0 1px 0 #ffd27a40,inset 0 0 0 1px #00000055,0 6px 18px #0007;transition:transform .15s,box-shadow .25s,border-color .25s,filter .25s}",
    ".btn:hover{border-color:#ffd27a;box-shadow:inset 0 1px 0 #ffd27a60,0 6px 22px #0008,0 0 22px #ffb35a55}",
    ".btn:active{transform:translateY(1px) scale(.985)}",
    ".btn.pri{color:#2a1808;border-color:#ffe3a3;background:linear-gradient(180deg,#ffe19a 0%,#ffb35a 55%,#e28a2c 100%);text-shadow:0 1px 0 #fff6;box-shadow:inset 0 1px 0 #fff8,inset 0 -2px 0 #a8591a66,0 0 26px #ffb35a88,0 8px 22px #0008;animation:slGlowBtn 3.2s ease-in-out infinite}",
    ".btn.pri:hover{filter:brightness(1.08);box-shadow:inset 0 1px 0 #fff8,0 0 40px #ffc977cc,0 8px 22px #0008}",
    ".btn.sm{min-height:44px;min-width:0;padding:0 20px;font-size:13px}",
    ".btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".ibtn{width:46px;height:46px;border-radius:50%;padding:0;display:grid;place-items:center;border:1px solid #c8963eaa;background:radial-gradient(circle at 50% 30%,#3a2a48dd,#150f26dd);box-shadow:inset 0 1px 0 #ffd27a40,0 4px 14px #0008;transition:transform .15s,box-shadow .25s,border-color .25s}",
    ".ibtn svg{width:22px;height:22px;fill:none;stroke:#ffd98a;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px #ffb35a66)}",
    ".ibtn:hover{border-color:#ffd27a;box-shadow:inset 0 1px 0 #ffd27a60,0 4px 14px #0008,0 0 18px #ffb35a66}",
    ".ibtn:active{transform:scale(.94)}",
    ".ibtn[disabled]{opacity:.4;pointer-events:none}",
    /* panels */
    ".panel{position:relative;border:1px solid #c8963e99;border-radius:14px;background:linear-gradient(180deg,#2a1d3cf2,#150f26f5);box-shadow:inset 0 0 0 1px #ffd27a1c,inset 0 0 60px #ffb35a10,0 20px 60px #000a,0 0 60px #ffb35a1c}",
    ".panel:before,.panel:after{content:'';position:absolute;width:9px;height:9px;background:#ffd27a;transform:rotate(45deg);box-shadow:0 0 10px #ffb35a;top:-5px;left:50%;margin-left:-5px;border-radius:1px}",
    ".panel:after{top:auto;bottom:-5px}",
    ".h2{font-family:'Sl Display',Georgia,serif;font-weight:700;letter-spacing:.14em;color:#ffe3a8;text-shadow:0 0 18px #ffb35a66,0 2px 0 #0008;margin:0;text-transform:uppercase}",
    ".eyebrow{font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:#e8b86a;opacity:.9}",
    ".rule{height:10px;display:flex;align-items:center;justify-content:center;gap:10px;margin:12px auto;color:#c8963e}",
    ".rule:before,.rule:after{content:'';height:1px;width:64px;background:linear-gradient(90deg,transparent,#c8963e)}",
    ".rule:after{background:linear-gradient(270deg,transparent,#c8963e)}",
    ".rule i{width:7px;height:7px;transform:rotate(45deg);background:#ffd27a;box-shadow:0 0 10px #ffb35a}",
    ".spark{width:1em;height:1em;fill:currentColor;display:inline-block;vertical-align:-.12em}",
    /* title */
    ".sl-title{background:radial-gradient(ellipse 120% 70% at 50% 40%,transparent 30%,#0b0818aa 100%),linear-gradient(180deg,#0b0818dd 0%,#0b081899 22%,transparent 40%,transparent 62%,#0b0818e6 100%)}",
    ".sl-title .col{position:absolute;inset:0;padding:calc(var(--sat) + 2vh) calc(var(--sar) + 20px) calc(var(--sab) + 4vh) calc(var(--sal) + 20px);display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}",
    ".sl-title .head{display:flex;flex-direction:column;align-items:center}",
    ".sl-title .emblem{width:min(24vw,16vh,100px);aspect-ratio:1;background:center/contain no-repeat;filter:drop-shadow(0 0 22px #ffb35aaa) drop-shadow(0 0 60px #ff8a3a66);animation:slFloat 6s ease-in-out infinite}",
    ".sl-title h1{margin:2px 0 0;font-family:'Sl Display',Georgia,serif;font-weight:700;font-size:clamp(26px,8.6vw,48px);letter-spacing:.12em;line-height:1.05;padding-left:.12em;color:#ffe9bd;background:linear-gradient(180deg,#fff6d8 0%,#ffd27a 45%,#d98c36 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 14px #ffb35a99) drop-shadow(0 3px 2px #000a);animation:slWord 5s ease-in-out infinite}",
    ".sl-title .tag{margin:6px 0 0;font-style:italic;font-size:13px;letter-spacing:.06em;color:#f3d9ab;text-shadow:0 1px 6px #000c}",
    ".sl-title .menu{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%}",
    ".sl-title .menu .btn.pri{min-width:min(260px,72vw);min-height:54px;font-size:17px}",
    ".sl-title .row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}",
    ".sl-title .tally{margin-top:4px;color:#ffd98a;font-size:14px;letter-spacing:.12em;text-shadow:0 1px 6px #000c;display:flex;align-items:center;gap:8px}",
    ".sl-title .tally .spark{color:#ffc86a;filter:drop-shadow(0 0 6px #ffb35a)}",
    "@media (min-aspect-ratio:11/10) and (min-width:700px){.sl-title{background:linear-gradient(90deg,#0b0818ee 0%,#0b0818a8 30%,transparent 55%),radial-gradient(ellipse 120% 90% at 60% 50%,transparent 50%,#0b081899 100%)}.sl-title .col{align-items:flex-start;text-align:left;justify-content:center;gap:5vh;padding-left:calc(var(--sal) + 4vw)}.sl-title .head,.sl-title .menu{align-items:flex-start}.sl-title .row{justify-content:flex-start}.sl-title .emblem{width:min(9vw,20vh,120px)}.sl-title h1{font-size:clamp(30px,3.4vw,54px)}.sl-title .menu .btn.pri{min-width:260px}}",
    /* map */
    ".sl-map{background:radial-gradient(ellipse at 50% 0%,#3a2450f5,#0e0a1cfa 70%)}",
    ".sl-map .bar{position:absolute;left:0;right:0;top:0;padding:calc(var(--sat) + 10px) calc(var(--sar) + 14px) 10px calc(var(--sal) + 14px);display:flex;align-items:center;gap:12px;z-index:2;background:linear-gradient(180deg,#0e0a1c,#0e0a1ccc 70%,transparent)}",
    ".sl-map .bar h2{flex:1;text-align:center;font-size:clamp(18px,5vw,26px)}",
    ".sl-map .tot{min-width:46px;display:flex;align-items:center;justify-content:flex-end;gap:6px;color:#ffd98a;font-size:14px;letter-spacing:.06em;white-space:nowrap}",
    ".sl-map .tot .spark{color:#ffc86a;filter:drop-shadow(0 0 5px #ffb35a)}",
    ".sl-map .scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;padding:calc(var(--sat) + 74px) calc(var(--sar) + 14px) calc(var(--sab) + 24px) calc(var(--sal) + 14px);-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}",
    ".sl-map .grid{display:grid;grid-template-columns:1fr;gap:16px;max-width:1280px;margin:0 auto}",
    "@media (min-width:640px){.sl-map .grid{grid-template-columns:1fr 1fr}}",
    "@media (min-width:1000px) and (min-aspect-ratio:11/10){.sl-map .grid{grid-template-columns:repeat(4,1fr);height:calc(100% - 4px)}.sl-map .scroll{display:flex;flex-direction:column;justify-content:center}.sl-map .grid{height:min(100%,560px)}}",
    ".chap{position:relative;border-radius:14px;overflow:hidden;border:1px solid #c8963e88;box-shadow:0 12px 36px #000a,0 0 30px #ffb35a14;background:#1a1230;display:flex;flex-direction:column;min-height:210px}",
    ".chap .art{position:absolute;inset:0;background:center/cover no-repeat;transition:transform 1.2s ease,filter .6s}",
    ".chap:hover .art{transform:scale(1.04)}",
    ".chap.dim .art{filter:saturate(.25) brightness(.45)}",
    ".chap:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#0b081866 0%,transparent 30%,#0b0818b8 68%,#0b0818f2 100%);pointer-events:none}",
    ".chap .in{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:14px 14px 14px;flex:1}",
    ".chap .roman{font-family:'Sl Display',Georgia,serif;font-size:12px;letter-spacing:.3em;color:#ffd27a;text-transform:uppercase;text-shadow:0 1px 6px #000}",
    ".chap h3{margin:2px 0 0;font-family:'Sl Display',Georgia,serif;font-size:clamp(22px,6vw,28px);letter-spacing:.1em;text-transform:uppercase;color:#fff0cf;text-shadow:0 0 16px #ffb35a77,0 2px 6px #000}",
    ".chap .blurb{margin:2px 0 0;font-style:italic;font-size:13px;color:#f1d6a6;text-shadow:0 1px 6px #000}",
    ".chap .nodes{margin-top:auto;padding-top:46px;display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-start}",
    ".node{position:relative;width:68px;min-height:84px;padding:6px 2px 4px;border-radius:12px;border:1px solid #c8963e55;background:linear-gradient(180deg,#1a1230cc,#0d0919dd);display:flex;flex-direction:column;align-items:center;gap:2px;transition:transform .2s,border-color .25s,box-shadow .3s}",
    ".node .spire{width:30px;height:42px}",
    ".node .s-body{fill:#2a2440;stroke:#4b4166;stroke-width:.8}",
    ".node .s-win{fill:#1a1530}",
    ".node .num{font-family:'Sl Display',Georgia,serif;font-size:14px;font-weight:700;letter-spacing:.06em;color:#8d7fa8}",
    ".node .pips{display:flex;gap:1px;height:12px;font-size:11px;color:#6b5e80}",
    ".node .lk{position:absolute;right:5px;top:5px;width:14px;height:14px}.node .lk svg{width:100%;height:100%;fill:none;stroke:#8d7fa8;stroke-width:2;stroke-linecap:round}",
    ".node.lit{border-color:#ffd27a99;background:linear-gradient(180deg,#4a2f34e6,#1d1224ee);box-shadow:0 0 22px #ffb35a55,inset 0 0 18px #ffb35a22}",
    ".node.lit .s-body{fill:#d9a46a;stroke:#ffe3a3}.node.lit .s-win{fill:#fff2b0;filter:drop-shadow(0 0 3px #ffd27a)}",
    ".node.lit .spire{filter:drop-shadow(0 0 7px #ffb35acc)}",
    ".node.lit .num{color:#ffe3a3}.node .pips .on{color:#ffd27a;filter:drop-shadow(0 0 4px #ffb35a)}",
    ".node.cur{border-color:#ffe3a3;background:linear-gradient(180deg,#5a3a34f0,#25162bf0);animation:slNode 2.4s ease-in-out infinite}",
    ".node.cur .s-body{fill:#b97a4a;stroke:#ffd27a}.node.cur .s-win{fill:#ffb35a}",
    ".node.cur .num{color:#fff}",
    ".node.locked{cursor:default;opacity:.8}.node.locked .num{color:#6f6388}",
    ".node:not(.locked):hover{transform:translateY(-3px);border-color:#ffe3a3;box-shadow:0 0 28px #ffb35a88}",
    ".node.locked .s-body{fill:#171227;stroke:#2c2540}",
    /* hud */
    ".sl-hud{pointer-events:none}",
    ".sl-hud>*{pointer-events:auto}",
    ".sl-hud .l,.sl-hud .r{position:absolute;top:calc(var(--sat) + 10px);display:flex;align-items:center;gap:10px}",
    ".sl-hud .l{left:calc(var(--sal) + 12px)}.sl-hud .r{right:calc(var(--sar) + 12px)}",
    ".gcount{height:40px;padding:0 14px 0 10px;border-radius:999px;display:flex;align-items:center;gap:7px;border:1px solid #c8963e88;background:#150f26cc;color:#ffd98a;font-size:15px;letter-spacing:.08em;box-shadow:0 4px 14px #0008;transition:transform .3s,box-shadow .3s}",
    ".gcount .spark{font-size:18px;color:#ffc86a;filter:drop-shadow(0 0 5px #ffb35a)}",
    ".gcount.bump{animation:slBump .6s ease}",
    ".gcount.none{display:none}",
    ".bubble{position:absolute;left:50%;top:calc(var(--sat) + 68px);transform:translate(-50%,-6px);max-width:min(78vw,340px);padding:12px 18px 13px;border-radius:10px;background:linear-gradient(180deg,#f6ead0,#e4d1a6);color:#3a2616;font-style:italic;font-size:15px;line-height:1.35;text-align:center;box-shadow:0 8px 26px #000a,0 0 24px #ffb35a44,inset 0 0 0 1px #b78a4a88;opacity:0;pointer-events:none;transition:opacity .4s,transform .4s}",
    ".bubble:before{content:'';position:absolute;top:-6px;left:50%;margin-left:-6px;width:12px;height:12px;transform:rotate(45deg);background:#f6ead0;border-left:1px solid #b78a4a88;border-top:1px solid #b78a4a88}",
    ".bubble.on{opacity:1;transform:translate(-50%,0)}",
    /* intro */
    ".sl-intro{display:flex;flex-direction:column;align-items:center;text-align:center;padding:calc(var(--sat) + 13vh) 24px 0;pointer-events:none!important}",
    ".sl-intro.vis{opacity:1}",
    ".sl-intro>*{opacity:0;transform:translateY(8px);transition:opacity .9s ease,transform .9s ease}",
    ".sl-intro.vis>*{opacity:1;transform:none}",
    ".sl-intro.vis>*:nth-child(2){transition-delay:.15s}.sl-intro.vis>*:nth-child(3){transition-delay:.3s}.sl-intro.vis>*:nth-child(4){transition-delay:.55s}",
    ".sl-intro .eyebrow{color:#ffe3a3;text-shadow:0 1px 3px #1a0f2a,0 0 14px #1a0f2a,0 0 28px #1a0f2acc}",
    ".sl-intro h2{font-family:'Sl Display',Georgia,serif;font-weight:700;font-size:clamp(28px,8.5vw,54px);letter-spacing:.12em;text-transform:uppercase;margin:10px 0 0;color:#fff0cf;text-shadow:0 0 2px #1a0f2acc,0 2px 4px #1a0f2acc,0 0 22px #1a0f2a,0 0 44px #1a0f2acc}",
    ".sl-intro p{margin:6px 0 0;font-style:italic;font-size:clamp(15px,4vw,20px);color:#fff0cf;text-shadow:0 1px 3px #1a0f2a,0 0 14px #1a0f2a,0 0 30px #1a0f2acc}",
    /* modals */
    ".scrim{background:radial-gradient(circle at 50% 50%,#0b0818cc,#0b0818f0)}",
    ".modal{position:absolute;inset:0;display:grid;place-items:center;padding:calc(var(--sat) + 16px) calc(var(--sar) + 16px) calc(var(--sab) + 16px) calc(var(--sal) + 16px);overflow-y:auto}",
    ".sl-scr .pop-in{transform:translateY(14px) scale(.96);transition:transform .5s cubic-bezier(.2,.9,.3,1)}",
    ".sl-scr.vis .pop-in{transform:none}",
    ".card{width:min(92vw,400px);padding:30px 26px 26px;text-align:center;display:flex;flex-direction:column;align-items:center}",
    ".card .btns{display:flex;flex-direction:column;gap:12px;align-items:center;width:100%;margin-top:8px}",
    ".card .btns .btn{width:100%;max-width:270px}",
    ".card .btns .row{display:flex;gap:10px;width:100%;max-width:270px}.card .btns .row .btn{flex:1;min-width:0;padding:0 10px}",
    ".card h2.h2{font-size:clamp(24px,7vw,32px)}",
    /* settings */
    ".set{display:flex;flex-direction:column;gap:6px;width:100%;margin:6px 0 14px;text-align:left}",
    ".srow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:50px;padding:4px 2px;border-bottom:1px solid #c8963e2e}",
    ".srow:last-child{border:0}",
    ".srow label,.srow .lbl{font-size:16px;letter-spacing:.04em;color:#ffeccb}",
    ".srow small{display:block;font-size:12px;font-style:italic;color:#bfa57e}",
    ".sw{position:relative;width:56px;height:30px;border-radius:999px;border:1px solid #c8963e99;background:#0d0919;padding:0;flex:none;transition:background .25s,box-shadow .25s}",
    ".sw:before{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#d9c8a5,#8a7452);transition:transform .25s,background .25s,box-shadow .25s}",
    ".sw[aria-checked=true]{background:linear-gradient(180deg,#8a4d1a,#d98c36);box-shadow:0 0 16px #ffb35a66}",
    ".sw[aria-checked=true]:before{transform:translateX(26px);background:radial-gradient(circle at 40% 35%,#fffbe8,#ffd27a);box-shadow:0 0 10px #ffe3a3}",
    ".sw{min-height:30px}.sw:after{content:'';position:absolute;inset:-9px -4px}",
    ".seg{display:flex;border:1px solid #c8963e88;border-radius:999px;overflow:hidden;flex:none}",
    ".seg button{min-width:44px;height:36px;padding:0 10px;border:0;background:#0d0919;color:#cdb892;font-size:13px;letter-spacing:.04em;border-right:1px solid #c8963e33}",
    ".seg button:last-child{border-right:0}",
    ".seg button[aria-checked=true]{background:linear-gradient(180deg,#ffd27a,#d98c36);color:#2a1808;font-weight:700}",
    ".seg button:focus-visible{outline-offset:-3px}",
    /* complete */
    ".rays{position:absolute;left:50%;top:50%;width:150vmax;height:150vmax;margin:-75vmax 0 0 -75vmax;pointer-events:none;background:repeating-conic-gradient(from 0deg,#ffb35a30 0deg 6deg,transparent 6deg 24deg);-webkit-mask-image:radial-gradient(circle,#000 0%,transparent 28%);mask-image:radial-gradient(circle,#000 0%,transparent 28%);opacity:0;transition:opacity 1.2s .2s}",
    ".sl-scr.vis .rays{opacity:1;animation:slSpin 60s linear infinite}",
    ".sl-done .h2.big{font-size:clamp(30px,9vw,42px);letter-spacing:.16em;opacity:0;filter:blur(8px);transition:opacity .9s .25s,filter .9s .25s,letter-spacing 1.2s .25s}",
    ".sl-done.vis .h2.big{opacity:1;filter:none;letter-spacing:.2em}",
    ".sl-done .lvname{font-style:italic;color:#f1d6a6;font-size:15px}",
    ".gl{display:flex;gap:10px;justify-content:center;margin:6px 0 2px;font-size:38px}",
    ".gl .spark{fill:#2a2038;stroke:#6b5a78;stroke-width:1;transform:scale(.8);transition:none}",
    ".sl-done.vis .gl .spark.got{animation:slPop .7s cubic-bezier(.2,1.4,.4,1) forwards;animation-delay:calc(.9s + var(--i)*.28s)}",
    ".gl .spark.got{fill:#ffd27a;stroke:#fff1b8;filter:drop-shadow(0 0 10px #ffb35a);opacity:.0}",
    ".sl-done.vis .gl .spark.miss{animation:none;opacity:1}",
    ".gcap{font-size:14px;letter-spacing:.14em;color:#f3d9ab;text-transform:uppercase;margin-bottom:4px}",
    ".sl-done{background:linear-gradient(0deg,#0b0818cc 0%,#0b081855 28%,transparent 48%)}.sl-done .rays{display:none}.sl-done .modal{place-items:end center;padding-bottom:calc(var(--sab) + 12px)}.sl-done .card{width:min(100%,420px);padding:16px 22px 14px;border-radius:16px}.sl-done .card .rule,.sl-done .lvname{display:none}.sl-done .card .btns{margin-top:4px;gap:6px}.sl-done .gl{font-size:28px;margin:2px 0}.sl-done .gcap{margin-bottom:2px;font-size:12px}.sl-done .card .eyebrow{font-size:11px}.sl-done .card h2.h2.big{font-size:clamp(24px,7vw,32px)}.sl-done .lnks{display:flex;gap:26px;justify-content:center}.lnk{min-height:44px;padding:0 12px;background:none;border:0;color:#e8b86a;font-size:13px;letter-spacing:.18em;text-transform:uppercase;text-decoration:underline;text-underline-offset:5px;text-decoration-color:#c8963e88}.lnk:hover{color:#ffe3a3}@media (min-aspect-ratio:11/10) and (min-width:700px){.sl-done .modal{place-items:end end;padding-right:calc(var(--sar) + 4vw)}.sl-done .card{width:360px}}.sl-done .btns{opacity:0;transition:opacity .6s 1.4s}",
    ".sl-done.vis .btns{opacity:1}",
    ".sl-done .card{box-shadow:inset 0 0 0 1px #ffd27a1c,inset 0 0 80px #ffb35a22,0 20px 60px #000a,0 0 90px #ffb35a44}",
    /* ending */
    ".sl-end{background:radial-gradient(ellipse at 50% 38%,#4a2a38e8,#0b0818f6 72%)}",
    ".sl-end .card{width:min(92vw,520px);padding:34px 28px 28px}",
    ".sl-end .emblem{width:min(30vw,120px);aspect-ratio:1;background:center/contain no-repeat;filter:drop-shadow(0 0 24px #ffb35add) drop-shadow(0 0 60px #ff8a3a88);animation:slFloat 6s ease-in-out infinite}",
    ".sl-end p{margin:4px 0 8px;font-style:italic;font-size:16px;line-height:1.5;color:#f6dfb4}",
    ".embers{position:absolute;inset:0;overflow:hidden;pointer-events:none}",
    ".embers i{position:absolute;bottom:-10px;width:4px;height:4px;border-radius:50%;background:#ffd27a;box-shadow:0 0 8px 2px #ffb35a;opacity:0;animation:slEmber 9s linear infinite}",
    /* reduced motion */
    ".sl.calm *,.sl.calm *:before,.sl.calm *:after{animation:none!important;transition-duration:.01s!important;transition-delay:0s!important}",
    ".sl.calm .gl .spark.got{opacity:1;transform:none}",
    ".sl.calm .sl-done .h2.big{opacity:1;filter:none}.sl.calm .sl-done .btns{opacity:1}.sl.calm .sl-intro>*{transform:none}",
    "@keyframes slGlowBtn{50%{box-shadow:inset 0 1px 0 #fff8,inset 0 -2px 0 #a8591a66,0 0 42px #ffc977cc,0 8px 22px #0008}}",
    "@keyframes slFloat{50%{transform:translateY(-5px)}}",
    "@keyframes slWord{50%{filter:drop-shadow(0 0 22px #ffc470cc) drop-shadow(0 3px 2px #000a)}}",
    "@keyframes slNode{50%{box-shadow:0 0 30px #ffb35a99,inset 0 0 18px #ffb35a33}}",
    "@keyframes slBump{30%{transform:scale(1.22);box-shadow:0 0 26px #ffb35a}}",
    "@keyframes slPop{0%{opacity:0;transform:scale(.2) rotate(-40deg)}60%{opacity:1;transform:scale(1.35) rotate(8deg)}100%{opacity:1;transform:scale(1) rotate(0)}}",
    "@keyframes slSpin{to{transform:rotate(360deg)}}",
    "@keyframes slEmber{0%{opacity:0;transform:translate(0,0)}10%{opacity:.9}100%{opacity:0;transform:translate(var(--dx,20px),-105vh)}}",
    "@media (max-height:520px){.card{padding:18px 22px 16px}.sl-intro{padding-top:calc(var(--sat) + 9vh)}.card .btns{gap:8px}.gl{font-size:30px}.sl-title .menu .btn.pri{min-height:48px}.sl-title .col{gap:2vh}}",
    "@media (max-width:360px){.btn{min-width:0;padding:0 18px;letter-spacing:.1em}.node{width:62px}}"
  ].join("\n");

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function setup(Game) {
    var host = Game.ui || document.getElementById("ui");
    if (!host) return null;
    if (!document.getElementById("sl-ui-style")) {
      var st = el("style"); st.id = "sl-ui-style"; st.textContent = CSS; document.head.appendChild(st);
    }
    var testMode = /[?&]test\b/.test(location.search);
    var root = el("div", "sl"); host.appendChild(root);
    var S = {};            // screens
    var cur = null;        // current modal-ish screen name
    var stack = [];        // return stack for back buttons
    var timers = [];
    var hudShown = false;

    function later(fn, ms) { var id = setTimeout(function () { try { fn(); } catch (e) { console.error(e); } }, ms); timers.push(id); return id; }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function click() { try { window.FX && FX.sound && FX.sound("click"); } catch (e) {} }
    function save() { return Game.save || (Game.save = {}); }
    function levels() { return Game.levels || []; }
    function persist() { try { Game.saveNow && Game.saveNow(); } catch (e) {} }
    function unlocked() { var u = save().unlocked; return typeof u === "number" ? u : 1; }
    function doneOf(i) { var l = levels()[i], d = save().done; return l && d ? d[l.id] : null; }
    function totals() {
      var tot = 0, got = 0;
      levels().forEach(function (l, i) { tot += (l.glimmers || []).length; var d = doneOf(i); if (d) got += Math.min(d.glimmers || 0, (l.glimmers || []).length); });
      return { got: got, total: tot };
    }
    function progressIndex() {   // level for "Continue"
      var n = levels().length, i = clamp(unlocked() - 1, 0, Math.max(0, n - 1));
      return i;
    }
    function hasProgress() { return unlocked() > 1 || Object.keys(save().done || {}).length > 0; }
    function guard(fn) { return function (a, b) { try { return fn(a, b); } catch (e) { console.error("[UI]", e); } }; }

    /* ---------- screen helpers ---------- */
    function mk(name, cls) { var s = el("div", "sl-scr " + (cls || "")); s.setAttribute("data-screen", name); root.appendChild(s); S[name] = s; return s; }
    function show(name, noFocus) {
      var s = S[name]; if (!s) return;
      s.classList.add("on"); s.removeAttribute("aria-hidden");
      void s.offsetWidth;
      s.classList.add("vis");
      if (!noFocus) later(function () { var f = s.querySelector("[data-focus]") || s.querySelector("button:not([disabled])"); if (f && s.classList.contains("vis")) { try { f.focus({ preventScroll: true }); } catch (e) {} } }, 60);
    }
    function hide(name) {
      var s = S[name]; if (!s || !s.classList.contains("on")) return;
      s.classList.remove("vis"); s.setAttribute("aria-hidden", "true");
      var onEnd = function () { if (!s.classList.contains("vis")) s.classList.remove("on"); };
      later(onEnd, root.classList.contains("calm") ? 20 : 480);
    }
    var MODALS = ["title", "map", "pause", "settings", "complete", "ending"];
    function hideAllModals(except) { MODALS.forEach(function (n) { if (n !== except) hide(n); }); }
    function open(name, push) {     // switch the modal screen, remembering where we came from
      if (push && cur) stack.push(cur);
      else if (!push) stack = [];
      if (name === "map") refreshMap();
      if (name === "title") refreshTitle();
      if (name === "settings") refreshSettings();
      var prev = cur; cur = name;
      if (S[name]) { if (prev && prev !== name) hide(prev); show(name); }
      if (name === "title" || name === "map" || name === "complete" || name === "ending" || name === "pause") setHud(false);
    }
    function back() {
      var to = stack.pop();
      if (!to) { var st = Game.state; if (st === "paused") to = "pause"; else if (st === "complete") to = "complete"; else if (st === "play") { closeAll(); return; } else to = "title"; }
      var prev = cur; cur = to;
      if (prev) hide(prev);
      if (to === "map") refreshMap(); if (to === "title") refreshTitle();
      show(to);
    }
    function closeAll() { hideAllModals(); cur = null; stack = []; }
    function setHud(on) {
      hudShown = on; var h = S.hud; if (!h) return;
      if (on) { h.classList.add("on"); void h.offsetWidth; h.classList.add("vis"); } else { h.classList.remove("vis"); hideBubble(); later(function () { if (!hudShown) h.classList.remove("on"); }, 480); }
    }

    /* ---------- build: title ---------- */
    var t = mk("title", "sl-title");
    t.innerHTML = '<div class="col"><div class="head"><div class="emblem" role="img" aria-label="Brass lantern sigil"></div><h1>SPIRELIGHT</h1><p class="tag">A lamplighter&#8217;s climb above the clouds</p></div>' +
      '<div class="menu"><button class="btn pri" data-act="begin" data-focus>Begin</button><div class="row"><button class="btn sm" data-act="map">Spires</button><button class="btn sm" data-act="settings">Settings</button></div><div class="tally"></div></div></div>';
    t.querySelector(".emblem").style.backgroundImage = "url(" + ASSETS + "emblem.webp)";
    function refreshTitle() {
      var b = t.querySelector('[data-act="begin"]'); b.textContent = hasProgress() ? "Continue" : "Begin";
      var tt = totals(), ty = t.querySelector(".tally");
      ty.innerHTML = tt.total ? SPARK + "<span>" + tt.got + " / " + tt.total + " glimmers</span>" : "";
    }

    /* ---------- map ---------- */
    var m = mk("map", "sl-map");
    m.innerHTML = '<div class="bar"><button class="ibtn" data-act="back" aria-label="Back">' + ICONS.back + '</button><h2 class="h2">The Spires</h2><div class="tot"></div></div><div class="scroll"><div class="grid"></div></div>';
    function refreshMap() {
      var grid = m.querySelector(".grid"); grid.innerHTML = "";
      var tt = totals(); m.querySelector(".tot").innerHTML = tt.total ? SPARK + " " + tt.got + "/" + tt.total : "";
      var L = levels(), u = unlocked();
      CHAPTERS.forEach(function (ch) {
        var idx = []; L.forEach(function (l, i) { if (l.chapter === ch.n) idx.push(i); });
        var anyOpen = idx.some(function (i) { return i < u; });
        var lit = idx.filter(function (i) { return doneOf(i); }).length;
        var card = el("section", "chap" + (anyOpen ? "" : " dim"));
        card.setAttribute("aria-label", "Chapter " + ch.roman + ", " + ch.name);
        var art = el("div", "art"); art.style.backgroundImage = "url(" + ASSETS + "card-" + ch.theme + ".webp)"; card.appendChild(art);
        var inn = el("div", "in");
        inn.appendChild(el("div", "roman", "Chapter " + ch.roman + (idx.length ? " &middot; " + lit + "/" + idx.length + " lit" : "")));
        inn.appendChild(el("h3", "", ch.name));
        inn.appendChild(el("p", "blurb", ch.blurb));
        var nodes = el("div", "nodes");
        idx.forEach(function (i) {
          var l = L[i], d = doneOf(i), isLocked = i >= u, isCur = !isLocked && !d && i === u - 1 || (!isLocked && !d && i === firstUndone());
          var n = el("button", "node" + (d ? " lit" : "") + (isLocked ? " locked" : "") + (isCur && !d ? " cur" : ""));
          var gl = (l.glimmers || []).length, got = d ? Math.min(d.glimmers || 0, gl) : 0, pips = "";
          for (var k = 0; k < gl; k++) pips += '<span class="' + (k < got ? "on" : "") + '">' + SPARK + "</span>";
          n.innerHTML = SPIRE + '<span class="num">' + (i + 1) + '</span><span class="pips">' + pips + "</span>" + (isLocked ? '<span class="lk">' + ICONS.lock + "</span>" : "");
          n.setAttribute("aria-label", "Spire " + (i + 1) + ", " + l.name + (isLocked ? ", locked" : d ? ", lit" + (gl ? ", " + got + " of " + gl + " glimmers" : "") : ""));
          n.title = isLocked ? "Locked" : l.name;
          if (isLocked) n.setAttribute("aria-disabled", "true"); else n.setAttribute("data-play", i);
          if (isCur) n.setAttribute("data-focus", "");
          nodes.appendChild(n);
        });
        inn.appendChild(nodes); card.appendChild(inn); grid.appendChild(card);
      });
    }
    function firstUndone() { var L = levels(); for (var i = 0; i < L.length; i++) if (i < unlocked() && !doneOf(i)) return i; return -1; }

    /* ---------- HUD ---------- */
    var h = mk("hud", "sl-hud");
    h.innerHTML = '<div class="l"><button class="ibtn" data-act="pause" aria-label="Menu">' + ICONS.menu + '</button><button class="ibtn" data-act="restart" aria-label="Restart level">' + ICONS.restart + '</button></div>' +
      '<div class="r"><div class="gcount none" aria-live="polite">' + SPARK + '<span class="gn">0/0</span></div><button class="ibtn" data-act="hint" aria-label="Hint">' + ICONS.hint + '</button></div><div class="bubble" role="status"></div>';
    var gcount = h.querySelector(".gcount"), gn = h.querySelector(".gn"), bubble = h.querySelector(".bubble"), bubbleT = 0;
    function setGlimmers(n, total) { gcount.classList.toggle("none", !total); gn.textContent = n + "/" + total; }
    function showBubble(text) {
      bubble.textContent = text; bubble.classList.add("on"); clearTimeout(bubbleT);
      bubbleT = setTimeout(hideBubble, 7000);
    }
    function hideBubble() { clearTimeout(bubbleT); bubble.classList.remove("on"); }

    /* ---------- intro card ---------- */
    var it = mk("intro", "sl-intro");
    it.innerHTML = '<div class="eyebrow"></div><h2></h2><div class="rule"><i></i></div><p></p>';
    var introT = 0, introTok = 0;
    document.addEventListener("pointerdown", function () { if (it.classList.contains("vis") && Date.now() - introAt > 500) hideIntro(); }, true);
    var introAt = 0;
    function showIntro(level, index) {
      var ch = CHAPTERS[(level.chapter || 1) - 1] || CHAPTERS[0];
      it.querySelector(".eyebrow").textContent = "Spire " + ROMAN[index + 1] + " · " + ch.name;
      it.querySelector("h2").textContent = level.name || "";
      it.querySelector("p").textContent = level.intro || "";
      it.setAttribute("aria-hidden", "false");
      it.classList.add("on"); void it.offsetWidth; it.classList.add("vis");
      clearTimeout(introT);
      introAt = Date.now(); introT = setTimeout(hideIntro, 3800);
    }
    function hideIntro() { introTok++; clearTimeout(introT); it.classList.remove("vis"); setTimeout(function () { if (!it.classList.contains("vis")) it.classList.remove("on"); }, 1000); }

    /* ---------- pause ---------- */
    var p = mk("pause", "scrim");
    p.innerHTML = '<div class="modal"><div class="panel card pop-in" role="dialog" aria-modal="true" aria-label="Paused"><div class="eyebrow">Paused</div><h2 class="h2">The Lamp Waits</h2><div class="rule"><i></i></div>' +
      '<div class="btns"><button class="btn pri" data-act="resume" data-focus>Resume</button><button class="btn" data-act="restart2">Restart</button><button class="btn" data-act="map-p">Spires</button><button class="btn" data-act="settings-p">Settings</button></div></div></div>';

    /* ---------- settings ---------- */
    var s = mk("settings", "scrim");
    s.innerHTML = '<div class="modal"><div class="panel card pop-in" role="dialog" aria-modal="true" aria-label="Settings"><h2 class="h2">Settings</h2><div class="rule"><i></i></div><div class="set">' +
      '<div class="srow"><label id="l-snd">Sound</label><button class="sw" role="switch" data-set="sound" aria-labelledby="l-snd"></button></div>' +
      '<div class="srow"><label id="l-mus">Music</label><button class="sw" role="switch" data-set="music" aria-labelledby="l-mus"></button></div>' +
      '<div class="srow"><span class="lbl" id="l-q">Quality</span><div class="seg" role="radiogroup" aria-labelledby="l-q"><button role="radio" data-q="auto">Auto</button><button role="radio" data-q="high">High</button><button role="radio" data-q="medium">Med</button><button role="radio" data-q="low">Low</button></div></div>' +
      '<div class="srow"><label id="l-rm">Reduced motion<small>Calmer camera and effects</small></label><button class="sw" role="switch" data-set="reducedMotion" aria-labelledby="l-rm"></button></div>' +
      '</div><div class="btns"><button class="btn pri" data-act="back" data-focus>Done</button></div></div></div>';
    function refreshSettings() {
      var sv = save();
      [].forEach.call(s.querySelectorAll("[data-set]"), function (b) {
        var k = b.getAttribute("data-set"), v = k === "reducedMotion" ? !!Game.reducedMotion : sv[k] !== false;
        b.setAttribute("aria-checked", v ? "true" : "false");
      });
      var q = sv.quality || Game.quality || "auto";
      [].forEach.call(s.querySelectorAll("[data-q]"), function (b) { b.setAttribute("aria-checked", b.getAttribute("data-q") === q ? "true" : "false"); });
    }
    function applyCalm() { root.classList.toggle("calm", !!Game.reducedMotion); }

    /* ---------- complete ---------- */
    var c = mk("complete", "sl-done");
    c.innerHTML = '<div class="rays"></div><div class="modal"><div class="panel card pop-in" role="dialog" aria-modal="true" aria-label="Spire lit"><div class="eyebrow ce"></div><h2 class="h2 big">Spire lit</h2><div class="rule"><i></i></div><div class="lvname"></div>' +
      '<div class="gl"></div><div class="gcap"></div><div class="btns"><button class="btn pri" data-act="next" data-focus>Next spire</button><div class="lnks"><button class="lnk" data-act="replay">Replay</button><button class="lnk" data-act="map-c">Map</button></div></div></div></div>';
    var lastComplete = null;
    function showComplete(d) {
      lastComplete = d;
      var L = levels(), lv = L[d.index] || Game.level || {}, ch = CHAPTERS[(lv.chapter || 1) - 1] || CHAPTERS[0];
      var total = d.total != null ? d.total : (lv.glimmers || []).length, got = clamp(d.glimmers || 0, 0, total);
      c.querySelector(".ce").textContent = "Spire " + ROMAN[d.index + 1] + " · " + ch.name;
      c.querySelector(".lvname").textContent = lv.name || "";
      var gl = c.querySelector(".gl"); gl.innerHTML = "";
      for (var i = 0; i < total; i++) { var sp = el("span", "", SPARK); var svg = sp.firstChild; svg.setAttribute("class", "spark " + (i < got ? "got" : "miss")); svg.style.setProperty("--i", i); gl.appendChild(svg); }
      c.querySelector(".gcap").textContent = total ? got + " / " + total + " glimmers" : "No glimmers hidden here";
      gl.style.display = total ? "flex" : "none";
      var last = isLast(d);
      c.querySelector('[data-act="next"]').textContent = last ? "Finale" : "Next spire";
      open("complete");
    }
    function isLast(d) { var n = levels().length; return d.next == null || d.next < 0 || d.next >= n || d.index >= n - 1; }

    /* ---------- ending ---------- */
    var e = mk("ending", "sl-end");
    e.innerHTML = '<div class="embers"></div><div class="modal"><div class="panel card pop-in" role="dialog" aria-modal="true" aria-label="The end"><div class="emblem"></div><div class="eyebrow" style="margin-top:8px">The last beacon</div><h2 class="h2">The Spires Are Lit</h2><div class="rule"><i></i></div>' +
      '<p>One by one the great lamps woke, and the clouds below ran gold. Somewhere, a small brass lamplighter lowers his lantern and smiles.</p><div class="gcap tallyE"></div>' +
      '<div class="btns"><button class="btn pri" data-act="map-e" data-focus>The Spires</button><button class="btn" data-act="title">Title</button></div></div></div>';
    e.querySelector(".emblem").style.backgroundImage = "url(" + ASSETS + "emblem.webp)";
    (function () { var em = e.querySelector(".embers"); for (var i = 0; i < 18; i++) { var b = document.createElement("i"); b.style.left = (Math.random() * 100) + "%"; b.style.animationDelay = (-Math.random() * 9) + "s"; b.style.animationDuration = (7 + Math.random() * 6) + "s"; b.style.setProperty("--dx", (Math.random() * 80 - 40) + "px"); em.appendChild(b); } })();
    function showEnding() {
      var tt = totals();
      e.querySelector(".tallyE").innerHTML = tt.total ? SPARK + " " + tt.got + " / " + tt.total + " glimmers gathered" : "";
      open("ending");
    }

    /* ---------- actions ---------- */
    var ACT = {
      begin: function () { closeAll(); Game.startLevel(hasProgress() ? progressIndex() : 0); },
      map: function () { open("map", true); },
      "map-p": function () { open("map", true); },
      "map-c": function () { open("map", true); },
      "map-e": function () { open("map", true); },
      settings: function () { open("settings", true); },
      "settings-p": function () { open("settings", true); },
      back: function () { back(); },
      pause: function () { if (Game.state === "play") Game.pause(true); },
      resume: function () { Game.pause(false); },
      restart: function () { if (Game.state === "play") Game.restart(); },
      restart2: function () { Game.pause(false); Game.restart(); },
      hint: function () { var l = Game.level; if (l && l.hint) { if (bubble.classList.contains("on")) hideBubble(); else showBubble(l.hint); } },
      next: function () { if (lastComplete && isLast(lastComplete)) showEnding(); else { closeAll(); Game.nextLevel(); } },
      replay: function () { closeAll(); Game.restart(); },
      title: function () { closeAll(); Game.showTitle(); }
    };
    function playLevel(i) {
      closeAll();
      if (Game.state === "paused") { try { Game.pause(false); } catch (e) {} }
      Game.startLevel(i);
    }
    root.addEventListener("click", guard(function (ev) {
      var b = ev.target.closest && ev.target.closest("button"); if (!b || !root.contains(b)) return;
      if (b.getAttribute("aria-disabled") === "true") return;
      click();
      var a = b.getAttribute("data-act"), sk = b.getAttribute("data-set"), q = b.getAttribute("data-q"), pl = b.getAttribute("data-play");
      if (a && ACT[a]) return ACT[a]();
      if (pl != null) return playLevel(+pl);
      if (sk) {
        var on = b.getAttribute("aria-checked") !== "true";
        if (sk === "reducedMotion") { Game.reducedMotion = on; save().reducedMotion = on; applyCalm(); }
        else save()[sk] = on;
        persist(); refreshSettings(); return;
      }
      if (q) { save().quality = q; try { Game.setQuality && Game.setQuality(q); } catch (e) {} persist(); refreshSettings(); }
    }));
    // stop game input handlers from seeing UI presses
    ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown"].forEach(function (n) { root.addEventListener(n, function (ev) { if (ev.target !== root) ev.stopPropagation(); }, { passive: true }); });
    document.addEventListener("keydown", guard(function (ev) {
      if (ev.key === "Escape") {
        if (cur === "settings" || cur === "map") { back(); ev.preventDefault(); }
        else if (Game.state === "play") { Game.pause(true); ev.preventDefault(); }
        else if (Game.state === "paused" && cur === "pause") { Game.pause(false); ev.preventDefault(); }
      } else if (ev.key === "Tab" && cur) {   // keep focus inside the open modal
        var sc = S[cur]; if (!sc) return;
        var f = [].filter.call(sc.querySelectorAll("button:not([disabled]):not([aria-disabled=true])"), function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        if (i < 0 || (ev.shiftKey && i === 0) || (!ev.shiftKey && i === f.length - 1)) { f[ev.shiftKey ? f.length - 1 : 0].focus(); ev.preventDefault(); }
      }
    }));

    /* ---------- bus ---------- */
    var bus = Game.bus;
    function on(ev, fn) { if (bus && bus.on) bus.on(ev, guard(fn)); }
    on("title", function () { if (pendingC) { clearTimeout(pendingC.t); pendingC = 0; } clearTimers(); hideIntro(); hideAllModals(); cur = null; stack = []; open("title"); });
    on("levelStart", function (d) { if (pendingC) { clearTimeout(pendingC.t); pendingC = 0; }
      hideAllModals(); cur = null; stack = [];
      var lv = d.level || levels()[d.index] || {};
      setGlimmers(0, (lv.glimmers || []).length);
      hideBubble(); setHud(true);
      hideIntro(); if (!testMode) { var tk = ++introTok; requestAnimationFrame(function () { requestAnimationFrame(function () { if (tk === introTok && Game.state === "play") showIntro(lv, d.index); }); }); }
    });
    on("glimmer", function (d) { setGlimmers(d.count, d.total); gcount.classList.remove("bump"); void gcount.offsetWidth; gcount.classList.add("bump"); });
    on("restart", function (d) { if (pendingC) { clearTimeout(pendingC.t); pendingC = 0; } hideAllModals(); cur = null; stack = []; hideBubble(); var lv = Game.level || {}; setGlimmers(0, (lv.glimmers || []).length); setHud(true); hideIntro(); });
    on("pause", function (d) {
      if (d.paused) { open("pause"); } else { if (cur === "pause" || cur === "settings" || cur === "map") { hide(cur); cur = null; stack = []; } setHud(true); }
    });
    on("goal", function () { hideBubble(); hideIntro(); });
    on("beacon", function () { beaconAt = Date.now(); });
    var beaconAt = 0, pendingC = 0;
    function flushComplete() { if (pendingC) { clearTimeout(pendingC.t); var d = pendingC.d; pendingC = 0; hideIntro(); setHud(false); showComplete(d); } }
    document.addEventListener("pointerdown", function () { if (pendingC && Date.now() - pendingC.at > 400) flushComplete(); }, true);
    on("levelComplete", function (d) {
      hideIntro(); hideBubble();
      var wait = testMode ? 0 : beaconAt ? Math.max(0, 2500 - (Date.now() - beaconAt)) : 2600;
      beaconAt = 0; clearTimeout(pendingC && pendingC.t);
      pendingC = { d: d, at: Date.now(), t: setTimeout(flushComplete, wait) };
      if (!wait) flushComplete();
    });
    on("quality", function (d) { if (d && d.level && cur === "settings") refreshSettings(); });

    // initial state
    if (save().reducedMotion != null) Game.reducedMotion = !!save().reducedMotion;
    else if (Game.reducedMotion == null) { try { Game.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (x) {} }
    applyCalm();
    ["hud", "intro"].forEach(function (n) { var s2 = S[n]; if (s2) s2.setAttribute("aria-hidden", "true"); });

    var api = { root: root, screens: S, open: function (n) { closeAll(); open(n); }, close: closeAll, showComplete: showComplete, showEnding: showEnding, showIntro: showIntro, showHint: showBubble, hud: setHud, refresh: function () { refreshTitle(); refreshMap(); refreshSettings(); }, assets: ASSETS };
    Game.ui_api = api; UI.api = api;
    return api;
  }

  return { setup: function (Game) { try { return setup(Game); } catch (e) { console.error("[UI] setup failed", e); return null; } } };
})();
