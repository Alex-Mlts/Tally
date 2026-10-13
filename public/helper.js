// Tally helper: a small vector mascot in the bottom-right corner.
// Idle: peeks over the edge, then naps, plays it cool or works. Hover: pops up and waves.
// Click (or H): a chat panel that answers questions and runs tasks from the data already loaded.
(() => {
  "use strict";
  const A = window.TallyApp;
  if (!A) return;
  const t = (k, v) => A.t(k, v), esc = A.esc;
  const $ = id => document.getElementById(id);
  const IDLE_AFTER = 40000, IDLE_EVERY = 26000, IDLE_STATES = ["sleeping", "cool", "working"];
  const reduce = () => document.documentElement.dataset.motion === "reduce" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  // ---------- the character (inline SVG, drawn in a 160 x 150 box) ----------
  const INK = "#0f1433";
  const svg = `
<svg class="tm-svg" viewBox="0 0 160 150" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="tmFront" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#f4f6fc"/><stop offset="1" stop-color="#dbe2f2"/></linearGradient>
    <linearGradient id="tmSide" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#4f8bff"/><stop offset="1" stop-color="#1443cf"/></linearGradient>
    <linearGradient id="tmTop" x1="0" y1="0" x2="1" y2=".3"><stop offset="0" stop-color="#1a2456"/><stop offset="1" stop-color="#2c3b7e"/></linearGradient>
    <linearGradient id="tmBoxG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2b07a"/><stop offset="1" stop-color="#c98e55"/></linearGradient>
  </defs>
  <ellipse class="tm-shadow" cx="88" cy="146" rx="50" ry="4.5"/>

  <!-- sparkle dashes (peek / hello) -->
  <g class="tm-spark" stroke="#3b82ff" stroke-width="4.5" stroke-linecap="round">
    <path d="M22 26 l-7 -8"/><path d="M14 40 l-9 -2"/><path d="M146 22 l6 -9"/><path d="M152 38 l9 -3"/>
  </g>

  <g class="tm-char">
    <g class="tm-bodyg">
      <g transform="translate(-27.5 0) scale(.14)">
  <defs>
    <linearGradient id="cbSide" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#0a6cff"/><stop offset="1" stop-color="#0041d6"/></linearGradient>
    <linearGradient id="cbFront" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f7f6f8"/><stop offset="1" stop-color="#dbe5fb"/></linearGradient>
    <linearGradient id="cbTop" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#0a2459"/><stop offset="1" stop-color="#22396f"/></linearGradient>
    <radialGradient id="cbPaw" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#1a2b5a"/><stop offset="1" stop-color="#07112c"/></radialGradient>
  </defs>
  <g class="tm-feet">
    <g class="tm-foot-l"><ellipse cx="582" cy="967" rx="100" ry="73" fill="url(#cbPaw)"/><ellipse cx="560" cy="940" rx="38" ry="16" fill="#4d5c82" opacity=".55" transform="rotate(-8 560 940)"/></g>
    <g class="tm-foot-r"><ellipse cx="907" cy="944" rx="113" ry="76" fill="url(#cbPaw)"/><ellipse cx="900" cy="915" rx="44" ry="17" fill="#4d5c82" opacity=".55" transform="rotate(-8 900 915)"/></g>
  </g>
  <!-- blue side -->
  <path d="M300 268 Q262 272 256 320 L242 690 Q240 752 300 788 L548 912 L522 360 Z" fill="url(#cbSide)" stroke="url(#cbSide)" stroke-width="30" stroke-linejoin="round"/>
  <path d="M296 368 L298 658 L396 722 L458 700 L498 734 L428 576 L408 586 L408 646 L350 602 L344 476 L414 512 L446 452 Z" fill="#25b2ff" stroke="#25b2ff" stroke-width="18" stroke-linejoin="round" opacity=".95"/>
  <!-- white body: top rim and front -->
  <path d="M286 268 Q300 240 360 214 L720 108 Q770 96 850 110 L1090 210 Q1150 240 1162 300 L1176 770 Q1176 812 1130 826 L640 906 Q574 914 566 860 L540 410 Q534 372 500 356 Z" fill="#fdfbfb" stroke="#fdfbfb" stroke-width="30" stroke-linejoin="round"/>
  <path d="M286 268 L500 356 Q534 372 540 410 L566 860" fill="none" stroke="#dfe7fb" stroke-width="22" stroke-linecap="round" opacity=".9"/>
  <!-- front face plane -->
  <path d="M600 340 L1120 268 Q1162 264 1164 310 L1172 760 Q1172 800 1130 810 L650 892 Q594 900 590 850 L572 392 Q570 346 600 340 Z" fill="url(#cbFront)"/>
  <!-- navy top panel -->
  <path d="M391 222 L500 170 L740 122 L830 132 L1010 203 L595 302 Z" fill="url(#cbTop)" stroke="url(#cbTop)" stroke-width="64" stroke-linejoin="round"/>
  <!-- face -->
  <g class="tm-face">
    <g class="tm-eyes"><g class="tm-eyes-open">
      <g class="tm-eye"><ellipse cx="724" cy="611" rx="49" ry="71" fill="#07132f"/><circle cx="709" cy="582" r="17" fill="#fff"/></g>
      <g class="tm-eye"><ellipse cx="1036" cy="547" rx="45" ry="71" fill="#07132f"/><circle cx="1022" cy="518" r="16" fill="#fff"/></g></g>
      <g class="tm-eyes-happy" stroke="#07132f" stroke-width="26" stroke-linecap="round" fill="none"><path d="M676 625 q48 -66 96 0"/><path d="M992 560 q44 -66 88 0"/></g>
      <g class="tm-eyes-shut" stroke="#07132f" stroke-width="24" stroke-linecap="round" fill="none"><path d="M678 612 q46 40 92 0"/><path d="M994 548 q42 40 84 0"/></g>
    </g>
    <g class="tm-mouths" stroke="#07132f" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
      <path class="tm-m tm-m-smile" d="M838 644 Q892 690 944 634" fill="none" stroke-width="30"/>
      <g class="tm-m tm-m-open"><path d="M826 636 L956 622 Q954 712 896 716 Q836 718 826 636Z" fill="#07132f"/><path d="M856 690 Q894 664 930 684 Q894 712 856 690Z" fill="#ff5d73" stroke="none"/></g>
      <ellipse class="tm-m tm-m-o" cx="892" cy="664" rx="26" ry="32" fill="#07132f" stroke="none"/>
      <path class="tm-m tm-m-sad" d="M836 680 Q892 628 948 670" fill="none"/>
      <path class="tm-m tm-m-flat" d="M846 660 L940 650" fill="none"/>
      <path class="tm-m tm-m-smirk" d="M836 652 Q900 690 952 620" fill="none"/>
    </g>
    <ellipse class="tm-cheek" cx="650" cy="700" rx="42" ry="22"/><ellipse class="tm-cheek" cx="1090" cy="640" rx="40" ry="21"/>
  </g>
  <!-- arms -->
  <g class="tm-arm tm-arm-l"><ellipse cx="410" cy="816" rx="90" ry="118" transform="rotate(38 410 816)" fill="url(#cbPaw)"/><ellipse cx="392" cy="760" rx="30" ry="16" fill="#4d5c82" opacity=".55" transform="rotate(-40 392 760)"/></g>
  <g class="tm-arm tm-arm-r"><ellipse cx="1216" cy="730" rx="74" ry="104" transform="rotate(-30 1216 730)" fill="url(#cbPaw)"/><ellipse cx="1232" cy="690" rx="26" ry="14" fill="#4d5c82" opacity=".55" transform="rotate(-40 1232 690)"/></g>
  <g class="tm-arm tm-arm-wave"><ellipse cx="1290" cy="420" rx="72" ry="104" transform="rotate(28 1290 420)" fill="url(#cbPaw)"/><ellipse cx="1300" cy="372" rx="26" ry="14" fill="#4d5c82" opacity=".55" transform="rotate(-30 1300 372)"/></g>
  <g class="tm-arm tm-arm-up2"><ellipse cx="200" cy="560" rx="72" ry="104" transform="rotate(-30 200 560)" fill="url(#cbPaw)"/></g><g class="tm-p tm-p-glasses"><g transform="rotate(-11 880 580)"><rect x="616" y="530" width="216" height="156" rx="64" fill="#07132f"/><rect x="928" y="530" width="216" height="156" rx="64" fill="#07132f"/><path d="M822 590 h112" stroke="#07132f" stroke-width="22"/><path d="M660 570 l60 0" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".6"/><path d="M972 570 l60 0" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".6"/></g></g></g>
      <path class="tm-sweat" d="M140 52 q4 6 0 9 q-4 -3 0 -9z" fill="#5aa2ff"/>
      <!-- props -->
      <g class="tm-p tm-p-glasses"><path class="tm-star" d="M146 30 l2.6 6 6 2.6 -6 2.6 -2.6 6 -2.6 -6 -6 -2.6 6 -2.6z" fill="#ffc83d"/></g>
      <g class="tm-p tm-p-laptop" transform="translate(0 10)">
        <path d="M70 130 h76 l8 8 h-92z" fill="#3a4154"/>
        <rect x="74" y="96" width="68" height="36" rx="5" fill="#59627a"/><rect x="74" y="96" width="68" height="5" rx="2.5" fill="#6d7790"/>
        <g transform="translate(108 114)" fill="none" stroke="#c9d6f2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 -6 h-6 a3 3 0 0 0 -3 3 v6 a3 3 0 0 0 3 3 h6"/><path d="M-2 -2 v3.5 h5"/><path d="M1.5 -0.5 l2 2 -2 2"/></g>
        <ellipse class="tm-type-l" cx="84" cy="97" rx="8" ry="6.5" fill="${INK}"/><ellipse class="tm-type-r" cx="132" cy="97" rx="8" ry="6.5" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-box">
        <path d="M54 104 h80 v32 a4 4 0 0 1 -4 4 h-72 a4 4 0 0 1 -4 -4z" fill="url(#tmBoxG)"/>
        <path d="M54 104 l-10 -12 h80 l10 12z" fill="#eec08f"/><path d="M134 104 l12 -12" stroke="#c98e55" stroke-width="5" stroke-linecap="round"/>
        <rect x="80" y="114" width="28" height="14" rx="2" fill="#fff"/><path d="M84 117 v8 M87 117 v8 M91 117 v8 M93 117 v8 M97 117 v8 M100 117 v8 M104 117 v8" stroke="${INK}" stroke-width="1.6"/>
      </g>
      <g class="tm-p tm-p-carry" transform="translate(4 6)">
        <rect x="96" y="96" width="46" height="36" rx="3" fill="url(#tmBoxG)"/><path d="M96 106 h46" stroke="#b7804a" stroke-width="2"/>
        <rect x="106" y="111" width="26" height="12" rx="1.5" fill="#fff"/><path d="M109 113 v8 M112 113 v8 M115 113 v8 M118 113 v8 M121 113 v8 M125 113 v8 M128 113 v8" stroke="${INK}" stroke-width="1.5"/>
        <ellipse cx="96" cy="116" rx="8" ry="10" fill="${INK}"/><ellipse cx="143" cy="112" rx="7" ry="10" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-clip">
        <rect x="112" y="78" width="40" height="52" rx="5" fill="#26314f"/><rect x="116" y="84" width="32" height="42" rx="2" fill="#fff"/>
        <rect x="124" y="74" width="16" height="9" rx="3" fill="#5b6478"/>
        <g stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M119 93 l2.5 2.5 5 -5 M119 104 l2.5 2.5 5 -5 M119 115 l2.5 2.5 5 -5" stroke="#2f6bff" stroke-width="2.4"/><path d="M131 93 h12 M131 104 h12 M131 115 h9" stroke="#b9c2d6" stroke-width="2.4"/></g>
        <ellipse cx="113" cy="114" rx="7.5" ry="10" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-paper">
        <path d="M114 82 l30 -4 l5 44 l-30 4z" fill="#fff" stroke="#d6dcea" stroke-width="1.5"/>
        <path d="M120 90 l18 -2.4 M121 98 l18 -2.4 M122 106 l18 -2.4 M123 114 l11 -1.4" stroke="#aab4ca" stroke-width="2.2" stroke-linecap="round"/>
        <ellipse cx="117" cy="114" rx="7.5" ry="10" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-glass">
        <path d="M134 98 l14 18" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
        <circle cx="124" cy="84" r="15" fill="#d8ecff" fill-opacity=".55" stroke="#26314f" stroke-width="5"/><path d="M115 79 q3 -6 9 -6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>
        <ellipse cx="144" cy="114" rx="8" ry="10" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-cal" transform="translate(6 4)">
        <rect x="110" y="80" width="42" height="40" rx="6" fill="#fff" stroke="#2f6bff" stroke-width="3"/><path d="M110 92 h42 v-6 a6 6 0 0 0 -6 -6 h-30 a6 6 0 0 0 -6 6z" fill="#2f6bff"/>
        <path d="M120 76 v8 M142 76 v8" stroke="#1a3fb5" stroke-width="3.4" stroke-linecap="round"/>
        <g fill="#bcd0ff"><rect x="116" y="97" width="7" height="6" rx="1.5"/><rect x="127" y="97" width="7" height="6" rx="1.5"/><rect x="138" y="97" width="7" height="6" rx="1.5"/><rect x="116" y="107" width="7" height="6" rx="1.5"/><rect x="127" y="107" width="7" height="6" rx="1.5" fill="#2f6bff"/></g>
        <ellipse cx="111" cy="112" rx="7.5" ry="10" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-chart" transform="translate(4 0)">
        <path d="M120 128 l6 -10 M146 128 l-6 -10" stroke="#5b6478" stroke-width="3" stroke-linecap="round"/>
        <rect x="110" y="72" width="46" height="46" rx="4" fill="#fff" stroke="#3f4658" stroke-width="3"/>
        <g fill="#2f6bff"><rect x="118" y="100" width="7" height="12" rx="1"/><rect x="129" y="92" width="7" height="20" rx="1" fill="#5c92ff"/><rect x="140" y="82" width="7" height="30" rx="1"/></g>
        <path d="M112 106 l-6 6" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
      </g>
      <g class="tm-p tm-p-gear">
        <path d="M134 92 l4 0 1.4 5 4.6 1.9 4.4 -2.6 2.8 2.8 -2.6 4.4 1.9 4.6 5 1.4 0 4 -5 1.4 -1.9 4.6 2.6 4.4 -2.8 2.8 -4.4 -2.6 -4.6 1.9 -1.4 5 -4 0 -1.4 -5 -4.6 -1.9 -4.4 2.6 -2.8 -2.8 2.6 -4.4 -1.9 -4.6 -5 -1.4 0 -4 5 -1.4 1.9 -4.6 -2.6 -4.4 2.8 -2.8 4.4 2.6 4.6 -1.9z" fill="#8a93a8"/>
        <circle cx="136" cy="112" r="6" fill="#dfe4ee"/><ellipse cx="118" cy="118" rx="7.5" ry="10" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-alert">
        <path d="M134 50 l20 34 a3 3 0 0 1 -2.6 4.5 h-34.8 a3 3 0 0 1 -2.6 -4.5 l17.4 -34 a3 3 0 0 1 2.6 0z" fill="#ef3e3e"/>
        <path d="M135.4 62 v13" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/><circle cx="135.4" cy="81.5" r="2.7" fill="#fff"/>
      </g>
      <g class="tm-p tm-p-check"><circle cx="140" cy="38" r="14" fill="#22b35e"/><path d="M133 38 l5 5 9 -10" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>
      <g class="tm-p tm-p-q"><path d="M134 22 q0 -9 9 -9 q9 0 9 8 q0 6 -7 8 q-2 1 -2 5" stroke="#2f6bff" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="143" cy="42" r="3" fill="#2f6bff"/></g>
      <g class="tm-p tm-p-bulb">
        <g stroke="#ffc83d" stroke-width="3" stroke-linecap="round"><path d="M137 6 v-6"/><path d="M120 13 l-4 -4"/><path d="M154 13 l4 -4"/><path d="M114 27 h-6"/><path d="M160 27 h6"/></g>
        <path d="M137 12 a14 14 0 0 1 8 25 v6 h-16 v-6 a14 14 0 0 1 8 -25z" fill="#ffd34d"/><rect x="130" y="44" width="14" height="6" rx="2" fill="#7b8396"/>
      </g>
      <g class="tm-p tm-p-heart">
        <path d="M118 102 c-8 -10 2 -20 10 -12 c8 -8 18 2 10 12 l-10 11z" fill="#ef3e5a"/>
        <path d="M144 42 c-3 -4 1 -8 4 -5 c3 -3 7 1 4 5 l-4 4z" fill="#ff6b84"/>
        <ellipse cx="114" cy="108" rx="7.5" ry="9" fill="${INK}"/><ellipse cx="142" cy="106" rx="7.5" ry="9" fill="${INK}"/>
      </g>
      <g class="tm-p tm-p-confetti" stroke-width="4" stroke-linecap="round">
        <path d="M10 70 l8 4" stroke="#3b82ff"/><path d="M18 46 l3 -9" stroke="#ffc83d"/><path d="M150 50 l8 -4" stroke="#22b35e"/><path d="M148 92 l9 3" stroke="#ef3e5a"/><path d="M124 18 l4 -8" stroke="#3b82ff"/><path d="M36 14 l-2 -9" stroke="#ef3e5a"/>
      </g>
    </g>
  </g>

  <!-- peek: paws gripping the edge -->
  <g class="tm-grip"><ellipse cx="50" cy="104" rx="12" ry="9" fill="#0d1a3e"/><ellipse cx="138" cy="102" rx="12" ry="9" fill="#0d1a3e"/><ellipse cx="47" cy="100" rx="4" ry="2" fill="#4d5c82" opacity=".6"/><ellipse cx="135" cy="98" rx="4" ry="2" fill="#4d5c82" opacity=".6"/></g>
</svg>`;

  // state → face, arms, prop and motion
  const S = {
    peek:       {eyes:"open", mouth:"smile", arms:"none", prop:"",        motion:"look"},
    hello:      {eyes:"open", mouth:"open",  arms:"wave", prop:"",        motion:"wave"},
    talk:       {eyes:"open", mouth:"smile", arms:"rest", prop:"",        motion:"bob"},
    sleeping:   {eyes:"shut", mouth:"flat",  arms:"rest", prop:"",        motion:"breathe"},
    cool:       {eyes:"open", mouth:"smirk", arms:"rest", prop:"glasses", motion:"sway"},
    working:    {eyes:"down", mouth:"flat",  arms:"none", prop:"laptop",  motion:"type"},
    thinking:   {eyes:"up",   mouth:"o",     arms:"rest", prop:"q",       motion:"tilt"},
    searching:  {eyes:"side", mouth:"flat",  arms:"none", prop:"glass",   motion:"scan"},
    carrying:   {eyes:"happy",mouth:"smile", arms:"none", prop:"carry",   motion:"walk"},
    checklist:  {eyes:"open", mouth:"smile", arms:"none", prop:"clip",    motion:"bob"},
    reading:    {eyes:"down", mouth:"smile", arms:"none", prop:"paper",   motion:"bob"},
    reports:    {eyes:"open", mouth:"smile", arms:"none", prop:"chart",   motion:"bob"},
    scheduling: {eyes:"open", mouth:"smile", arms:"none", prop:"cal",     motion:"bob"},
    settings:   {eyes:"open", mouth:"smile", arms:"none", prop:"gear",    motion:"bob"},
    alert:      {eyes:"open", mouth:"o",     arms:"rest", prop:"alert",   motion:"shake"},
    celebrating:{eyes:"happy",mouth:"open",  arms:"both", prop:"confetti",motion:"hop"},
    approved:   {eyes:"happy",mouth:"smile", arms:"wave", prop:"check",   motion:"hop"},
    idea:       {eyes:"open", mouth:"open",  arms:"wave", prop:"bulb",    motion:"hop"},
    sad:        {eyes:"open", mouth:"sad",   arms:"rest", prop:"",        motion:"droop", sweat:true},
    love:       {eyes:"happy",mouth:"smile", arms:"none", prop:"heart",   motion:"beat"},
    box:        {eyes:"open", mouth:"smile", arms:"none", prop:"box",     motion:"bob"},
    excited:    {eyes:"happy",mouth:"open",  arms:"both", prop:"",        motion:"hop"}
  };

  // ---------- markup ----------
  const root = document.createElement("div");
  root.className = "tm"; root.id = "tm";
  root.innerHTML = `
    <section class="tm-panel" id="tmPanel" role="dialog" aria-modal="false" aria-labelledby="tmTitle" hidden>
      <div class="tm-head">
        <span class="tm-av" aria-hidden="true"><svg viewBox="40 44 104 80"><rect x="51" y="50" width="86" height="78" rx="15" fill="#fff"/><path d="M51 66 v-1 a15 15 0 0 1 15 -15 h56 a15 15 0 0 1 15 15 v1z" fill="#1f2a5e"/><ellipse cx="82" cy="88" rx="5.6" ry="7.4" fill="${INK}"/><ellipse cx="108" cy="88" rx="5.6" ry="7.4" fill="${INK}"/><path d="M89 100 q6 6 12 0" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" fill="none"/></svg></span>
        <div class="tm-hd"><strong id="tmTitle"></strong><span class="tm-sub" id="tmSub"></span></div>
        <button type="button" class="tm-ic" id="tmMenu"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg></button>
        <button type="button" class="tm-ic" id="tmX"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>
      </div>
      <div class="tm-log" id="tmLog" role="log" aria-live="polite"></div>
      <div class="tm-notes" id="tmNotes" hidden>
        <div class="tm-nbar">
          <button type="button" class="tm-nback" id="tmNBack"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5"/></svg><span id="tmNBackTxt"></span></button>
          <strong class="tm-ntitle" id="tmNTitle"></strong>
        </div>
        <form class="tm-nform" id="tmNForm" autocomplete="off">
          <div class="tm-nrow">
            <label class="sr-only" for="tmNIn" id="tmNInLbl"></label>
            <textarea id="tmNIn" rows="2" maxlength="2000"></textarea>
            <button type="submit" class="tm-nadd" id="tmNAdd"></button>
          </div>
          <div class="tm-nopts">
            <button type="button" class="tm-nopt" id="tmNPinNew" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2l4.5 4.5-2 .5-2.5 2.5.5 3-1.5 1.5-2.5-2.5L3 14.5 1.5 13 4.5 10 2 7.5 3.5 6l3 .5L9 4z"/></svg><span id="tmNPinNewTxt"></span></button>
            <label class="tm-nopt tm-nrem"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.5H2.8zM6.5 13.5a1.5 1.5 0 0 0 3 0"/></svg><span id="tmNRemTxt"></span><input type="date" id="tmNRemNew"></label>
          </div>
        </form>
        <ul class="tm-nlist" id="tmNList"></ul>
        <p class="tm-nempty" id="tmNEmpty" hidden></p>
        <p class="tm-nfoot" id="tmNFoot"></p>
      </div>
      <form class="tm-ask" id="tmAsk" autocomplete="off">
        <label class="sr-only" for="tmIn" id="tmInLbl"></label>
        <input id="tmIn" type="text" maxlength="160" enterkeyhint="send">
        <button type="submit" class="tm-send" id="tmSend"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg></button>
      </form>
    </section>
    <div class="tm-bubble" id="tmBubble" aria-hidden="true" hidden></div>
    <button type="button" class="tm-btn" id="tmBtn" aria-expanded="false" aria-controls="tmPanel">
      <span class="tm-dot" id="tmDot" hidden></span>
      <span class="tm-z" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>
      <span class="tm-stage">${svg}</span>
    </button>`;
  document.body.appendChild(root);
  const btn = $("tmBtn"), panel = $("tmPanel"), log = $("tmLog"), bubble = $("tmBubble"), input = $("tmIn");

  // ---------- state ----------
  let state = "", hovering = false, idleTimer = 0, cycleTimer = 0, leaveTimer = 0, bubbleTimer = 0, lastIdle = "", findMode = false, flashTimer = 0;
  function setState(name){
    const s = S[name] || S.talk;
    state = name;
    const d = root.dataset;
    d.state = name; d.eyes = s.eyes; d.mouth = s.mouth; d.arms = s.arms; d.prop = s.prop; d.motion = s.motion;
    d.sweat = s.sweat ? "1" : "";
    d.mode = name === "peek" ? "peek" : "up";
    root.classList.remove("tm-in"); void root.offsetWidth; root.classList.add("tm-in");
  }
  function say(text, ms){
    clearTimeout(bubbleTimer);
    if (!text){ bubble.hidden = true; return; }
    bubble.textContent = text; bubble.hidden = false;
    if (ms) bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
  }
  const isOpen = () => !panel.hidden;

  // idle life: peek, then after a while nap / play it cool / work
  function resetIdle(){ clearTimeout(idleTimer); clearInterval(cycleTimer); idleTimer = setTimeout(startCycle, IDLE_AFTER); }
  function startCycle(){
    if (isOpen() || hovering) return;
    nextIdle(); cycleTimer = setInterval(() => { if (!isOpen() && !hovering) nextIdle(); }, IDLE_EVERY);
  }
  function nextIdle(){
    const c = IDLE_STATES.filter(x => x !== lastIdle);
    lastIdle = c[Math.floor(Math.random() * c.length)];
    setState(lastIdle); say("");
  }
  function rest(){ if (isOpen() || hovering) return; setState("peek"); say(""); resetIdle(); }

  function wake(){
    hovering = true; clearTimeout(leaveTimer); clearTimeout(idleTimer); clearInterval(cycleTimer); clearTimeout(flashTimer);
    if (isOpen()) return;
    const wasAsleep = state === "sleeping";
    setState("hello"); say(t(wasAsleep ? "hpWoke" : "hpHello"));
  }
  function unwake(){ hovering = false; if (isOpen()) return; say(""); clearTimeout(leaveTimer); leaveTimer = setTimeout(rest, 200); }
  btn.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") wake(); });
  btn.addEventListener("pointerleave", e => { if (e.pointerType !== "touch") unwake(); });
  btn.addEventListener("focus", () => { if (btn.matches(":focus-visible")) wake(); });
  btn.addEventListener("blur", () => { if (!isOpen()) unwake(); });

  // blinking and eyes that follow the pointer
  (function blink(){
    setTimeout(() => {
      if (!reduce() && root.dataset.eyes === "open"){ root.classList.add("tm-blink"); setTimeout(() => root.classList.remove("tm-blink"), 150); }
      blink();
    }, 2600 + Math.random() * 3600);
  })();
  let gazeRAF = 0, gx = 0, gy = 0;
  window.addEventListener("pointermove", e => {
    gx = e.clientX; gy = e.clientY;
    if (gazeRAF) return;
    gazeRAF = requestAnimationFrame(() => {
      gazeRAF = 0;
      if (root.dataset.eyes !== "open" || reduce()) return;
      const r = btn.getBoundingClientRect(), cx = r.left + r.width * .6, cy = r.top + r.height * .5;
      const dx = gx - cx, dy = gy - cy, len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / 260);
      root.style.setProperty("--gx", (dx / len * 3 * k).toFixed(2));
      root.style.setProperty("--gy", (dy / len * 2.4 * k).toFixed(2));
    });
  }, {passive: true});

  // ---------- panel ----------
  function open(){
    if (isOpen()) return;
    clearTimeout(idleTimer); clearInterval(cycleTimer); clearTimeout(leaveTimer); clearTimeout(flashTimer);
    panel.hidden = false; btn.setAttribute("aria-expanded", "true"); root.classList.add("open"); say("");
    if (notesView){ setState("checklist"); setTimeout(() => nIn.focus({preventScroll: true}), 40); }
    else { if (!log.childElementCount) greet(); else setState("talk"); setTimeout(() => input.focus({preventScroll: true}), 40); }
    loadNotes();
  }
  function close(focusBtn){
    if (!isOpen()) return;
    panel.hidden = true; btn.setAttribute("aria-expanded", "false"); root.classList.remove("open"); findMode = false;
    if (focusBtn) btn.focus({preventScroll: true});
    hovering = false; setState("peek"); resetIdle();
  }
  const toggle = () => isOpen() ? close(true) : (A.view === "settings" ? null : open());
  btn.addEventListener("click", toggle);
  $("tmX").addEventListener("click", () => close(true));
  $("tmMenu").addEventListener("click", () => { if (notesView) showNotes(false); menu(); input.focus({preventScroll: true}); });
  panel.addEventListener("keydown", e => { if (e.key === "Escape"){ e.stopPropagation(); if (notesView) showNotes(false); else close(true); } });
  document.addEventListener("pointerdown", e => { if (isOpen() && !root.contains(e.target)) close(false); });

  // ---------- conversation ----------
  function add(cls, html, actions){
    const m = document.createElement("div");
    m.className = "tm-msg " + cls;
    m.innerHTML = html;
    if (actions && actions.length){
      const box = document.createElement("div"); box.className = "tm-acts";
      actions.forEach(a => {
        const b = document.createElement("button"); b.type = "button"; b.className = "tm-act" + (a.primary ? " pri" : ""); b.textContent = a.label;
        b.addEventListener("click", () => { if (a.say) me(a.label); a.run(); });
        box.appendChild(b);
      });
      m.appendChild(box);
    }
    log.appendChild(m);
    while (log.childElementCount > 30) log.firstElementChild.remove();
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return m;
  }
  const me = text => add("me", esc(text));
  // the helper "types" for a moment, then answers in the matching state
  let pending = 0;
  function bot(st, html, actions){
    const id = ++pending;
    const dots = add("bot typing", `<span class="tm-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sr-only">${esc(t("hpTyping"))}</span>`);
    setState("thinking");
    setTimeout(() => {
      dots.remove();
      if (id !== pending) return;
      setState(st); add("bot", html, actions);
      root.classList.remove("tm-talk"); void root.offsetWidth; root.classList.add("tm-talk");
    }, reduce() ? 0 : 380 + Math.random() * 260);
  }
  const p = s => `<p>${esc(s)}</p>`;
  const list = rows => `<ul class="tm-list">${rows.map(r => `<li>${r}</li>`).join("")}</ul>`;
  const more = (n, shown) => n > shown ? `<div class="tm-more">${esc(t("hpMore", {n: n - shown}))}</div>` : "";
  const loanItem = l => esc((l.items && l.items[0] && l.items[0].item) || "") + (l.items && l.items.length > 1 ? ` +${l.items.length - 1}` : "");
  const sug = (key, run) => ({label: t(key), run, say: true});

  function counts(){
    const today = A.isoToday(), days = (A.settings && A.settings.dueSoonDays) || 3;
    const open = A.loans.filter(l => !l.returnDate);
    return {open: open.length, late: open.filter(l => l.dueDate < today).length,
      soon: open.filter(l => l.dueDate >= today && A.daysBetween(today, l.dueDate) <= days).length, days};
  }
  function greet(){
    const h = new Date().getHours();
    const hi = t(h < 12 ? "hpMorning" : h < 18 ? "hpAfternoon" : "hpEvening");
    let status = "";
    if (A.loaded){
      const c = counts();
      status = c.late ? t(c.late === 1 ? "hpStatusLate1" : "hpStatusLateN", {n: c.late}) : c.soon ? t("hpStatusSoon", {n: c.soon}) : t("hpStatusOk");
    }
    const c = A.loaded ? counts() : {late: 0};
    setState(c.late ? "alert" : "hello");
    const rem = (A.notes || []).filter(n => !n.done && n.remindOn && n.remindOn <= A.isoToday()).length;
    const acts = [];
    if (c.late) acts.push({label: t("hpTLate"), run: doLate, say: true, primary: true});
    if (rem) acts.push({label: t("hpNotesOpen"), run: () => showNotes(true), primary: !c.late});
    add("bot", p(hi + " " + t("hpIntro")) + (status ? `<p class="tm-status${c.late ? " bad" : ""}">${esc(status)}</p>` : "") +
      (rem ? `<p class="tm-status rem">${esc(t(rem === 1 ? "hpRemind1" : "hpRemindN", {n: rem}))}</p>` : ""), acts.length ? acts : null);
    menu(true);
    requestAnimationFrame(() => requestAnimationFrame(() => { log.scrollTop = 0; }));
  }

  // quick actions and questions, shown as a menu message
  const TASKS = [
    ["hpTNew", () => doNew(), "new"], ["hpTLate", () => doLate(), "late"], ["hpTSoon", () => doSoon(), "soon"], ["hpTFind", () => doFindPrompt(), "find"],
    ["hpTSum", () => doSummary(), "sum"], ["hpTRes", () => doRes(), "res"], ["hpTArchive", () => doArchive(), "arc"], ["hpTExport", () => doExport(), "csv"],
    ["hpTBackup", () => doBackup(), "db"], ["hpTKeys", () => doKeys(), "keys"]
  ];
  const ICONS = {
    new: '<path d="M8 3v10M3 8h10"/>', late: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.5l2 1.5"/>', soon: '<rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3"/>',
    find: '<circle cx="7" cy="7" r="4"/><path d="M10 10l3.5 3.5"/>', sum: '<path d="M3 13V8M8 13V3M13 13V6"/>', res: '<rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M5 9.5l2 2 4-4"/>',
    arc: '<rect x="2" y="3" width="12" height="3.5" rx="1"/><path d="M3 6.5v6.5h10V6.5M6.5 9h3"/>', csv: '<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>',
    notes: '<path d="M3.5 2.5h9a1 1 0 0 1 1 1v6l-4 4h-6a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1z"/><path d="M5.5 6h5M5.5 8.5h3"/>',
    db: '<ellipse cx="8" cy="4" rx="5" ry="2"/><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2"/>', keys: '<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M4 7h1M7 7h1M10 7h2M5 9.5h6"/>'
  };
  const FAQ = [
    {id:"return", kw:["return","retour","rendre","rendu","give back","bring back","restitu"]},
    {id:"slip",   kw:["slip","print","imprim","bordereau","fiche"]},
    {id:"extend", kw:["extend","prolong","extension","longer"]},
    {id:"sign",   kw:["sign"]},
    {id:"archive",kw:["archiv"]},
    {id:"backup", kw:["backup","back up","sauvegard","restor"]},
    {id:"res",    kw:["reserv","book"]},
    {id:"colors", kw:["colou","couleur","red","rouge","amber","orange","green","vert"]},
    {id:"import", kw:["import"]}
  ];
  function menu(silent){
    const m = add("bot tm-menu", `<div class="tm-cl">${esc(t("hpTasks"))}</div><div class="tm-grid"><button type="button" class="tm-tile tm-tile-wide tm-tile-notes" data-notes="1"><svg viewBox="0 0 16 16" aria-hidden="true">${ICONS.notes}</svg><span class="tm-tw"><span>${esc(t("hpNotes"))}</span><small class="tm-tsub">${esc(notesSub())}</small></span><span class="tm-tcount"${openNotes() ? "" : " hidden"}>${openNotes() > 9 ? "9+" : openNotes()}</span></button>${TASKS.map(([k, , ic], i) =>
      `<button type="button" class="tm-tile" data-task="${i}"><svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[ic]}</svg><span>${esc(t(k))}</span></button>`).join("")}</div>
      <details class="tm-faq"><summary>${esc(t("hpFaq"))}</summary>${FAQ.map(f => `<button type="button" class="tm-q" data-faq="${f.id}">${esc(t("hpQ_" + f.id))}</button>`).join("")}</details>`);
    m.addEventListener("click", e => {
      const b = e.target.closest(".tm-tile, .tm-q"); if (!b) return;
      if (b.dataset.notes) return showNotes(true);
      me(b.textContent.trim());
      if (b.dataset.task) TASKS[Number(b.dataset.task)][1](); else faq(b.dataset.faq);
    });
    if (!silent) setState("talk");
  }

  // ----- tasks -----
  function doNew(){ bot("carrying", p(t("hpRNew"))); setTimeout(() => { close(false); A.newLoan(); }, 900); }
  function doLate(){
    const late = A.alerts().late;
    if (!late.length) return bot("celebrating", p(t("hpRLate0")), [sug("hpTSoon", doSoon)]);
    bot("alert", p(t(late.length === 1 ? "hpRLate1" : "hpRLateN", {n: late.length})) +
      list(late.slice(0, 5).map(({l, d}) => `<button type="button" class="tm-link" data-slip="${esc(l.slipNo)}">${esc(l.slipNo)}</button> · ${esc(l.borrower)} · ${loanItem(l)} <span class="tm-late">${esc(t("hpDaysLate", {n: -d}))}</span>`)) + more(late.length, 5),
      [{label: t("hpShowLate"), primary: true, run: () => { close(false); A.showRegister("late"); }}, sug("hpTSoon", doSoon)]);
  }
  function doSoon(){
    const days = (A.settings && A.settings.dueSoonDays) || 3, today = A.isoToday();
    const soon = A.loans.filter(l => !l.returnDate && l.dueDate >= today && A.daysBetween(today, l.dueDate) <= days).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);
    if (!soon.length) return bot("approved", p(t("hpRSoon0", {n: days})), [sug("hpTSum", doSummary)]);
    bot("checklist", p(t("hpRSoon", {n: days})) +
      list(soon.slice(0, 6).map(l => `<button type="button" class="tm-link" data-slip="${esc(l.slipNo)}">${esc(l.slipNo)}</button> · ${esc(l.borrower)} · ${loanItem(l)} — ${esc(l.dueDate === today ? t("hpToday") : A.fmt(l.dueDate))}`)) + more(soon.length, 6),
      [{label: t("hpShowActive"), primary: true, run: () => { close(false); A.showRegister("active"); }}, sug("hpTLate", doLate)]);
  }
  function doFindPrompt(){ findMode = true; bot("searching", p(t("hpRFind"))); input.focus(); }
  function doSummary(){
    const c = counts(), month = A.isoToday().slice(0, 7);
    const ret = A.loans.filter(l => l.returnDate && l.returnDate.slice(0, 7) === month).length;
    const free = A.equipment.filter(e => A.eqState(e) === "available").length;
    bot("reports", `<div class="tm-kpis"><div><b>${c.open}</b><span>${esc(t("hpKOut"))}</span></div><div class="${c.late ? "bad" : ""}"><b>${c.late}</b><span>${esc(t("hpKLate"))}</span></div><div><b>${c.soon}</b><span>${esc(t("hpKSoon"))}</span></div><div><b>${ret}</b><span>${esc(t("hpKRet"))}</span></div></div>` +
      p(t("hpRSum2", {free, total: A.equipment.length})),
      [{label: t("hpOpenStats"), primary: true, run: () => { close(false); A.go("stats"); }}, sug(c.late ? "hpTLate" : "hpTSoon", c.late ? doLate : doSoon)]);
  }
  function doRes(){
    const today = A.isoToday();
    const up = A.reservations.filter(r => r.status === "active" && r.endDate >= today).sort((a, b) => a.startDate < b.startDate ? -1 : 1);
    const go = {label: t("hpOpenCal"), primary: true, run: () => { close(false); A.go("calendrier"); }};
    if (!up.length) return bot("scheduling", p(t("hpRRes0")), [go]);
    bot("scheduling", p(t("hpRRes")) + list(up.slice(0, 5).map(r => `<b>${esc(r.resNo)}</b> · ${esc(r.borrower)} · ${esc(A.fmt(r.startDate))} → ${esc(A.fmt(r.endDate))}`)) + more(up.length, 5), [go]);
  }
  async function doArchive(){
    let n = null; try{ const r = await fetch("/api/archive?count=1"); if (r.ok){ const j = await r.json(); n = typeof j === "number" ? j : (j.count ?? null); } }catch(_){}
    const on = A.settings && A.settings.archiveEnabled;
    const msg = n === null ? t("hpOffline") : n === 0 ? t("hpRArchive0") : t(n === 1 ? "hpRArchive1" : "hpRArchiveN", {n});
    bot("box", p(msg + (on ? "" : " " + t("hpArchiveOff"))), [{label: t("hpOpenArchive"), primary: true, run: () => { close(false); A.goSettings("set-archive"); }}, sug("hpQ_archive", () => faq("archive"))]);
  }
  function doExport(){ A.exportCsv(); bot("approved", p(t("hpRExport"))); }
  function doBackup(){ A.backup(); bot("approved", p(t("hpRBackup")), [sug("hpQ_backup", () => faq("backup"))]); }
  function doKeys(){ bot("idea", p(t("hpRKeys"))); setTimeout(() => { close(false); A.openHelp(); }, 900); }
  function doSettings(){ bot("settings", p(t("hpRSettings"))); setTimeout(() => { close(false); A.go("settings"); }, 900); }

  function faq(id){
    const acts = {
      backup: [{label: t("hpTBackup"), primary: true, run: doBackup}, {label: t("hpOpenData"), run: () => { close(false); A.goSettings("set-data"); }}],
      archive: [{label: t("hpOpenArchive"), primary: true, run: () => { close(false); A.goSettings("set-archive"); }}],
      sign: [{label: t("hpOpenSettings"), primary: true, run: () => { close(false); A.goSettings("set-loans"); }}],
      res: [{label: t("hpOpenCal"), primary: true, run: () => { close(false); A.go("calendrier"); }}],
      import: [{label: t("hpOpenData"), primary: true, run: () => { close(false); A.goSettings("set-data"); }}],
      return: [sug("hpTLate", doLate)], slip: [sug("hpQ_extend", () => faq("extend"))], extend: [sug("hpTSoon", doSoon)]
    }[id];
    bot(id === "colors" ? "idea" : id === "backup" || id === "import" ? "settings" : id === "res" ? "scheduling" : "reading", p(t("hpA_" + id)), acts);
  }

  // ----- free text -----
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const STOP = new Set(("who has where is the a an of for find search look up show me my please can you i want to with what which item items person does do " +
    "qui a ou est le la les un une de des du pour trouve trouver cherche chercher montre moi mon ma mes peux tu stp svp en avec quel quelle").split(" "));
  function search(text){
    const words = norm(text).replace(/[?!.,;:'"«»“”()]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));
    if (!words.length) return null;
    const hit = hay => { const h = norm(hay); return words.every(w => h.includes(w)); };
    const eq = A.equipment.filter(e => hit([e.name, e.serial, e.assetTag, e.category, e.site].join(" ")));
    const loans = A.loans.filter(l => !l.returnDate && hit([l.slipNo, l.borrower, l.department, ...(l.items || []).map(i => [i.item, i.serial, i.assetTag, i.category].join(" "))].join(" ")));
    return {words, eq, loans};
  }
  function showSearch(text, r){
    if (!r || (!r.eq.length && !r.loans.length)) return bot("sad", p(t("hpNotFound", {q: text})), [sug("hpTFind", doFindPrompt)]);
    const rows = [];
    r.eq.slice(0, 4).forEach(e => {
      const cl = e.currentLoan;
      rows.push(cl ? `${esc(t("hpOnLoan", {item: e.name, serial: e.serial, who: cl.borrower, d: A.fmt(cl.dueDate)}))} <button type="button" class="tm-link" data-slip="${esc(cl.slipNo)}">${esc(cl.slipNo)}</button>`
                   : `<span class="tm-ok">●</span> ${esc(t(A.eqState(e) === "loaned" ? "hpLoanedManual" : "hpAvail", {item: e.name, serial: e.serial}))}`);
    });
    const eqSerials = new Set(r.eq.map(e => e.serial));
    const loans = r.loans.filter(l => !(l.items || []).every(i => eqSerials.has(i.serial)));
    loans.slice(0, 4).forEach(l => rows.push(`<button type="button" class="tm-link" data-slip="${esc(l.slipNo)}">${esc(l.slipNo)}</button> · ${esc(l.borrower)} · ${loanItem(l)} — ${esc(A.status(l).label)}`));
    const acts = [];
    if (r.eq.length === 1) acts.push({label: t("hpHistory"), run: () => { close(false); A.go("inventaire"); setTimeout(() => A.openItemHistory({equipmentId: r.eq[0].id, serial: r.eq[0].serial}), 150); }});
    else if (!r.eq.length && r.loans.length && new Set(r.loans.map(l => l.borrower)).size === 1) acts.push({label: t("hpHistory"), run: () => { close(false); A.openBorrowerHistory(r.loans[0].borrower); }});
    bot("searching", p(t("hpFound", {q: text})) + list(rows) + more(r.eq.length + loans.length, Math.min(4, r.eq.length) + Math.min(4, loans.length)), acts);
  }
  log.addEventListener("click", e => { const b = e.target.closest(".tm-link[data-slip]"); if (b){ close(false); A.focusLoan(b.dataset.slip); } });

  const history = []; let hIdx = -1;
  function ask(raw){
    const text = raw.trim(); if (!text) return;
    history.push(text); hIdx = history.length;
    me(text);
    if (findMode){ findMode = false; return showSearch(text, search(text)); }
    const s = norm(text);
    const question = /\?|^(how|what|why|where|when|can|could|comment|quoi|que |qu'|pourquoi|est-ce|peut|puis|ou )/.test(s);
    if (/\b(thanks?|thank you|thx|merci|cheers)\b/.test(s)) return bot("love", p(t("hpThanks")));
    if (/^(hi|hello|hey|yo|bonjour|salut|coucou|bonsoir)\b/.test(s) && s.length < 24) return bot("excited", p(t("hpHi")), [sug("hpTSum", doSummary)]);
    if (/^(help|aide|menu|\?)$/.test(s)) return menu();
    const nm = text.match(/^\s*(?:note|notes?|noter|remember|rappel(?:le)?(?:-moi)?|retiens)\s*[:\-–]\s*(.+)$/i) || text.match(/^\s*(?:add a note|ajoute(?:r)? une note|new note|nouvelle note)\s*[:\-–]?\s*(.+)$/i);
    if (nm) return noteFromChat(nm[1].trim());
    if (/^(my notes|notes|show notes|open notes|mes notes|voir les notes|ouvrir les notes)$/.test(s)) return showNotes(true);
    const faqBest = () => { let best = null, score = 0; for (const f of FAQ){ const n = f.kw.filter(k => s.includes(k)).length; if (n > score){ score = n; best = f; } } return best; };
    if (question){ const f = faqBest(); if (f) return faq(f.id); }
    const rules = [
      [/(overdue|late|retard)/, doLate],
      [/(due soon|soon|bientot|echeance|this week|cette semaine|tomorrow|demain|due today)/, doSoon],
      [/(new loan|lend|nouveau pret|preter|create a loan|creer un pret|add a loan|ajouter un pret)/, doNew],
      [/(summary|resume|stat|how many|combien|overview|bilan|today|aujourd)/, doSummary],
      [/(reserv|calend|booking)/, doRes],
      [/(archiv)/, doArchive],
      [/(export|csv)/, doExport],
      [/(backup|back up|sauvegard)/, doBackup],
      [/(shortcut|raccourci|keyboard|clavier)/, doKeys],
      [/(setting|parametre|reglage|option)/, doSettings]
    ];
    for (const [re, fn] of rules) if (re.test(s)) return fn();
    const f = faqBest(); if (f) return faq(f.id);
    const r = search(text);
    if (r && (r.eq.length || r.loans.length)) return showSearch(text, r);
    bot("thinking", p(t("hpDunno")), [sug("hpTFind", doFindPrompt), {label: t("hpMenu"), run: () => menu()}]);
  }
  $("tmAsk").addEventListener("submit", e => { e.preventDefault(); const v = input.value; input.value = ""; ask(v); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowUp" && history.length && (!input.value || hIdx < history.length)){ e.preventDefault(); hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx]; }
    else if (e.key === "ArrowDown" && hIdx < history.length){ e.preventDefault(); hIdx++; input.value = history[hIdx] || ""; }
  });

  // ---------- notes: shared with everyone, stored on the server ----------
  const nView = $("tmNotes"), nIn = $("tmNIn"), nList = $("tmNList");
  let notes = [], notesView = false;
  async function api(method, url, body){
    const r = await fetch(url, {method, headers: body ? {"Content-Type": "application/json"} : {}, body: body ? JSON.stringify(body) : undefined});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || t("hpOffline"));
    return j;
  }
  const sortNotes = () => notes.sort((a, b) => (a.done - b.done) || (b.pinned - a.pinned) || (a.createdAt < b.createdAt ? 1 : -1));
  const sync = () => { if (A.setNotes) A.setNotes(notes.slice()); };
  function remChip(n){
    if (!n.remindOn) return "";
    const today = A.isoToday(), cls = n.done ? "" : n.remindOn < today ? " late" : n.remindOn === today ? " today" : "";
    const label = n.remindOn === today ? t("hpToday") : A.fmt(n.remindOn);
    return `<button type="button" class="tm-nremchip${cls}" data-act="remind" title="${esc(t("hpNoteRemind"))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.5H2.8zM6.5 13.5a1.5 1.5 0 0 0 3 0"/></svg>${esc(label)}</button>`;
  }
  const dueReminders = () => notes.filter(n => !n.done && n.remindOn && n.remindOn <= A.isoToday());
  const openNotes = () => notes.filter(x => !x.done).length;
  const notesSub = () => { const n = openNotes(); return n ? t(n === 1 ? "hpNotesSub1" : "hpNotesSubN", {n}) : t("hpNotesSub0"); };
  function nCount(){
    const n = openNotes();
    log.querySelectorAll(".tm-tile-notes").forEach(b => {
      const c = b.querySelector(".tm-tcount"); c.hidden = !n; c.textContent = n > 9 ? "9+" : String(n);
      b.querySelector(".tm-tsub").textContent = notesSub();
    });
  }
  async function loadNotes(){ try{ notes = await api("GET", "/api/notes"); sortNotes(); sync(); }catch(_){} nCount(); if (notesView) renderNotes(); }
  const nDate = iso => { const x = new Date(iso); if (isNaN(x)) return ""; const d = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; return d === A.isoToday() ? t("hpToday") : A.fmt(d); };
  function renderNotes(){
    nList.innerHTML = notes.map(n => `<li class="tm-note${n.done ? " is-done" : ""}" data-id="${n.id}">
      <button type="button" class="tm-ncheck" data-act="done" aria-pressed="${n.done}" aria-label="${esc(t(n.done ? "hpNoteUndo" : "hpNoteDone"))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.5l2.5 2.5 5.5-6"/></svg></button>
      <div class="tm-nbody"><button type="button" class="tm-ntext" data-act="edit" title="${esc(t("hpNoteEdit"))}">${esc(n.text)}</button>
        <span class="tm-nmeta">${n.pinned ? `<span class="tm-npinned">${esc(t("hpNotePinned"))}</span>` : ""}${remChip(n)}<span class="tm-ndate">${esc(nDate(n.createdAt))}</span></span></div>
      <button type="button" class="tm-nic${n.pinned ? " on" : ""}" data-act="pin" aria-pressed="${n.pinned}" aria-label="${esc(t(n.pinned ? "hpNoteUnpin" : "hpNotePin"))}" title="${esc(t(n.pinned ? "hpNoteUnpin" : "hpNotePin"))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2l4.5 4.5-2 .5-2.5 2.5.5 3-1.5 1.5-2.5-2.5L3 14.5 1.5 13 4.5 10 2 7.5 3.5 6l3 .5L9 4z"/></svg></button>
      <button type="button" class="tm-nic${n.remindOn ? " on" : ""}" data-act="remind" aria-label="${esc(t("hpNoteRemind"))}" title="${esc(t("hpNoteRemind"))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.5H2.8zM6.5 13.5a1.5 1.5 0 0 0 3 0"/></svg></button>
      <button type="button" class="tm-ndel" data-act="del" aria-label="${esc(t("hpNoteDel"))}" title="${esc(t("hpNoteDel"))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5v-1.5h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5"/></svg></button></li>`).join("");
    $("tmNEmpty").hidden = notes.length > 0;
    nCount();
  }
  function showNotes(on){
    notesView = on;
    nView.hidden = !on; log.hidden = on; $("tmAsk").hidden = on;
    panel.classList.toggle("tm-notes-on", on);
    if (on){ setState("checklist"); renderNotes(); loadNotes(); setTimeout(() => nIn.focus({preventScroll: true}), 30); }
    else { setState("talk"); nCount(); requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; }); setTimeout(() => input.focus({preventScroll: true}), 30); }
  }
  async function addNote(text, extra){
    const n = await api("POST", "/api/notes", Object.assign({text}, extra || {}));
    notes.unshift(n); sortNotes(); renderNotes(); sync();
    return n;
  }
  const pinNew = $("tmNPinNew"), remNew = $("tmNRemNew");
  pinNew.addEventListener("click", () => pinNew.setAttribute("aria-pressed", pinNew.getAttribute("aria-pressed") === "true" ? "false" : "true"));
  remNew.addEventListener("change", () => remNew.closest(".tm-nrem").classList.toggle("on", !!remNew.value));
  $("tmNBack").addEventListener("click", () => showNotes(false));
  $("tmNForm").addEventListener("submit", async e => {
    e.preventDefault();
    const v = nIn.value.trim(); if (!v) { nIn.focus(); return; }
    try{ await addNote(v, {pinned: pinNew.getAttribute("aria-pressed") === "true", remindOn: remNew.value || ""}); nIn.value = ""; nIn.style.height = ""; pinNew.setAttribute("aria-pressed", "false"); remNew.value = ""; remNew.closest(".tm-nrem").classList.remove("on"); setState("approved"); setTimeout(() => { if (notesView) setState("checklist"); }, 1600); }
    catch(ex){ A.toast(ex.message); }
  });
  nIn.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); $("tmNForm").requestSubmit(); } });
  nIn.addEventListener("input", () => { nIn.style.height = "auto"; nIn.style.height = Math.min(nIn.scrollHeight, 140) + "px"; });
  nList.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const li = b.closest(".tm-note"), id = Number(li.dataset.id), n = notes.find(x => x.id === id); if (!n) return;
    try{
      if (b.dataset.act === "done"){
        Object.assign(n, await api("PUT", `/api/notes/${id}`, {done: !n.done}));
        sortNotes(); renderNotes(); sync();
        if (n.done){ setState("approved"); setTimeout(() => { if (notesView) setState("checklist"); }, 1400); }
        const again = nList.querySelector(`[data-id="${id}"] .tm-ncheck`); if (again) again.focus();
      } else if (b.dataset.act === "del"){
        await api("DELETE", `/api/notes/${id}`);
        notes = notes.filter(x => x.id !== id); renderNotes(); sync(); nIn.focus();
      } else if (b.dataset.act === "pin"){
        Object.assign(n, await api("PUT", `/api/notes/${id}`, {pinned: !n.pinned}));
        sortNotes(); renderNotes(); sync();
        const again = nList.querySelector(`[data-id="${id}"] [data-act="pin"]`); if (again) again.focus();
      } else if (b.dataset.act === "remind") editReminder(li, n);
      else if (b.dataset.act === "edit") editNote(li, n);
    }catch(ex){ A.toast(ex.message); }
  });
  function editNote(li, n){
    const body = li.querySelector(".tm-nbody");
    body.innerHTML = `<textarea class="tm-nedit" rows="2" maxlength="2000" aria-label="${esc(t("hpNoteEdit"))}"></textarea>`;
    const ta = body.querySelector("textarea"); ta.value = n.text; ta.style.height = Math.min(ta.scrollHeight + 2, 160) + "px";
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    let finished = false;
    const finish = async save => {
      if (finished) return; finished = true;
      const v = ta.value.trim();
      if (save && v && v !== n.text){ try{ Object.assign(n, await api("PUT", `/api/notes/${n.id}`, {text: v})); sync(); }catch(ex){ A.toast(ex.message); } }
      renderNotes();
      const again = nList.querySelector(`[data-id="${n.id}"] .tm-ntext`); if (again) again.focus();
    };
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); finish(true); }
      else if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    ta.addEventListener("blur", () => finish(true));
  }
  function editReminder(li, n){
    const meta = li.querySelector(".tm-nmeta");
    meta.innerHTML = `<span class="tm-nremedit"><input type="date" aria-label="${esc(t("hpNoteRemind"))}" value="${esc(n.remindOn)}"><button type="button" data-r="save">${esc(t("hpNoteRemindSave"))}</button>${n.remindOn ? `<button type="button" data-r="clear">${esc(t("hpNoteRemindClear"))}</button>` : ""}</span>`;
    const inp = meta.querySelector("input"); inp.focus(); try{ inp.showPicker && inp.showPicker(); }catch(_){}
    const done = async v => {
      if (v !== undefined && v !== n.remindOn){ try{ Object.assign(n, await api("PUT", `/api/notes/${n.id}`, {remindOn: v})); sync(); }catch(ex){ A.toast(ex.message); } }
      renderNotes();
      const again = nList.querySelector(`[data-id="${n.id}"] [data-act="remind"]`); if (again) again.focus();
    };
    meta.addEventListener("click", e => { const b = e.target.closest("[data-r]"); if (!b) return; e.stopPropagation(); done(b.dataset.r === "clear" ? "" : inp.value); });
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); done(inp.value); }
      else if (e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); done(); }
    });
  }
  async function noteFromChat(text){
    try{
      await addNote(text);
      bot("approved", p(t("hpNoteSaved")) + `<p class="tm-nquote">${esc(text)}</p>`, [{label: t("hpNotesOpen"), primary: true, run: () => showNotes(true)}]);
    }catch(ex){ bot("sad", p(ex.message)); }
  }

  // ---------- reacting to the app: new loans, returns, overdue counter ----------
  let prev = null;
  function flash(st, text){
    if (isOpen() || hovering) return;
    clearTimeout(flashTimer); clearTimeout(idleTimer); clearInterval(cycleTimer);
    setState(st); if (text) say(text, 2200);
    flashTimer = setTimeout(rest, 2400);
  }
  function watch(){
    if (!A.loaded) return;
    const c = counts(), n = A.loans.length, back = A.loans.filter(l => l.returnDate).length;
    const d = $("tmDot"); d.hidden = !c.late; d.textContent = c.late > 9 ? "9+" : String(c.late);
    btn.setAttribute("aria-label", c.late ? t("hpOpenLate", {n: c.late}) : t("hpOpen"));
    if (prev){
      if (n > prev.n) flash("celebrating", t("hpCheerNew"));
      else if (back > prev.back) flash("approved", t("hpCheerBack"));
    }
    prev = {n, back};
  }

  function applyTexts(){
    $("tmTitle").textContent = t("hpName"); $("tmSub").textContent = t("hpSubtitle");
    $("tmX").setAttribute("aria-label", t("hpClose")); $("tmMenu").setAttribute("aria-label", t("hpMenu")); $("tmMenu").title = t("hpMenu");
    $("tmNInLbl").textContent = t("hpNotePh"); nIn.placeholder = t("hpNotePh"); $("tmNAdd").textContent = t("hpNoteAdd");
    $("tmNPinNewTxt").textContent = t("hpNotePin"); $("tmNRemTxt").textContent = t("hpNoteRemindLbl");     $("tmNEmpty").textContent = t("hpNotesEmpty"); $("tmNFoot").textContent = t("hpNotesShared"); $("tmNBackTxt").textContent = t("hpBackChat"); $("tmNTitle").textContent = t("hpNotes"); nCount();
    $("tmInLbl").textContent = t("hpAskLbl"); input.placeholder = t("hpAsk"); $("tmSend").setAttribute("aria-label", t("hpSend"));
    btn.setAttribute("aria-label", t("hpOpen"));
  }
  applyTexts(); setState("peek"); resetIdle();
  let lastLang = A.lang;
  setInterval(() => { if (A.lang !== lastLang){ lastLang = A.lang; applyTexts(); } watch(); }, 1500);
  setTimeout(watch, 900);
  const syncView = () => { root.dataset.view = A.view; if (A.view === "settings" && isOpen()) close(false); };
  window.addEventListener("hashchange", () => setTimeout(syncView, 30)); setTimeout(syncView, 300);

  // the character's drawing for other places (first-run setup), with its own gradient ids
  function figure(pfx){
    const inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
    return inner.replace(/id="(\w+)"/g, `id="${pfx}-$1"`).replace(/url\(#(\w+)\)/g, `url(#${pfx}-$1)`);
  }
  window.TallyHelper = { open, close, toggle, setState, menu, showNotes, figure };
})();
