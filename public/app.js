(() => {
  const APP_VERSION = "1.11.0";
  const $ = id => document.getElementById(id);
  const store = { get(k){ try{ return localStorage.getItem(k) || ""; }catch(_){ return ""; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(_){} } };

  let settings = null, lang = "en";
  let loans = [], equipment = [], notesData = [], loaded = false, online = true;
  let filter = "active", query = "", view = "registre";
  let invFilter = "all", invQuery = "", invCat = "";
  // Column sorting (click a header: ascending, descending, back to the default order)
  const sorts = { reg: {key:"",dir:1}, inv: {key:"",dir:1} };
  const sortCollator = new Intl.Collator(undefined, {numeric:true, sensitivity:"base"});
  const cmpVal = (a,b) => (typeof a === "number" && typeof b === "number") ? a-b : sortCollator.compare(String(a ?? ""), String(b ?? ""));
  function applySort(list, st, getters){
    if (!st.key || !getters[st.key]) return list;
    const g = getters[st.key];
    return list.map((x,i) => [x,i]).sort((a,b) => (cmpVal(g(a[0]), g(b[0])) * st.dir) || (a[1]-b[1])).map(x => x[0]);
  }
  function syncSortHeads(table, st){
    table.querySelectorAll("th[data-sort]").forEach(th => th.setAttribute("aria-sort", th.dataset.sort === st.key ? (st.dir === 1 ? "ascending" : "descending") : "none"));
  }
  let editingId = null, returningId = null, extendingId = null, eqEditingId = null, slipLoan = null;
  let formItems = [];
  let reservations = [], calMonth = "", calLayers = {loans:true, res:true}, resFilter = "upcoming";
  let resEditingId = null, resItems = [], convertingRes = null;
  let requests = [], reqFilter = "pending", resFromRequest = null;
  let logoDataUrl = "";
  async function loadLogo(){
    logoDataUrl = "";
    if (settings && settings.logoUpdated){
      try{
        const r = await fetch(`/api/logo?v=${encodeURIComponent(settings.logoUpdated)}`);
        if (r.ok){ const blob = await r.blob(); logoDataUrl = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(""); fr.readAsDataURL(blob); }); }
      }catch(_){}
    }
    renderLogoSetting();
  }
  function renderLogoSetting(){
    const box = $("logoPrev");
    box.innerHTML = logoDataUrl ? `<img src="${logoDataUrl}" alt="">` : `<span>${esc(t("logoNone"))}</span>`;
    $("logoRemove").hidden = !logoDataUrl;
  }
  let itemMode = "item", userMode = "borrower", refreshTimer = null, settingsDirty = false;

  // ---------- i18n ----------
  const fill = (s, vars) => (typeof s === "string" && vars) ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
  function t(key, vars){
    const s = (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : I18N.fr[key];
    return fill(s ?? key, vars);
  }
  const slipLang = () => lang;
  const ts = (key, vars) => fill((I18N[slipLang()].slip || I18N.fr.slip)[key], vars);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function toast(msg, undoToken){
    const el = $("toast"); el.textContent = msg;
    if (undoToken){
      const b = document.createElement("button"); b.type = "button"; b.className = "toast-undo"; b.textContent = t("undo");
      b.addEventListener("click", () => doUndo(undoToken)); el.append(b);
    }
    el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, undoToken ? 9000 : 3600);
  }
  async function doUndo(token){
    try{ await api("POST", `/api/undo/${token}`); toast(t("tRestored")); await load(); }
    catch(ex){ toast(ex.status === 410 ? t("undoGone") : (ex.message || t("undoGone"))); }
  }

  // ---------- thème ----------
  const THEME_IDS = ["auto","light","dark","indigo","ocean","forest","sunset","mocha","nord","graphite","rose","mint"];
  const DARK_THEMES = ["dark","indigo","ocean","mocha","nord","graphite"];
  const THEME_BG = {light:"#f3f5f4", dark:"#121715", indigo:"#07080c", ocean:"#05102a", forest:"#f1eee1", sunset:"#fff3e8", mocha:"#14100d", nord:"#242933", graphite:"#0f0f10", rose:"#fdf2f5", mint:"#ecf8f3"};
  const sysDark = () => !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  function applyTheme(name){
    if (!THEME_IDS.includes(name)) name = "auto";
    const root = document.documentElement;
    if (name === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", name);
    const dark = name === "auto" ? sysDark() : DARK_THEMES.includes(name);
    root.setAttribute("data-tone", dark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = name === "auto" ? (dark ? THEME_BG.dark : THEME_BG.light) : THEME_BG[name];
    try{ localStorage.setItem("tally.theme", name); }catch(_){}
  }
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!document.documentElement.hasAttribute("data-theme")) applyTheme("auto");
  });

  function applyI18n(){
    document.documentElement.lang = lang;
    document.title = t("docTitle");
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute("aria-label", t(el.dataset.i18nTitle)); });
    if (settings){
      $("eyebrow").textContent = [settings.serviceName, settings.orgName].filter(Boolean).join(" · ");
      $("issuedOpt").hidden = !!settings.requireIssuedBy;
    }
    if ($("offline").dataset.outdated) $("offline").textContent = t("outdated", JSON.parse($("offline").dataset.outdated));
    else $("offline").textContent = t("offline");
    fillFilters();
    fillArchiveOptions(); if (view === "settings") { buildRail(); updateRail(); }
  }

  // ---------- conditions (codes fixes, libellés traduits) ----------
  const CONDS_OUT = ["good","new","wear","scratches","defect"];
  const CONDS_IN = ["good","wear","scratches","damaged","incomplete"];
  const LEGACY_COND = Object.fromEntries(Object.entries(I18N.fr.cond).map(([k,v]) => [v.toLowerCase(), k]));
  const condCode = v => { if (!v) return ""; if (I18N.fr.cond[v]) return v; return LEGACY_COND[String(v).toLowerCase()] || v; };
  const condLabel = (v, lng) => { const c = condCode(v); return (I18N[lng||lang].cond || I18N.fr.cond)[c] || v || ""; };
  const condOptions = (codes, current) => {
    const cur = condCode(current);
    const list = cur && !codes.includes(cur) ? [cur, ...codes] : codes;
    return list.map(c => `<option value="${esc(c)}"${c===cur?" selected":""}>${esc(condLabel(c))}</option>`).join("");
  };
  const listOptions = (values, current) => {
    const list = [...(values||[])];
    if (current && !list.includes(current)) list.unshift(current);
    if (!list.length) return `<option value="">—</option>`;
    return list.map(v => `<option${v===current?" selected":""}>${esc(v)}</option>`).join("");
  };

  // ---------- API ----------
  async function api(method, url, body){
    const r = await fetch(url, {method, headers: body ? {"Content-Type":"application/json"} : {}, body: body ? JSON.stringify(body) : undefined});
    if (r.status === 204) return null;
    const data = await r.json().catch(() => ({}));
    if (!r.ok){ const e = new Error(data.error || `HTTP ${r.status}`); e.data = data; e.status = r.status; throw e; }
    return data;
  }
  async function load(){
    try{
      [loans, equipment, reservations, notesData, requests] = await Promise.all([api("GET","/api/loans"), api("GET","/api/equipment"), api("GET","/api/reservations"), api("GET","/api/notes").catch(() => notesData), api("GET","/api/requests").catch(() => requests)]);
      online = true;
    }catch(_){ online = false; }
    loaded = true;
    if (!$("offline").dataset.outdated) $("offline").hidden = online;
    refreshLists(); renderAll();
  }

  // ---------- dates ----------
  const pad = n => String(n).padStart(2,"0");
  const isoToday = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
  const addDays = (iso, n) => { const [y,m,d]=iso.split("-").map(Number); const dt=new Date(y,m-1,d+n); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`; };
  const DATE_FORMATS = ["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD","DD.MM.YYYY","DD-MM-YYYY"];
  const dateFmt = () => (settings && DATE_FORMATS.includes(settings.dateFormat)) ? settings.dateFormat : "DD/MM/YYYY";
  const fmt = iso => { if(!iso) return "—"; const [y,m,d]=iso.slice(0,10).split("-"); return dateFmt().replace("DD",d).replace("MM",m).replace("YYYY",y); };
  const fd = iso => iso ? fmt(iso) : "";
  const daysBetween = (a,b) => { const p=s=>{const [y,m,d]=s.split("-").map(Number);return Date.UTC(y,m-1,d)}; return Math.round((p(b)-p(a))/86400000); };
  const monthKey = iso => iso.slice(0,7);
  const shiftMonth = (key, n) => { const [y,m]=key.split("-").map(Number); const d=new Date(y, m-1+n, 1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
  const locale = () => lang==="en" ? "en-GB" : "fr-FR";
  const monthLabel = (key, withYear) => { const [y,m]=key.split("-").map(Number); const s=new Date(y,m-1,1).toLocaleDateString(locale(),{month:"short"}).replace(".",""); return withYear ? `${s} ${String(y).slice(2)}` : s; };

  // ---------- prêts : helpers ----------
  const openItems = l => l.items.filter(i => !i.returnDate);
  function status(l){
    if (l.returnDate) return {key:"back", label:t("stBack",{d:fmt(l.returnDate)})};
    const today = isoToday();
    if (l.dueDate < today) return {key:"late", label:t("stLate",{n:daysBetween(l.dueDate,today)})};
    if (l.dueDate === today) return {key:"soon", label:t("stToday")};
    if (daysBetween(today,l.dueDate) <= (settings ? settings.dueSoonDays : 3)) return {key:"soon", label:t("stSoon")};
    return {key:"out", label:t("stOut")};
  }
  const partial = l => !l.returnDate && l.items.some(i => i.returnDate);
  const loanById = id => loans.find(l => String(l.id) === String(id));
  const eqById = id => equipment.find(e => String(e.id) === String(id));

  // ---------- vues et liens profonds ----------
  const VIEWS = ["registre","inventaire","calendrier","stats","settings"];
  // addresses: English in the URL (#register, #inventory…); the older French ones (#registre, #inventaire…) still work
  const VIEW_HASH = {registre:"register", inventaire:"inventory", calendrier:"calendar", stats:"statistics", settings:"settings"};
  const HASH_VIEW = {register:"registre", inventory:"inventaire", calendar:"calendrier", statistics:"stats", settings:"settings",
                     registre:"registre", inventaire:"inventaire", calendrier:"calendrier", stats:"stats"};
  function route(){
    let h = decodeURIComponent(location.hash.slice(1));
    $("histSheet").hidden = true;
    if (h.startsWith("loan:")){ focusLoan(h.slice(5)); return; }
    if (h.startsWith("item:")){ setView("inventaire"); openItemHistory({serial: h.slice(5)}); return; }
    if (HASH_VIEW[h] && VIEW_HASH[HASH_VIEW[h]] !== h){ h = VIEW_HASH[HASH_VIEW[h]]; history.replaceState(null, "", "#" + h); }   // old French addresses still work
    setView(HASH_VIEW[h] || h || "registre");
  }
  function setView(v){
    view = VIEWS.includes(v) ? v : "registre";
    for (const name of VIEWS) $("view-"+name).hidden = name !== view;
    document.querySelectorAll(".tabs a").forEach(a => { if (a.dataset.view === view) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
    if (view === "settings") $("gearBtn").setAttribute("aria-current","page"); else $("gearBtn").removeAttribute("aria-current");
    $("tabsNav").hidden = view === "settings"; $("backBar").hidden = view !== "settings";
    $("skipLink").setAttribute("href", "#view-" + view);
    if (view === "settings"){ fillSettingsForm(); applyTheme(themeRadio()); refreshArchiveCount(); settingsNavOn(); }
    else { settingsNavOff(); if (settings) applyTheme(settings.theme); }
    renderAll();
  }
  function showRequests(){
    reqFilter = "pending"; $("reqChips").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.q === "pending" ? "true" : "false"));
    if (view !== "calendrier") location.hash = "calendar";
    setTimeout(() => { $("reqCard").scrollIntoView({behavior: "smooth", block: "start"}); }, 80);
  }
  function focusLoan(slip){
    query = slip; $("q").value = slip; setFilter("all");
    if (view !== "registre") setView("registre"); else renderRegister();
    history.replaceState(null, "", "#register");
  }
  window.addEventListener("hashchange", route);

  function renderAll(){
    renderBell();
    if (view === "registre") renderRegister();
    if (view === "inventaire") renderInventory();
    if (view === "stats") renderStats();
    if (view === "calendrier"){ renderCalendar(); renderReqList(); renderResList(); }
    reqBadge();
  }

  // ---------- registre ----------
  function setFilter(f){ filter = f; document.querySelectorAll("#view-registre .chip, #view-registre .stat[data-f]").forEach(x => x.setAttribute("aria-pressed", x.dataset.f===f?"true":"false")); }

  function renderRegister(){
    const today = isoToday(), month = today.slice(0,7);
    let out=0, late=0, back=0;
    for (const l of loans){
      const s=status(l).key;
      if (s==="back"){ if ((l.returnDate||"").startsWith(month)) back++; }
      else { out++; if(s==="late") late++; }
    }
    $("sOut").textContent=out; $("sLate").textContent=late; $("sBack").textContent=back;

    const q = query.trim().toLowerCase();
    const shown = loans.filter(l => {
      const s=status(l).key;
      if (filter==="active" && s==="back") return false;
      if (filter==="late" && s!=="late") return false;
      if (filter==="back" && s!=="back") return false;
      if (!q) return true;
      const hay = [l.slipNo,l.borrower,l.department,l.site,l.purpose, ...l.items.flatMap(i=>[i.item,i.category,i.serial,i.assetTag])].join(" ").toLowerCase();
      return hay.includes(q);
    }).sort((a,b) => {
      if (filter!=="back"){ const ra=a.returnDate?1:0, rb=b.returnDate?1:0; if(ra!==rb) return ra-rb; if(!a.returnDate && !b.returnDate) return a.dueDate.localeCompare(b.dueDate); }
      return (b.createdAt||"").localeCompare(a.createdAt||"");
    });
    const rank = {late:0, soon:1, out:2, back:3};
    const shownSorted = applySort(shown, sorts.reg, {
      slip: l => l.slipNo, item: l => (l.items[0] && l.items[0].item) || "", borrower: l => l.borrower, site: l => l.site || "",
      loaned: l => l.loanDate, due: l => l.dueDate, status: l => rank[status(l).key] * 1e4 + (l.dueDate || "").replace(/-/g,"") / 1e4
    });
    syncSortHeads($("rows").closest("table"), sorts.reg);

    $("rows").innerHTML = shownSorted.map(l => {
      const s = status(l);
      const items = l.items.slice(0,3).map(i => `<div class="itemline${i.returnDate?" done":""}">${esc(i.item)} <button type="button" class="link serial" data-hist-serial="${esc(i.serial)}" title="${esc(t("openHistItem"))}">${esc(i.serial)}</button></div>`).join("");
      const more = l.items.length > 3 ? `<div class="sub">${esc(t("moreItems",{n:l.items.length-3}))}</div>` : "";
      const part = partial(l) ? `<div class="sub">${esc(t("itemsReturned",{a:l.items.length-openItems(l).length,b:l.items.length}))}</div>` : "";
      const ext = l.extensionCount ? `<div class="sub ext">${esc(t("extendedN",{n:l.extensionCount}))}</div>` : "";
      return `<tr>
        <td><span class="tag">${esc(l.slipNo)}</span></td>
        <td>${items}${more}</td>
        <td><button type="button" class="link" data-hist-borrower="${esc(l.borrower)}" title="${esc(t("openHistBorrower"))}">${esc(l.borrower)}</button><div class="sub">${esc(l.department)}</div></td>
        <td>${esc(l.site)}</td>
        <td class="mono">${fmt(l.loanDate)}</td>
        <td class="mono">${fmt(l.dueDate)}${ext}</td>
        <td><span class="pill ${s.key}">${esc(s.label)}</span>${part}</td>
        <td><div class="rowacts">
          ${l.returnDate
            ? `<button class="btn small" type="button" data-act="slip" data-id="${l.id}">${esc(t("actSlip"))}</button>`
            : `<button class="btn small accent" type="button" data-act="ret" data-id="${l.id}">${esc(t("actReturn"))}</button>`}
          <button class="btn small more" type="button" data-more="${l.id}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t("actMore"))}" title="${esc(t("actMore"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
        </div></td></tr>`;
    }).join("");

    const empty=$("empty"); $("emptyNew").hidden=true;
    if (!loaded){ empty.hidden=false; $("emptyTitle").textContent=t("emptyLoading"); $("emptyText").textContent=""; return; }
    if (shown.length){ empty.hidden=true; return; }
    empty.hidden=false;
    if (!loans.length){
      $("emptyTitle").textContent = online ? t("emptyNone") : t("emptyOffline");
      $("emptyText").textContent = online ? t("emptyNoneText") : t("emptyOfflineText");
      $("emptyNew").hidden = !online;
    } else if (q){ $("emptyTitle").textContent = t("emptySearch"); $("emptyText").textContent = t("emptySearchText"); }
    else { $("emptyTitle").textContent = t("emptyFilter")[filter]; $("emptyText").textContent = t("emptyFilterText"); }
  }

  $("rows").addEventListener("click", e => {
    const hs = e.target.closest("[data-hist-serial]"); if (hs){ openItemHistory({serial: hs.dataset.histSerial}); return; }
    const hb = e.target.closest("[data-hist-borrower]"); if (hb){ openBorrowerHistory(hb.dataset.histBorrower); return; }
    const mb = e.target.closest("button[data-more]"); if (mb){ toggleRowMenu(mb); return; }
    const b = e.target.closest("button[data-act]"); if(!b) return;
    rowAction(b.dataset.act, b.dataset.id);
  });
  function rowAction(act, id){
    const l = loanById(id); if(!l) return;
    if (act==="slip") showSlip(l);
    if (act==="ret") openReturn(l);
    if (act==="ext") openExtend(l);
    if (act==="edit") openForm(l);
  }

  // "⋯" menu of a register row
  let menuBtn = null;
  function closeRowMenu(focusBack){
    const m = $("rowMenu"); if (m.hidden) return;
    m.hidden = true; if (menuBtn){ menuBtn.setAttribute("aria-expanded","false"); if (focusBack) menuBtn.focus(); } menuBtn = null;
  }
  function toggleRowMenu(btn){
    if (menuBtn === btn) return closeRowMenu(true);
    closeRowMenu(false);
    const l = loanById(btn.dataset.more); if (!l) return;
    const items = [];
    if (l.returnDate) items.push(["edit","actEdit"]);
    else items.push(["slip","actSlip"],["ext","actExtend"],["edit","actEdit"]);
    const m = $("rowMenu");
    m.innerHTML = items.map(([a,k]) => `<button type="button" role="menuitem" data-act="${a}" data-id="${l.id}">${esc(t(k))}</button>`).join("");
    m.hidden = false; menuBtn = btn; btn.setAttribute("aria-expanded","true");
    const r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw)) + "px";
    m.style.top = (r.bottom + mh + 12 > innerHeight ? Math.max(8, r.top - mh - 4) : r.bottom + 4) + "px";
    m.querySelector("button").focus();
  }
  $("rowMenu").addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const act = b.dataset.act, id = b.dataset.id; closeRowMenu(false); rowAction(act, id);
  });
  $("rowMenu").addEventListener("keydown", e => {
    const its = [...$("rowMenu").querySelectorAll("button")], i = its.indexOf(document.activeElement);
    if (e.key === "ArrowDown"){ e.preventDefault(); its[(i+1)%its.length].focus(); }
    else if (e.key === "ArrowUp"){ e.preventDefault(); its[(i-1+its.length)%its.length].focus(); }
    else if (e.key === "Home"){ e.preventDefault(); its[0].focus(); }
    else if (e.key === "End"){ e.preventDefault(); its[its.length-1].focus(); }
    else if (e.key === "Tab"){ closeRowMenu(false); }
  });
  document.addEventListener("click", e => { if (!$("rowMenu").hidden && !e.target.closest("#rowMenu") && !e.target.closest("[data-more]")) closeRowMenu(false); });
  addEventListener("scroll", () => closeRowMenu(false), true);
  addEventListener("resize", () => closeRowMenu(false));

  // ---------- listes ----------
  function refreshLists(){
    const people = new Set(loans.map(l => l.borrower).filter(Boolean));
    $("borrowers").innerHTML = [...people].sort((a,b)=>a.localeCompare(b,"fr")).map(d=>`<option value="${esc(d)}">`).join("");
    fillFilters();
  }
  function fillFilters(){
    const sel = $("st_site"), cur = sel.value;
    const sites = new Set(settings ? settings.sites : []); loans.forEach(l => l.site && sites.add(l.site));
    sel.innerHTML = `<option value="">${esc(t("allSites"))}</option>` + [...sites].map(s => `<option>${esc(s)}</option>`).join("");
    sel.value = [...sites].includes(cur) ? cur : "";
    const cs = $("iCat");
    const cats = new Set(settings ? settings.categories : []); equipment.forEach(e => e.category && cats.add(e.category));
    cs.innerHTML = `<option value="">${esc(t("allCats"))}</option>` + [...cats].map(c => `<option>${esc(c)}</option>`).join("");
    cs.value = [...cats].includes(invCat) ? invCat : "";
  }

  // ---------- inventaire ----------
  const eqState = e => e.currentLoan || e.status === "loaned" ? "loaned" : "available";
  function renderInventory(){
    const total = equipment.length, loaned = equipment.filter(e => eqState(e)==="loaned").length;
    $("iTotal").textContent = total; $("iAvail").textContent = total - loaned; $("iLoaned").textContent = loaned;
    const q = invQuery.trim().toLowerCase();
    const shown = equipment.filter(e => {
      if (invFilter !== "all" && eqState(e) !== invFilter) return false;
      if (invCat && e.category !== invCat) return false;
      if (!q) return true;
      return [e.name,e.serial,e.assetTag,e.category,e.site,e.notes,e.currentLoan&&e.currentLoan.borrower].join(" ").toLowerCase().includes(q);
    });
    const shownInv = applySort(shown, sorts.inv, {
      state: e => eqState(e), name: e => e.name, serial: e => e.serial, site: e => e.site || "",
      where: e => e.currentLoan ? e.currentLoan.slipNo : "~"
    });
    syncSortHeads($("invRows").closest("table"), sorts.inv);
    $("invRows").innerHTML = shownInv.map(e => {
      const st = eqState(e);
      const where = e.currentLoan
        ? `<button type="button" class="link" data-focus-loan="${esc(e.currentLoan.slipNo)}">${esc(e.currentLoan.slipNo)}</button><div class="sub">${esc(t("whereLoan",{who:e.currentLoan.borrower, d:fmt(e.currentLoan.dueDate)}))}</div>`
        : st === "loaned" ? `<span class="sub">${esc(t("whereManual"))}</span>` : `<span class="sub">${esc(t("whereShelf"))}</span>`;
      const nr = e.nextReservation ? `<div class="sub resline"><button type="button" class="link" data-open-res="${e.nextReservation.id}">${esc(e.nextReservation.resNo)}</button> · ${esc(t("whereRes",{a:fmt(e.nextReservation.startDate), b:fmt(e.nextReservation.endDate), who:e.nextReservation.borrower}))}</div>` : "";
      const label = st==="loaned" ? t("dotLoaned") : t("dotAvailable");
      const action = st==="loaned" ? t("dotToAvailable") : t("dotToLoaned");
      return `<tr>
        <td><button type="button" class="dot ${st}" data-dot="${e.id}" title="${esc(action)}" aria-label="${esc(label+" · "+action)}"></button><span class="dotlabel">${esc(label)}</span></td>
        <td><div>${esc(e.name)}</div><div class="sub">${esc(e.category)}</div></td>
        <td><div class="mono">${esc(e.serial)}</div>${e.assetTag?`<div class="serial">${esc(e.assetTag)}</div>`:""}</td>
        <td>${esc(e.site)}</td>
        <td>${where}${nr}</td>
        <td><div class="rowacts">
          <button class="btn small" type="button" data-eq-hist="${e.id}">${esc(t("actHistory"))}</button>
          <button class="btn small" type="button" data-eq-edit="${e.id}">${esc(t("actEdit"))}</button>
        </div></td></tr>`;
    }).join("");
    const empty = $("invEmpty");
    empty.hidden = shown.length > 0;
    $("invEmptyTitle").textContent = equipment.length ? t("invNoMatch") : t("invEmpty");
    $("invEmptyText").textContent = equipment.length ? t("invNoMatchText") : t("invEmptyText");
  }
  function bindSort(tbodyId, st, rerender){
    $(tbodyId).closest("table").querySelector("thead").addEventListener("click", ev => {
      const th = ev.target.closest("th[data-sort]"); if (!th) return;
      const k = th.dataset.sort;
      if (st.key !== k){ st.key = k; st.dir = 1; } else if (st.dir === 1){ st.dir = -1; } else { st.key = ""; st.dir = 1; }
      rerender();
    });
  }
  bindSort("rows", sorts.reg, () => renderRegister());
  bindSort("invRows", sorts.inv, () => renderInventory());
  $("iq").addEventListener("input", e => { invQuery = e.target.value; renderInventory(); });
  $("iCat").addEventListener("change", e => { invCat = e.target.value; renderInventory(); });
  $("invChips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    invFilter = c.dataset.s; $("invChips").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x===c?"true":"false")); renderInventory();
  });
  $("invRows").addEventListener("click", async e => {
    const fl = e.target.closest("[data-focus-loan]"); if (fl){ focusLoan(fl.dataset.focusLoan); return; }
    const or = e.target.closest("[data-open-res]"); if (or){ const r = resById(or.dataset.openRes); if (r) openReservation(r); return; }
    const h = e.target.closest("[data-eq-hist]"); if (h){ const eq = eqById(h.dataset.eqHist); if (eq) openItemHistory({equipmentId: eq.id, serial: eq.serial}); return; }
    const ed = e.target.closest("[data-eq-edit]"); if (ed){ openEq(eqById(ed.dataset.eqEdit)); return; }
    const d = e.target.closest("[data-dot]"); if (!d) return;
    const eq = eqById(d.dataset.dot); if (!eq) return;
    const next = eqState(eq) === "loaned" ? "available" : "loaned";
    d.disabled = true;
    try{
      await api("POST", `/api/equipment/${eq.id}/status`, {status: next});
      toast(t("tStatus",{n:eq.name, s: next==="loaned" ? t("dotLoaned") : t("dotAvailable")}));
      await load();
    }catch(ex){
      d.disabled = false;
      if (ex.data && ex.data.code === "on_loan"){
        const l = loanById(ex.data.loanId);
        confirmBox({ title: t("onLoanTitle"), text: ex.message, yes: t("onLoanAction"), danger: false, onYes: () => l && openReturn(l, eq.id) });
      } else toast(ex.message);
    }
  });

  function openEq(eq){
    eqEditingId = eq ? eq.id : null;
    $("eqTitle").textContent = eq ? t("eqEdit") : t("eqNew");
    $("eqSave").textContent = eq ? t("eqSaveEdit") : t("eqSaveNew");
    $("eqDel").hidden = !eq;
    $("eqErr").hidden = true;
    $("eqForm").reset();
    $("e_category").innerHTML = listOptions(settings.categories, eq && eq.category);
    $("e_site").innerHTML = listOptions(settings.sites, eq && eq.site);
    if (eq){ $("e_name").value = eq.name; $("e_serial").value = eq.serial; $("e_assetTag").value = eq.assetTag; $("e_notes").value = eq.notes; }
    $("eqSheet").hidden = false; setTimeout(() => $("e_name").focus(), 50);
  }
  const closeEq = () => { $("eqSheet").hidden = true; eqEditingId = null; };
  $("newEqBtn").addEventListener("click", () => openEq(null));
  $("closeEq").addEventListener("click", closeEq); $("cancelEq").addEventListener("click", closeEq);
  $("eqForm").addEventListener("submit", async e => {
    e.preventDefault();
    const body = { name: $("e_name").value.trim(), category: $("e_category").value, site: $("e_site").value, serial: $("e_serial").value.trim(), assetTag: $("e_assetTag").value.trim(), notes: $("e_notes").value.trim() };
    const err = $("eqErr");
    if (!body.name || !body.serial){ err.textContent = t("errEqRequired"); err.hidden = false; return; }
    try{
      if (eqEditingId) await api("PUT", `/api/equipment/${eqEditingId}`, body);
      else await api("POST", "/api/equipment", body);
      closeEq(); toast(t("tEqSaved")); await load();
    }catch(ex){ err.textContent = ex.message; err.hidden = false; }
  });
  $("eqDel").addEventListener("click", () => {
    const eq = eqById(eqEditingId); if (!eq) return;
    confirmBox({ title: t("eqDelTitle"), text: t("eqDelText",{n:eq.name, s:eq.serial}), yes: t("delete"), danger: true, onYes: async () => {
      try{ const d = await api("DELETE", `/api/equipment/${eq.id}`); closeEq(); toast(t("tEqDeleted"), d && d.undo); await load(); }
      catch(ex){ $("eqErr").textContent = ex.message; $("eqErr").hidden = false; }
    }});
  });

  // ---------- formulaire de prêt (plusieurs objets) ----------
  const HMAP = {borrower:"borrower",dept:"department",site:"site",contact:"contact",purpose:"purpose",issuedBy:"issuedBy",loanDate:"loanDate",dueDate:"dueDate",notes:"notes"};
  const availableEquipment = () => equipment.filter(e => eqState(e)==="available" && !formItems.some(i => String(i.equipmentId)===String(e.id)));
  const pickLabel = e => `${e.name} — ${e.serial}${e.site ? " · "+e.site : ""}`;
  function refreshPicker(){
    $("invList").innerHTML = availableEquipment().map(e => `<option value="${esc(pickLabel(e))}">`).join("");
  }
  function addFromInventory(eq){
    if (formItems.some(i => String(i.equipmentId)===String(eq.id))){ toast(t("alreadyInLoan")); return; }
    formItems.push({ equipmentId: eq.id, item: eq.name, category: eq.category, serial: eq.serial, assetTag: eq.assetTag, accessories: "", conditionOut: "good" });
    renderItemRows(); refreshPicker();
  }
  $("invPick").addEventListener("input", e => {
    const v = e.target.value.trim(); if (!v) return;
    const lower = v.toLowerCase();
    const avail = availableEquipment();
    const eq = avail.find(x => pickLabel(x) === v) || avail.find(x => x.serial.toLowerCase() === lower);
    if (eq){ addFromInventory(eq); e.target.value = ""; }
  });
  $("invPick").addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const lower = e.target.value.trim().toLowerCase(); if (!lower) return;
    const matches = availableEquipment().filter(x => pickLabel(x).toLowerCase().includes(lower));
    if (matches.length === 1){ addFromInventory(matches[0]); e.target.value = ""; }
  });
  $("addManual").addEventListener("click", () => {
    formItems.push({ equipmentId: null, item: "", category: (settings.categories||[]).find(c => /^(autre|other)s?$/i.test(c)) || "", serial: "", assetTag: "", accessories: "", conditionOut: "good", addToInventory: true });
    renderItemRows();
    const rows = $("itemRows").querySelectorAll(".itemrow"); const last = rows[rows.length-1];
    if (last) last.querySelector('[data-f="item"]').focus();
  });

  function renderItemRows(){
    const box = $("itemRows");
    if (!formItems.length){ box.innerHTML = `<div class="noitems">${esc(t("noItems"))}</div>`; refreshLoanWarnings(); return; }
    box.innerHTML = formItems.map((it, i) => {
      const inv = !!it.equipmentId, done = !!it.returnDate;
      const ro = inv || done ? " readonly" : "";
      const badge = done ? `<span class="pill back">${esc(t("badgeReturned",{d:fmt(it.returnDate)}))}</span>`
        : inv ? `<span class="pill out">${esc(t("badgeInv"))}</span>` : `<span class="pill neutral">${esc(t("badgeNew"))}</span>`;
      return `<div class="itemrow${done?" done":""}" data-i="${i}">
        <div class="itemhead"><span class="num">${i+1}</span>${badge}
          ${done ? "" : `<button type="button" class="x" data-rm="${i}" title="${esc(t("removeItem"))}" aria-label="${esc(t("removeItem"))}">×</button>`}</div>
        <div class="grid2">
          <label><span>${esc(t("fItem"))}</span><input data-f="item" value="${esc(it.item)}"${ro} placeholder="${esc(t("fItemPh"))}"></label>
          <label><span>${esc(t("fSerial"))}</span><input data-f="serial" class="mono" value="${esc(it.serial)}"${ro}></label>
        </div>
        <div class="grid3">
          <label><span>${esc(t("fCat"))}</span><select data-f="category"${done?" disabled":""}>${listOptions(settings.categories, it.category)}</select></label>
          <label><span>${esc(t("fTag"))}</span><input data-f="assetTag" class="mono" value="${esc(it.assetTag)}"${ro}></label>
          <label><span>${esc(t("fCondOut"))}</span><select data-f="conditionOut"${done?" disabled":""}>${condOptions(CONDS_OUT, it.conditionOut)}</select></label>
        </div>
        <label><span>${esc(t("fAcc"))}</span><input data-f="accessories" value="${esc(it.accessories)}" placeholder="${esc(t("fAccPh"))}"${done?" readonly":""}></label>
        ${!inv && !it.id ? `<label class="check"><input type="checkbox" data-f="addToInventory"${it.addToInventory?" checked":""}><span>${esc(t("addToInv"))}</span></label>` : ""}
      </div>`;
    }).join("");
    refreshLoanWarnings();
  }

  // ---------- smart warnings in the loan form (from the Tally helper) ----------
  function loanWarnings(){
    const out = [], today = isoToday();
    const loanDate = $("f_loanDate").value || today, due = $("f_dueDate").value;
    const open = formItems.filter(it => !it.returnDate && (it.equipmentId || (it.serial || "").trim()));
    const sameItem = (it, ri) => (it.equipmentId && ri.equipmentId && String(it.equipmentId) === String(ri.equipmentId)) ||
      (!it.equipmentId && it.serial && ri.serial && it.serial.trim().toLowerCase() === ri.serial.trim().toLowerCase());
    // 1. reservations that start during the loan or within 3 days after it
    if (due){
      const limit = addDays(due, 3);
      for (const r of reservations){
        if (r.status !== "active" || (convertingRes && r.id === convertingRes.id) || r.endDate < loanDate || r.startDate > limit) continue;
        for (const it of open){
          if (!r.items.some(ri => sameItem(it, ri))) continue;
          const vars = {item: it.item || it.serial, who: r.borrower, d: fmt(r.startDate), no: r.resNo};
          out.push({kind: r.startDate <= due ? "bad" : "warn", text: t(r.startDate <= due ? "swResOverlap" : "swResSoon", vars)});
        }
      }
    }
    // 2. the borrower already has overdue loans
    const who = $("f_borrower").value.trim().toLowerCase();
    if (who){
      const late = loans.filter(l => !l.returnDate && l.dueDate < today && l.borrower.trim().toLowerCase() === who && String(l.id) !== String(editingId));
      if (late.length) out.push({kind: "warn", text: t(late.length === 1 ? "swLate1" : "swLateN", {who: $("f_borrower").value.trim(), n: late.length, slips: late.slice(0, 3).map(l => l.slipNo).join(", ")})});
    }
    // 3. the due date falls on a weekend
    if (due){
      const wd = new Date(due + "T12:00:00").getDay();
      if (wd === 0 || wd === 6) out.push({kind: "info", text: t(wd === 6 ? "swSaturday" : "swSunday", {d: fmt(due)})});
    }
    // 4. an open note mentions one of the items
    for (const it of open){
      const keys = [it.serial, it.assetTag].map(x => (x || "").trim().toLowerCase()).filter(x => x.length >= 4);
      const n = keys.length && notesData.find(nt => !nt.done && keys.some(k => nt.text.toLowerCase().includes(k)));
      if (n) out.push({kind: "info", text: t("swNote", {item: it.item || it.serial, note: n.text.split("\n")[0].slice(0, 120)})});
    }
    return out;
  }
  function refreshLoanWarnings(){
    const box = $("formWarn"); if (!box) return;
    if ($("sheet").hidden){ box.hidden = true; return; }
    const w = loanWarnings();
    box.hidden = !w.length;
    if (!w.length){ box.innerHTML = ""; return; }
    box.innerHTML = `<div class="sw-head"><span class="sw-av" aria-hidden="true"><img src="mascot.webp" alt=""></span><strong>${esc(t("swTitle"))}</strong></div>
      <ul>${w.map(x => `<li class="sw-${x.kind}">${esc(x.text)}</li>`).join("")}</ul>`;
  }
  ["f_borrower","f_dueDate","f_loanDate"].forEach(id => { $(id).addEventListener("input", refreshLoanWarnings); $(id).addEventListener("change", refreshLoanWarnings); });
  $("itemRows").addEventListener("change", () => refreshLoanWarnings());
  $("itemRows").addEventListener("input", e => {
    const row = e.target.closest(".itemrow"); const f = e.target.dataset.f; if (!row || !f) return;
    const it = formItems[Number(row.dataset.i)];
    it[f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  });
  $("itemRows").addEventListener("change", e => {
    const row = e.target.closest(".itemrow"); const f = e.target.dataset.f; if (!row || !f) return;
    formItems[Number(row.dataset.i)][f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
  });
  $("itemRows").addEventListener("click", e => {
    const b = e.target.closest("[data-rm]"); if (!b) return;
    formItems.splice(Number(b.dataset.rm), 1); renderItemRows(); refreshPicker();
  });

  // ---------- on-screen signature pad ----------
  function makeSigPad(host, labelKey){
    host.innerHTML = `<canvas class="sigcanvas" role="img" aria-label="${esc(t(labelKey))}"></canvas><div class="sigtools"><span class="sub">${esc(t("sigHint"))}</span><button type="button" class="link" data-sig="clear">${esc(t("sigClear"))}</button></div>`;
    const cv = host.querySelector("canvas"), ctx = cv.getContext("2d");
    let drawing = false, empty = true, dirty = false, last = null, dpr = 1;
    function fit(){
      const r = cv.getBoundingClientRect(); dpr = Math.max(1, window.devicePixelRatio || 1);
      cv.width = Math.max(10, Math.round(r.width * dpr)); cv.height = Math.max(10, Math.round(r.height * dpr));
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.4 * dpr; ctx.strokeStyle = "#111";
    }
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
    cv.addEventListener("pointerdown", e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing = true; last = pos(e); ctx.beginPath(); ctx.arc(last[0], last[1], ctx.lineWidth / 2, 0, 7); ctx.fillStyle = "#111"; ctx.fill(); empty = false; dirty = true; host.classList.add("signed"); });
    cv.addEventListener("pointermove", e => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; });
    const end = () => { drawing = false; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    host.querySelector('[data-sig="clear"]').addEventListener("click", () => { fit(); empty = true; dirty = true; host.classList.remove("signed"); });
    return {
      // call once the field is visible so the canvas can be sized; `img` is an existing signature to show
      reset(img){
        fit(); empty = true; dirty = false; host.classList.remove("signed");
        if (img){ const im = new Image(); im.onload = () => { const k = Math.min(cv.width / im.width, cv.height / im.height); ctx.drawImage(im, 0, 0, im.width * k, im.height * k); empty = false; host.classList.add("signed"); }; im.src = img; }
      },
      get dirty(){ return dirty; },
      data(){ return empty ? "" : cv.toDataURL("image/png"); },
    };
  }
  let padOut = null, padIn = null;
  const ensurePads = () => { if (!padOut) padOut = makeSigPad($("sigPadOut"), "sigBorrower"); if (!padIn) padIn = makeSigPad($("sigPadIn"), "sigReturn"); };

  function openForm(l, presetEquipmentId, fromRes){
    editingId = l ? l.id : null;
    convertingRes = !l && fromRes ? fromRes : null;
    $("fromRes").hidden = !convertingRes;
    if (convertingRes) $("fromRes").textContent = t("fromRes",{no:convertingRes.resNo});
    $("delBtn").hidden = !l;
    $("sheetTitle").textContent = l ? t("sheetEdit",{no:l.slipNo}) : t("sheetNew");
    $("saveBtn").textContent = l ? t("saveEdit") : t("saveNew");
    $("formErr").hidden = true;
    $("form").reset();
    const src = l || convertingRes;
    $("f_site").innerHTML = listOptions(settings.sites, src && src.site);
    $("f_dept").innerHTML = listOptions(settings.departments, src && src.department);
    if (l){
      for (const k in HMAP){ if (k==="site"||k==="dept") continue; const v = l[HMAP[k]]; if (v != null) $("f_"+k).value = v; }
      formItems = l.items.map(i => ({...i}));
    } else {
      const today = isoToday();
      $("f_loanDate").value = today; $("f_dueDate").value = addDays(today, settings.defaultLoanDays||14);
      $("f_issuedBy").value = "";
      formItems = [];
      const eq = presetEquipmentId && eqById(presetEquipmentId);
      if (eq) formItems.push({ equipmentId: eq.id, item: eq.name, category: eq.category, serial: eq.serial, assetTag: eq.assetTag, accessories: "", conditionOut: "good" });
      if (convertingRes){
        const r = convertingRes;
        for (const k of ["borrower","contact","purpose","notes"]) $("f_"+k).value = r[k] || "";
        $("f_dueDate").value = r.endDate >= today ? r.endDate : addDays(today, settings.defaultLoanDays||14);
        for (const ri of r.items){
          const q = eqById(ri.equipmentId);
          formItems.push({ equipmentId: ri.equipmentId, item: q ? q.name : ri.item, category: q ? q.category : ri.category, serial: q ? q.serial : ri.serial, assetTag: q ? q.assetTag : "", accessories: "", conditionOut: "good" });
        }
      }
    }
    renderItemRows(); refreshPicker();
    $("sheet").hidden = false; refreshLoanWarnings(); setTimeout(() => (l ? $("f_borrower") : $("invPick")).focus(), 50);
    $("sigFieldOut").hidden = !settings.signatureOn;
    if (settings.signatureOn){
      ensurePads();
      requestAnimationFrame(async () => {
        let img = "";
        if (l && l.hasSigOut) { try{ img = (await api("GET", `/api/loans/${l.id}/signatures`)).out; }catch(_){} }
        padOut.reset(img);
      });
    }
  }
  const closeForm = () => { $("sheet").hidden = true; editingId = null; convertingRes = null; };
  $("f_loanDate").addEventListener("change", () => { if (!editingId && $("f_loanDate").value) $("f_dueDate").value = addDays($("f_loanDate").value, settings.defaultLoanDays||14); });

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const v = {}; for (const k in HMAP) v[HMAP[k]] = $("f_"+k).value.trim();
    const err = $("formErr"), fail = m => { err.textContent = m; err.hidden = false; err.scrollIntoView({block:"nearest"}); };
    if (!formItems.length) return fail(t("errNoItems"));
    if (formItems.some(i => !String(i.item).trim() || !String(i.serial).trim())) return fail(t("errItem"));
    if (["borrower",...(settings.departments.length ? ["department"] : []),"loanDate","dueDate"].some(k => !v[k])) return fail(t("errRequired"));
    if (settings.requireIssuedBy && !v.issuedBy) return fail(t("errIssuer"));
    if (v.dueDate < v.loanDate) return fail(t("errDates"));
    v.items = formItems.map(i => ({ id: i.id, equipmentId: i.equipmentId, item: String(i.item).trim(), serial: String(i.serial).trim(), category: i.category, assetTag: String(i.assetTag||"").trim(), accessories: String(i.accessories||"").trim(), conditionOut: i.conditionOut, addToInventory: !!i.addToInventory }));
    if (convertingRes) v.reservationId = convertingRes.id;
    if (settings.signatureOn && padOut){ const sg = padOut.data(); if (editingId ? padOut.dirty : sg) v.signatureOut = sg; }
    $("saveBtn").disabled = true;
    try{
      if (v.issuedBy) store.set("issuedBy", v.issuedBy);
      if (editingId){ await api("PUT", `/api/loans/${editingId}`, v); closeForm(); toast(t("tEdited")); await load(); }
      else { const created = await api("POST", "/api/loans", v); closeForm(); toast(t("tSaved",{no:created.slipNo})); await load(); showSlip(created); }
    }catch(ex){ fail(ex.message || t("errSave")); }
    finally{ $("saveBtn").disabled = false; }
  });
  $("delBtn").addEventListener("click", () => {
    const l = loanById(editingId); if (!l) return;
    confirmBox({ title: t("delTitle"), text: t("delText",{no:l.slipNo, who:l.borrower}), yes: t("delete"), danger: true, onYes: async () => {
      try{ const r = await api("DELETE", `/api/loans/${l.id}`); closeForm(); toast(t("tDeleted"), r && r.undo); await load(); } catch(ex){ toast(ex.message); }
    }});
  });

  // ---------- retour (objet par objet) ----------
  function openReturn(l, onlyEquipmentId){
    returningId = l.id;
    $("retWhat").textContent = `${l.slipNo} · ${l.borrower}, ${l.department}`;
    $("retForm").reset(); $("r_date").value = isoToday(); $("retErr").hidden = true;
    const open = openItems(l);
    $("retItems").innerHTML = (open.length > 1 ? `<button type="button" class="link" id="retAll">${esc(t("rAll"))}</button>` : "") + open.map(i => {
      const checked = !onlyEquipmentId || String(i.equipmentId) === String(onlyEquipmentId);
      return `<div class="retrow" data-id="${i.id}">
        <label class="check"><input type="checkbox" data-r="on"${checked?" checked":""}><span><b>${esc(i.item)}</b> <span class="serial">${esc(i.serial)}</span></span></label>
        <div class="grid2">
          <label><span>${esc(t("rCond"))}</span><select data-r="cond">${condOptions(CONDS_IN, "good")}</select></label>
          <label><span>${esc(t("rNotes"))}</span><input data-r="notes" placeholder="${esc(t("rNotesPh"))}"></label>
        </div></div>`;
    }).join("");
    const all = $("retAll"); if (all) all.addEventListener("click", () => $("retItems").querySelectorAll('[data-r="on"]').forEach(c => c.checked = true));
    $("retSheet").hidden = false;
    $("sigFieldIn").hidden = !settings.signatureOn;
    if (settings.signatureOn){ ensurePads(); requestAnimationFrame(() => padIn.reset()); }
  }
  const closeRet = () => { $("retSheet").hidden = true; returningId = null; };
  $("retForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!returningId) return;
    const items = [...$("retItems").querySelectorAll(".retrow")].filter(r => r.querySelector('[data-r="on"]').checked)
      .map(r => ({ id: Number(r.dataset.id), conditionIn: r.querySelector('[data-r="cond"]').value, returnNotes: r.querySelector('[data-r="notes"]').value.trim() }));
    if (!items.length){ $("retErr").textContent = t("rNone"); $("retErr").hidden = false; return; }
    const retBody = {returnDate: $("r_date").value || isoToday(), items};
    if (settings.signatureOn && padIn){ const sg = padIn.data(); if (sg) retBody.signatureIn = sg; }
    try{ await api("POST", `/api/loans/${returningId}/return`, retBody); closeRet(); toast(t("tReturned")); await load(); }
    catch(ex){ $("retErr").textContent = ex.message; $("retErr").hidden = false; }
  });

  // ---------- prolongation ----------
  function openExtend(l){
    extendingId = l.id;
    $("extWhat").textContent = `${l.slipNo} · ${l.borrower} · ${l.items.map(i=>i.item).join(", ")}`;
    $("extForm").reset(); $("extErr").hidden = true;
    $("x_current").value = l.dueDate;
    $("x_due").value = addDays(l.dueDate, settings.defaultLoanDays||14);
    $("x_due").min = addDays(l.dueDate, 1);
    const prev = l.events.filter(ev => ev.type === "extended");
    $("extHist").innerHTML = prev.length ? `<div class="sub"><b>${esc(t("extPrev"))}</b></div>` + prev.map(ev => `<div class="sub">${fmt(ev.at)} · ${esc(t("extLine",{from:fmt(ev.from),to:fmt(ev.to)}))}${ev.reason?` · ${esc(ev.reason)}`:""}</div>`).join("") : "";
    $("extSheet").hidden = false;
  }
  const closeExt = () => { $("extSheet").hidden = true; extendingId = null; };
  $("extQuick").addEventListener("click", e => {
    const b = e.target.closest("[data-d]"); if (!b) return;
    $("x_due").value = addDays($("x_current").value, Number(b.dataset.d));
  });
  $("extForm").addEventListener("submit", async e => {
    e.preventDefault();
    const due = $("x_due").value;
    if (!due || due <= $("x_current").value){ $("extErr").textContent = t("extErrDate"); $("extErr").hidden = false; return; }
    try{ await api("POST", `/api/loans/${extendingId}/extend`, {dueDate: due, reason: $("x_reason").value.trim()}); closeExt(); toast(t("tExtended",{d:fmt(due)})); await load(); }
    catch(ex){ $("extErr").textContent = ex.message; $("extErr").hidden = false; }
  });

  // ---------- historiques ----------
  function histRow(l, items, showBorrower){
    const done = items.every(i => i.returnDate);
    const retDate = done ? items.map(i=>i.returnDate).sort().pop() : "";
    const late = done ? retDate > l.dueDate : isoToday() > l.dueDate;
    const stateTxt = !done ? t("histOngoing") : late ? t("histReturnedLate") : t("histOnTime");
    const cls = !done ? (late ? "late" : "out") : late ? "soon" : "back";
    const exts = l.events.filter(ev => ev.type==="extended").map(ev => t("extLine",{from:fmt(ev.from),to:fmt(ev.to)}));
    const lines = items.map(i => {
      const cond = (i.conditionOut || i.conditionIn) ? ` · ${esc(t("histCond",{a:condLabel(i.conditionOut)||"—", b: i.returnDate ? (condLabel(i.conditionIn)||"—") : "…"}))}` : "";
      return `<div class="sub">${esc(i.item)} <span class="serial">${esc(i.serial)}</span>${cond}${i.returnNotes?` · ${esc(i.returnNotes)}`:""}</div>`;
    }).join("");
    return `<div class="histrow">
      <div class="histmain">
        <button type="button" class="tag tagbtn" data-slip-id="${l.id}">${esc(l.slipNo)}</button>
        <span class="mono">${fmt(l.loanDate)} → ${done ? fmt(retDate) : "…"}</span>
        <span class="pill ${cls}">${esc(stateTxt)}</span>
      </div>
      ${showBorrower ? `<div><button type="button" class="link" data-hist-borrower="${esc(l.borrower)}">${esc(l.borrower)}</button> <span class="sub">· ${esc(l.department)}</span></div>` : ""}
      ${lines}
      ${exts.length ? `<div class="sub ext">${esc(t("histExtended",{list:exts.join(", ")}))}</div>` : ""}
    </div>`;
  }
  function openItemHistory({equipmentId, serial}){
    const eq = (equipmentId && eqById(equipmentId)) || equipment.find(e => serial && e.serial.toLowerCase() === String(serial).toLowerCase());
    const sLower = String(serial || (eq && eq.serial) || "").toLowerCase();
    const match = i => (eq && String(i.equipmentId) === String(eq.id)) || (sLower && i.serial.toLowerCase() === sLower);
    const rows = loans.map(l => ({ l, items: l.items.filter(match) })).filter(x => x.items.length).sort((a,b) => b.l.loanDate.localeCompare(a.l.loanDate));
    const name = eq ? eq.name : (rows[0] ? rows[0].items[0].item : serial);
    $("histKind").textContent = t("histItem");
    const st = eq ? eqState(eq) : null;
    $("histTitle").innerHTML = `${st ? `<span class="dot ${st} static"></span>` : ""}${esc(name)} <span class="serial">${esc(eq ? eq.serial : serial)}</span>`;
    let totalDays = 0;
    rows.forEach(({l, items}) => items.forEach(i => { totalDays += Math.max(0, daysBetween(l.loanDate, i.returnDate || isoToday())); }));
    $("histSum").textContent = rows.length ? t("histItemSum",{n:rows.length, d:totalDays}) : t("histEmpty");
    $("histList").innerHTML = rows.map(({l, items}) => histRow(l, items, true)).join("");
    $("histSheet").hidden = false;
  }
  function openBorrowerHistory(name){
    const n = String(name).trim().toLowerCase();
    const rows = loans.filter(l => l.borrower.trim().toLowerCase() === n).sort((a,b) => b.loanDate.localeCompare(a.loanDate));
    $("histKind").textContent = t("histBorrower");
    const depts = [...new Set(rows.map(l => l.department))].join(", ");
    $("histTitle").innerHTML = `${esc(name)}${depts ? ` <span class="sub">· ${esc(depts)}</span>` : ""}`;
    const ongoing = rows.filter(l => !l.returnDate).length;
    const lateRet = rows.filter(l => l.returnDate && l.returnDate > l.dueDate).length;
    $("histSum").textContent = rows.length ? t("histBorrowerSum",{n:rows.length, o:ongoing, l:lateRet}) : t("histEmpty");
    $("histList").innerHTML = rows.map(l => histRow(l, l.items, false)).join("");
    $("histSheet").hidden = false;
  }
  $("histList").addEventListener("click", e => {
    const s = e.target.closest("[data-slip-id]"); if (s){ const l = loanById(s.dataset.slipId); if (l) showSlip(l); return; }
    const hs = e.target.closest("[data-hist-serial]"); if (hs){ openItemHistory({serial: hs.dataset.histSerial}); return; }
    const b = e.target.closest("[data-hist-borrower]"); if (b) openBorrowerHistory(b.dataset.histBorrower);
  });
  $("closeHist").addEventListener("click", () => { $("histSheet").hidden = true; });

  // ---------- bordereau + QR ----------
  const baseUrl = () => (settings && settings.publicUrl) || location.origin;
  function qrSvg(text, size){
    if (!window.qrcode) return "";
    try{
      const q = qrcode(0, "M"); q.addData(text); q.make();
      const n = q.getModuleCount(), cell = Math.max(1, Math.floor(size / (n + 2)));
      return q.createSvgTag(cell, cell);
    }catch(_){ return ""; }
  }
  // standard agreement text; the organisation name is optional
  const defaultTerms = (code, org) => fill(I18N[code].slip.defaultTerms, {org: code === "en" ? (org || "the organisation") : (org ? ` (${org})` : "")});
  function slipHTML(l, sigs = {}){
    const sl = slipLang();
    const row = (k,v) => `<tr><th>${k}</th><td>${v||"&nbsp;"}</td></tr>`;
    const org = settings.orgName || "";
    const custom = settings.terms || "";
    const terms = (custom.trim() || defaultTerms(sl, org)).split("\n").map(s=>s.trim()).filter(Boolean);
    const loanQr = qrSvg(`${baseUrl()}/#loan:${encodeURIComponent(l.slipNo)}`, 92);
    const exts = l.events.filter(ev => ev.type==="extended");
    const items = l.items.map((i, n) => `<tr>
      <td class="c">${n+1}</td><td>${esc(i.item)}<div class="small">${esc(i.category)}</div></td>
      <td class="mono">${esc(i.serial)}</td><td class="mono">${esc(i.assetTag)}</td><td>${esc(i.accessories)}</td><td>${esc(condLabel(i.conditionOut, sl))}</td></tr>`).join("");
    const ret = l.items.map((i, n) => `<tr><td class="c">${n+1}</td><td>${esc(i.item)} <span class="mono small">${esc(i.serial)}</span></td><td>${i.returnDate?fmt(i.returnDate):""}</td><td>${esc(condLabel(i.conditionIn, sl))}${i.returnNotes?` — ${esc(i.returnNotes)}`:""}</td><td></td></tr>`).join("");
    return `<!doctype html><html lang="${sl}"><head><meta charset="utf-8"><title>${esc(ts("title"))} ${esc(l.slipNo)}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font:10pt/1.4 "IBM Plex Sans","Segoe UI",Arial,sans-serif;color:#111;margin:0;padding:24px;background:#fff}
.bar{display:flex;justify-content:flex-end;margin-bottom:12px}
.bar button{font:inherit;padding:6px 14px;border:1px solid #1f4fbf;background:#1f4fbf;color:#fff;border-radius:6px;cursor:pointer}
@media print{.bar{display:none}body{padding:0}}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px;gap:16px}
h1{font:700 18pt/1.1 "Barlow Semi Condensed","Arial Narrow",Arial,sans-serif;margin:0}
.org{font-size:9.5pt;color:#444;margin-top:4px}
.no{display:flex;gap:12px;align-items:flex-start;text-align:right}
.no b{display:inline-block;background:#f2c94c;padding:2px 8px;font:500 12pt "IBM Plex Mono",Consolas,monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.no div div{font-size:9pt;color:#444;margin-top:4px}
.no svg{display:block;width:92px;height:92px}
.scan{font-size:7.5pt;color:#666;text-align:center;max-width:92px}
h2{font:600 10pt "Barlow Semi Condensed",Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#444;margin:12px 0 5px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #bbb;padding:4px 7px;text-align:left;vertical-align:middle}
th{background:#f2f4f3;font-weight:600;font-size:9pt}
table.kv th{width:32%}
.items th{font-size:8.5pt}
.c{text-align:center;width:28px}
.logo{display:block;max-height:64px;max-width:240px;margin:8px 0 4px;object-fit:contain}
.mono{font-family:"IBM Plex Mono",Consolas,monospace}
.small{font-size:8.5pt;color:#555}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.terms{font-size:8.8pt;color:#333;border:1px solid #bbb;padding:7px 10px;margin-top:12px}
.terms ul{margin:4px 0 0;padding-left:18px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}
.sig{border:1px solid #bbb;padding:7px 10px;min-height:92px;font-size:9.5pt;display:flex;flex-direction:column}
.sig .sp{flex:1;min-height:30px}
.sig b{display:block;margin-bottom:4px}
.sigimg{display:block;max-height:50px;max-width:100%;margin:4px 0 0}
.line.has{margin-top:0}
.sigs.one{grid-template-columns:1fr 1fr}
.line{margin-top:0;border-top:1px dotted #777;padding-top:3px;font-size:8.5pt;color:#555}
footer{margin-top:12px;font-size:8pt;color:#666;display:flex;justify-content:space-between}.tl{display:inline-flex;align-items:center;gap:5px}
tr{page-break-inside:avoid}
</style></head><body>
<div class="bar"><button onclick="window.print()">${esc(ts("print"))}</button></div>
<header><div><h1>${esc(ts("title"))}</h1>${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="${esc(org)}">` : ""}<div class="org">${esc([org, settings.serviceName].filter(Boolean).join(" · "))}</div></div>
<div class="no"><div><b>${esc(l.slipNo)}</b><div>${esc(ts("issued",{d:fmt((l.createdAt||"").slice(0,10)||l.loanDate)}))}</div></div>
${loanQr ? `<div>${loanQr}<div class="scan">${esc(ts("scanLoan"))}</div></div>` : ""}</div></header>
<h2>${esc(ts("hItems"))}</h2>
<table class="items"><thead><tr><th class="c">${esc(ts("colNo"))}</th><th>${esc(ts("item"))}</th><th>${esc(ts("serial"))}</th><th>${esc(ts("tag"))}</th><th>${esc(ts("acc"))}</th><th>${esc(ts("condOut"))}</th></tr></thead><tbody>${items}</tbody></table>
<div class="cols">
<div><h2>${esc(ts("hBorrower"))}</h2>
<table class="kv">${row(ts("name"),esc(l.borrower))}${row(ts("dept"),esc(l.department))}${row(ts("site"),esc(l.site))}${row(ts("contact"),esc(l.contact))}${row(ts("purpose"),esc(l.purpose))}</table></div>
<div><h2>${esc(ts("hDates"))}</h2>
<table class="kv">${row(ts("loanDate"),fmt(l.loanDate))}${row(ts("dueDate"),`<b>${fmt(l.dueDate)}</b>`)}${l.originalDue?row(ts("originalDue"),fmt(l.originalDue)):""}${exts.length?row(ts("extensions"),exts.map(ev=>`${fmt(ev.from)} → ${fmt(ev.to)}${ev.reason?` (${esc(ev.reason)})`:""}`).join("<br>")):""}${l.notes?row(ts("notes"),esc(l.notes)):""}</table></div>
</div>
<div class="terms"><b>${esc(ts("terms"))}</b><ul>${terms.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
<div class="sigs">
<div class="sig"><b>${esc(ts("borrowerSig"))}</b>${esc(ts("approved"))}${sigs.out ? `<img class="sigimg" src="${sigs.out}" alt="">` : ""}<i class="sp"></i><div class="line${sigs.out ? " has" : ""}">${esc(ts("sign"))}</div></div>
<div class="sig"><b>${esc(ts("itSig"))}</b>${esc(ts("handedBy"))} ${esc(l.issuedBy||"")}<i class="sp"></i><div class="line">${esc(ts("sign"))}</div></div>
</div>
<h2>${esc(ts("hReturn"))}</h2>
<table class="items"><thead><tr><th class="c">${esc(ts("colNo"))}</th><th>${esc(ts("item"))}</th><th>${esc(ts("retDate"))}</th><th>${esc(ts("retCond"))}</th><th style="width:22%">${esc(ts("visa"))}</th></tr></thead><tbody>${ret}</tbody></table>
${sigs.in ? `<div class="sigs one"><div class="sig"><b>${esc(ts("sigReturn"))}</b><img class="sigimg" src="${sigs.in}" alt=""><i class="sp"></i><div class="line has">${esc(ts("sign"))}</div></div></div>` : ""}
<footer><span>${esc(l.slipNo)}</span><span class="tl"><img src="data:image/png;base64,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" alt="" width="14" height="14">Tally · ${esc(ts("copies"))}</span></footer>
</body></html>`;
  }
  let slipSigs = {};
  async function showSlip(l){
    slipLoan = l; slipSigs = {};
    if (l.hasSigOut || l.hasSigIn){ try{ slipSigs = await api("GET", `/api/loans/${l.id}/signatures`); }catch(_){} }
    $("slipFrame").srcdoc = slipHTML(l, slipSigs); $("slipModal").hidden = false;
  }
  function download(name, text, type){
    const url = URL.createObjectURL(new Blob([text], {type}));
    const a = Object.assign(document.createElement("a"), {href:url, download:name});
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("printSlip").addEventListener("click", () => { try{ const w = $("slipFrame").contentWindow; w.focus(); w.print(); } catch(_){ toast(t("printErr")); } });
  $("dlSlip").addEventListener("click", () => { if (slipLoan) download(`slip-${slipLoan.slipNo}.html`, slipHTML(slipLoan, slipSigs), "text/html"); });
  $("closeSlip").addEventListener("click", () => { $("slipModal").hidden = true; slipLoan = null; });

  // ---------- CSV (une ligne par objet) ----------
  function exportCsv(){
    const q = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const lines = [t("csv").map(q).join(";")];
    for (const l of loans) for (const i of l.items){
      lines.push([l.slipNo, i.item, i.category, i.serial, i.assetTag, i.accessories, condLabel(i.conditionOut), l.borrower, l.department, l.site, l.contact, l.purpose, l.issuedBy, fd(l.loanDate), fd(l.dueDate), l.extensionCount || "", fd(i.returnDate), condLabel(i.conditionIn), i.returnNotes, l.notes].map(q).join(";"));
    }
    download(`tally-${isoToday()}.csv`, "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8");
  }
  $("exportBtn").addEventListener("click", exportCsv);
  $("exportBtn2").addEventListener("click", exportCsv);


  // ---------- Integrations (collapsible) ----------
  function setIntCollapsed(c){
    $("intCard").classList.toggle("is-collapsed", c);
    const b = $("intToggle"); b.setAttribute("aria-expanded", String(!c));
    const k = c ? "intShow" : "intHide"; b.dataset.i18nTitle = k; b.title = t(k); b.setAttribute("aria-label", t(k));
    store.set("tally.intHidden", c ? "1" : "");
  }
  $("intToggle").addEventListener("click", () => setIntCollapsed(!$("intCard").classList.contains("is-collapsed")));
  if (store.get("tally.intHidden") === "1") setIntCollapsed(true);

  // ---------- CSV import (inventory) ----------
  const normHead = h => String(h).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const IMPORT_COLS = {
    name: ["designation","name","item","equipment","materiel","nom","device"],
    category: ["categorie","category","type"],
    serial: ["nserie","ndeserie","nodeserie","numserie","numerodeserie","serial","serialnumber","sn","serie"],
    assetTag: ["ninventaire","ndinventaire","nodinventaire","numerodinventaire","assettag","asset","inventorynumber","tag","inventaire"],
    site: ["site","location","lieu"],
    notes: ["remarques","notes","remarks","comments","note","commentaires"]
  };
  function parseCsv(text){
    text = text.replace(/^\uFEFF/, "");
    const first = text.split(/\r?\n/, 1)[0] || "";
    const delim = [";","\t",","].map(d => [d, first.split(d).length]).sort((a,b) => b[1]-a[1])[0][0];
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++){
      const c = text[i];
      if (q){
        if (c === '"'){ if (text[i+1] === '"'){ cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim){ row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r"){ if (c === "\r" && text[i+1] === "\n") i++; row.push(cur); cur = ""; rows.push(row); row = []; }
      else cur += c;
    }
    if (cur !== "" || row.length){ row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ""));
  }
  let importRows = [];
  function closeImport(){ importRows = []; $("importBox").hidden = true; $("importFile").value = ""; }
  async function readImportFile(file){
    const buf = await file.arrayBuffer();
    let text; try{ text = new TextDecoder("utf-8", {fatal:true}).decode(buf); }catch(_){ text = new TextDecoder("windows-1252").decode(buf); }
    const data = parseCsv(text);
    if (!data.length){ toast(t("importEmpty")); return closeImport(); }
    const heads = data[0].map(normHead), idx = {};
    for (const [k, names] of Object.entries(IMPORT_COLS)){ const i = heads.findIndex(h => names.includes(h)); if (i >= 0) idx[k] = i; }
    if (idx.name === undefined || idx.serial === undefined){ toast(t("importNoCols")); return closeImport(); }
    const have = new Set(equipment.map(e => (e.serial||"").toLowerCase())), seen = new Set();
    importRows = data.slice(1).map(r => {
      const o = {}; for (const k of Object.keys(IMPORT_COLS)) o[k] = idx[k] === undefined ? "" : (r[idx[k]] || "").trim();
      const key = o.serial.toLowerCase();
      o._st = (!o.name || !o.serial) ? "bad" : (have.has(key) || seen.has(key)) ? "dup" : "new";
      if (o._st === "new") seen.add(key);
      return o;
    });
    const n = st => importRows.filter(r => r._st === st).length;
    $("importName").textContent = file.name;
    $("importSummary").textContent = t("importRows",{n:importRows.length}) + " — " + t("importSummary",{ok:n("new"),dup:n("dup"),bad:n("bad")});
    const cols = Object.keys(IMPORT_COLS).filter(k => idx[k] !== undefined);
    $("importHead").innerHTML = `<tr>${cols.map(k => `<th>${esc(data[0][idx[k]])}</th>`).join("")}<th>${esc(t("importStatus"))}</th></tr>`;
    $("importBody").innerHTML = importRows.slice(0,100).map(r => `<tr class="${r._st}">${cols.map(k => `<td>${esc(r[k])}</td>`).join("")}<td>${esc(t(r._st==="new"?"importNew":r._st==="dup"?"importDup":"importBad"))}</td></tr>`).join("");
    $("importGo").disabled = !n("new");
    $("importBox").hidden = false;
  }
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", e => { const f = e.target.files[0]; if (f) readImportFile(f).catch(() => toast(t("importEmpty"))); });
  $("importCancel").addEventListener("click", closeImport);
  $("importGo").addEventListener("click", async () => {
    const rows = importRows.filter(r => r._st === "new").map(({_st, ...r}) => r);
    $("importGo").disabled = true;
    try{
      const r = await api("POST", "/api/equipment/import", {rows});
      closeImport(); await load(); toast(t("importDone",{added:r.added,dup:r.duplicates,bad:r.invalid}));
    }catch(e){ $("importGo").disabled = false; toast(e.message); }
  });
  $("importTpl").addEventListener("click", () => {
    const h = lang === "fr" ? ["Désignation","Catégorie","N° de série","N° d'inventaire","Site","Remarques"] : ["Name","Category","Serial number","Asset tag","Site","Notes"];
    const ex = lang === "fr" ? ["Ordinateur portable","Informatique","SN-0001","INV-001","Athènes",""] : ["Laptop","IT","SN-0001","INV-001","Athens",""];
    download("tally-inventory-template.csv", "\uFEFF" + [h, ex].map(r => r.join(";")).join("\r\n"), "text/csv;charset=utf-8");
  });
  // ---------- statistiques (comptées par objet) ----------
  function periodRange(){
    const cur = monthKey(isoToday()), y = Number(cur.slice(0,4));
    const p = $("st_period").value;
    if (p === "year") return [`${y}-01`, cur];
    if (p === "prevyear") return [`${y-1}-01`, `${y-1}-12`];
    if (p === "all"){
      const first = loans.reduce((m,l) => (!m || l.loanDate < m) ? l.loanDate : m, "");
      const start = first ? monthKey(first) : shiftMonth(cur,-11);
      return [start < shiftMonth(cur,-11) ? start : shiftMonth(cur,-11), cur];
    }
    return [shiftMonth(cur,-11), cur];
  }
  function renderStats(){
    const [start, end] = periodRange();
    const site = $("st_site").value;
    const rows = [];
    for (const l of loans){
      const m = monthKey(l.loanDate);
      if (m < start || m > end || (site && l.site !== site)) continue;
      for (const i of l.items) rows.push({ l, i });
    }
    $("kTotal").textContent = rows.length;
    const returned = rows.filter(r => r.i.returnDate);
    if (returned.length){
      const avg = returned.reduce((s,r) => s + Math.max(0, daysBetween(r.l.loanDate, r.i.returnDate)), 0) / returned.length;
      $("kAvg").textContent = avg.toLocaleString(locale(), {maximumFractionDigits:1});
      $("kOnTime").textContent = Math.round(returned.filter(r => r.i.returnDate <= r.l.dueDate).length / returned.length * 100) + " %";
    } else { $("kAvg").textContent = "—"; $("kOnTime").textContent = "—"; }
    $("kBorrowers").textContent = new Set(rows.map(r => r.l.borrower.trim().toLowerCase())).size;

    const months = []; for (let m = start; m <= end; m = shiftMonth(m,1)) months.push(m);
    const counts = Object.fromEntries(months.map(m => [m,0]));
    rows.forEach(r => { counts[monthKey(r.l.loanDate)]++; });
    drawMonths(months.map(m => ({key:m, n:counts[m]})), monthKey(isoToday()));
    drawBars($("itemChart"), groupCount(rows, r => r.i[itemMode]));
    drawBars($("userChart"), groupCount(rows, r => r.l[userMode], userMode === "borrower" ? r => r.l.department : null));
  }
  function groupCount(rows, keyFn, subFn){
    const map = new Map();
    for (const r of rows){
      const raw = (keyFn(r) || "").trim() || "—", k = raw.toLowerCase();
      const e = map.get(k) || {label:raw, n:0, sub:new Set()};
      e.n++; if (subFn){ const s = subFn(r); if (s) e.sub.add(s); }
      map.set(k, e);
    }
    return [...map.values()].sort((a,b) => b.n-a.n || a.label.localeCompare(b.label,"fr"));
  }
  function niceMax(v){
    if (v <= 4) return Math.max(4, v);
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v/p;
    return (f<=1?1:f<=2?2:f<=5?5:10)*p;
  }
  function drawMonths(data, curKey){
    const el = $("monthChart");
    const W = Math.max(520, Math.round(el.clientWidth || 760)), H = 260, ml = 36, mr = 12, mt = 22, mb = 34;
    const iw = W-ml-mr, ih = H-mt-mb;
    const max = niceMax(Math.max(0, ...data.map(d => d.n)));
    const ticks = max <= 4 ? Array.from({length:max+1}, (_,i) => i) : [0,max/4,max/2,max*3/4,max];
    const step = iw/data.length, bw = Math.min(42, step*0.62);
    const y = v => mt + ih - (v/max)*ih;
    const labelEvery = data.length <= 13 ? 1 : data.length <= 26 ? 2 : 3;
    const showVals = data.length <= 13;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("chMonth"))}">`;
    for (const tk of ticks) svg += `<line class="gridline" x1="${ml}" x2="${W-mr}" y1="${y(tk)}" y2="${y(tk)}"/><text class="axis" x="${ml-8}" y="${y(tk)+4}" text-anchor="end">${Math.round(tk)}</text>`;
    data.forEach((d,i) => {
      const cx = ml + step*i + step/2, h = (d.n/max)*ih, top = mt+ih-h, r = Math.min(4, h/2, bw/2);
      const path = h > 0 ? `M${cx-bw/2},${mt+ih} V${top+r} Q${cx-bw/2},${top} ${cx-bw/2+r},${top} H${cx+bw/2-r} Q${cx+bw/2},${top} ${cx+bw/2},${top+r} V${mt+ih} Z` : "";
      const withYear = i === 0 || d.key.endsWith("-01");
      svg += `<g class="col" data-k="${d.key}" data-n="${d.n}"><rect class="hit" x="${ml+step*i}" y="${mt}" width="${step}" height="${ih}"/>`;
      if (path) svg += `<path class="bar${d.key===curKey?" cur":""}" d="${path}"/>`;
      if (showVals && d.n > 0) svg += `<text class="val" x="${cx}" y="${top-6}" text-anchor="middle">${d.n}</text>`;
      if (i % labelEvery === 0) svg += `<text class="axis" x="${cx}" y="${H-mb+18}" text-anchor="middle">${esc(monthLabel(d.key, withYear))}</text>`;
      svg += `</g>`;
    });
    el.innerHTML = svg + `<line x1="${ml}" x2="${W-mr}" y1="${mt+ih}" y2="${mt+ih}" stroke="var(--muted)" stroke-width="1"/></svg>`;
  }
  function drawBars(el, groups){
    if (!groups.length){ el.innerHTML = `<div class="hempty">${esc(t("noData"))}</div>`; return; }
    let list = groups.slice(0,10);
    if (groups.length > 10){ const rest = groups.slice(10); list.push({label:t("others",{n:rest.length}), n:rest.reduce((s,g)=>s+g.n,0), other:true, sub:new Set()}); }
    const max = Math.max(...list.map(g => g.n));
    el.innerHTML = list.map(g => `<div class="hrow" data-tip="${esc(g.label + (g.sub.size ? " · "+[...g.sub].join(", ") : ""))}" data-n="${g.n}">
      <span class="lbl"${g.other?' style="color:var(--muted)"':""}>${esc(g.label)}</span>
      <span class="track"><span class="fill" style="width:${(g.n/max*100).toFixed(1)}%"></span></span>
      <span class="n">${g.n}</span></div>`).join("");
  }
  const tip = $("tip");
  function showTip(e, html){ tip.innerHTML = html; tip.hidden = false; tip.style.left = Math.min(e.clientX+12, window.innerWidth-tip.offsetWidth-8)+"px"; tip.style.top = (e.clientY-36)+"px"; }
  $("monthChart").addEventListener("mousemove", e => {
    const g = e.target.closest("g.col"); if (!g){ tip.hidden = true; return; }
    const [yy,mm] = g.dataset.k.split("-").map(Number);
    showTip(e, `${esc(new Date(yy,mm-1,1).toLocaleDateString(locale(),{month:"long",year:"numeric"}))} · <b>${esc(t("tipItems",{n:g.dataset.n}))}</b>`);
  });
  $("monthChart").addEventListener("mouseleave", () => tip.hidden = true);
  for (const id of ["itemChart","userChart"]){
    $(id).addEventListener("mousemove", e => { const r = e.target.closest(".hrow"); if (!r){ tip.hidden = true; return; } showTip(e, `${esc(r.dataset.tip)} · <b>${esc(t("tipItems",{n:r.dataset.n}))}</b>`); });
    $(id).addEventListener("mouseleave", () => tip.hidden = true);
  }
  $("st_period").addEventListener("change", renderStats);
  $("st_site").addEventListener("change", renderStats);
  function bindSeg(id, set){
    $(id).addEventListener("click", e => {
      const b = e.target.closest("button[data-m]"); if (!b) return;
      $(id).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x===b?"true":"false"));
      set(b.dataset.m); renderStats();
    });
  }
  bindSeg("itemMode", m => itemMode = m);
  bindSeg("userMode", m => userMode = m);
  let rsT; window.addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(() => { if (view === "stats") renderStats(); }, 150); });

  // ---------- paramètres ----------
  const S_TEXT = ["orgName","serviceName","publicUrl","slipPrefix","terms","requestNote"];
  const S_NUM = ["defaultLoanDays","dueSoonDays","refreshSeconds"];
  const S_BOOL = ["requireIssuedBy","signatureOn","archiveEnabled","requestsEnabled"];
  const S_LIST = ["sites","departments","categories"];
  let pick = {sites:[], departments:[], categories:[]};
  function renderPicklists(){
    document.querySelectorAll(".picklist").forEach(box => {
      const k = box.dataset.list, ul = box.querySelector(".chiplist");
      ul.innerHTML = pick[k].length
        ? pick[k].map((v,i) => `<li><span>${esc(v)}</span><button type="button" data-i="${i}" aria-label="${esc(t("removeX",{v}))}" title="${esc(t("removeX",{v}))}">×</button></li>`).join("")
        : `<li class="none">${esc(t("listEmpty"))}</li>`;
    });
  }
  function markDirty(){ settingsDirty = true; $("settingsMsg").textContent = t("sUnsaved"); }
  document.querySelectorAll(".picklist").forEach(box => {
    const k = box.dataset.list, input = box.querySelector("input"), addBtn = box.querySelector(".addrow button");
    const add = () => {
      const v = input.value.trim().slice(0,120); if (!v) return;
      if (pick[k].some(x => x.toLowerCase() === v.toLowerCase())){ toast(t("dupValue",{v})); return; }
      pick[k].push(v); input.value = ""; renderPicklists(); markDirty(); input.focus();
    };
    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); add(); } });
    box.querySelector(".chiplist").addEventListener("click", e => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      pick[k].splice(Number(b.dataset.i), 1); renderPicklists(); markDirty();
    });
  });
  const themeRadio = () => { const r = document.querySelector('input[name="s_theme"]:checked'); return r ? r.value : "auto"; };
  function setThemeRadio(v){ document.querySelectorAll('input[name="s_theme"]').forEach(r => r.checked = r.value === v); }
  document.querySelectorAll('input[name="s_theme"]').forEach(r => r.addEventListener("change", () => applyTheme(r.value)));
  function fillSettingsForm(){
    if (!settings || settingsDirty) return;
    S_TEXT.forEach(k => $("s_"+k).value = settings[k] ?? "");
    S_NUM.forEach(k => $("s_"+k).value = settings[k]);
    S_LIST.forEach(k => pick[k] = [...(settings[k]||[])]);
    renderPicklists();
    $("s_defaultLang").value = settings.defaultLang;
    setThemeRadio(settings.theme || "auto");
    S_BOOL.forEach(k => $("s_"+k).checked = !!settings[k]);
    $("s_terms").placeholder = defaultTerms(lang, settings.orgName);
    $("s_dateFormat").value = settings.dateFormat || "DD/MM/YYYY";
    fillArchiveOptions(); $("s_archiveMonths").value = String(settings.archiveMonths || 12);
    $("settingsMsg").textContent = "";
  }
  $("settingsForm").addEventListener("input", e => { if (!e.target.closest(".addrow") && e.target.id !== "logoFile") markDirty(); });

  $("logoFile").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (f.size > 1024*1024){ toast(t("logoTooBig")); return; }
    try{
      const r = await fetch("/api/logo", {method:"PUT", headers:{"Content-Type": f.type || "application/octet-stream"}, body: f});
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      settings.logoUpdated = data.logoUpdated; await loadLogo(); toast(t("logoSaved"));
    }catch(ex){ toast(ex.message); }
  });
  $("logoRemove").addEventListener("click", async () => {
    try{ const s = await api("DELETE", "/api/logo"); settings.logoUpdated = s.logoUpdated; await loadLogo(); toast(t("logoRemoved")); }
    catch(ex){ toast(ex.message); }
  });
  $("settingsForm").addEventListener("submit", async e => {
    e.preventDefault();
    const body = {};
    S_TEXT.forEach(k => body[k] = $("s_"+k).value);
    S_NUM.forEach(k => body[k] = Number($("s_"+k).value));
    S_LIST.forEach(k => body[k] = pick[k]);
    body.defaultLang = $("s_defaultLang").value;
    body.dateFormat = $("s_dateFormat").value;
    body.archiveMonths = Number($("s_archiveMonths").value) || 12;
    body.theme = themeRadio();
    S_BOOL.forEach(k => body[k] = $("s_"+k).checked);
    $("saveSettings").disabled = true;
    try{
      settings = await api("PUT", "/api/settings", body);
      applyTheme(settings.theme);
      lang = settings.defaultLang === "fr" ? "fr" : "en";
      settingsDirty = false; applyI18n(); if (!$("clModal").hidden) renderChangelog(); fillDateFormatOptions(); fillSettingsForm(); syncDateFields(); renderAll(); renderPicklists(); renderLogoSetting();
      if (!$("sheet").hidden) renderItemRows();
      $("settingsMsg").textContent = t("sSaved"); toast(t("sSaved"));
      applyI18n(); refreshLists(); startRefresh(); refreshArchiveCount(); load();
    }catch(ex){ $("settingsMsg").textContent = ex.status === 404 ? t("outdated",{page:APP_VERSION, server:"?"}) : (ex.message || t("sSaveErr")); }
    finally{ $("saveSettings").disabled = false; }
  });

  // ---------- calendrier ----------
  const resById = id => reservations.find(r => String(r.id) === String(id));
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDay = iso => { const [y,m,d] = iso.split("-").map(Number); return new Date(y, m-1, d); };
  function calEvents(rangeStart, rangeEnd){
    const today = isoToday(), ev = [];
    if (calLayers.loans) for (const l of loans){
      const done = !!l.returnDate;
      const late = !done && l.dueDate < today;
      const end = done ? l.returnDate : (late ? today : l.dueDate);
      const names = l.items.map(i => i.item);
      ev.push({ kind:"loan", id:l.id, start:l.loanDate, end: end < l.loanDate ? l.loanDate : end, cls: done ? "done" : late ? "late" : "loan",
        label: `${l.borrower} · ${names[0] || ""}${names.length > 1 ? " +" + (names.length-1) : ""}`, title: `${l.slipNo} · ${l.borrower} · ${names.join(", ")} · ${fmt(l.loanDate)} → ${fmt(l.dueDate)}` });
    }
    if (calLayers.res) for (const r of reservations){
      if (r.status !== "active") continue;
      const names = r.items.map(i => i.item);
      ev.push({ kind:"res", id:r.id, start:r.startDate, end:r.endDate, cls: r.endDate < today ? "res expired" : "res",
        label: `${r.borrower} · ${names[0] || ""}${names.length > 1 ? " +" + (names.length-1) : ""}`, title: `${r.resNo} · ${r.borrower} · ${names.join(", ")} · ${fmt(r.startDate)} → ${fmt(r.endDate)}` });
    }
    return ev.filter(e => e.start <= rangeEnd && e.end >= rangeStart).sort((a,b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  }
  function renderCalendar(){
    if (!calMonth) calMonth = isoToday().slice(0,7);
    const [y, m] = calMonth.split("-").map(Number);
    const first = new Date(y, m-1, 1), last = new Date(y, m, 0);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const end = new Date(last); end.setDate(last.getDate() + (6 - (last.getDay() + 6) % 7));
    $("calTitle").textContent = first.toLocaleDateString(locale(), {month:"long", year:"numeric"});
    const events = calEvents(dayKey(start), dayKey(end));
    const today = isoToday();
    const wd = Array.from({length:7}, (_,i) => new Date(2024, 0, 1+i).toLocaleDateString(locale(), {weekday:"short"}).replace(".",""));
    let html = `<div class="calhead">${wd.map(w => `<div>${esc(w)}</div>`).join("")}</div>`;
    for (let ws = new Date(start); ws <= end; ws.setDate(ws.getDate()+7)){
      const days = Array.from({length:7}, (_,i) => { const d = new Date(ws); d.setDate(ws.getDate()+i); return d; });
      const wsKey = dayKey(days[0]), weKey = dayKey(days[6]);
      const lanes = [], segs = [];
      for (const e of events){
        if (e.start > weKey || e.end < wsKey) continue;
        const s0 = e.start < wsKey ? wsKey : e.start, s1 = e.end > weKey ? weKey : e.end;
        const c0 = daysBetween(wsKey, s0), c1 = daysBetween(wsKey, s1);
        let lane = lanes.findIndex(lastCol => lastCol < c0);
        if (lane < 0){ lane = lanes.length; lanes.push(-1); }
        lanes[lane] = c1;
        segs.push({e, c0, c1, lane, contL: e.start < wsKey, contR: e.end > weKey});
      }
      const nLanes = lanes.length;
      html += `<div class="calweek" style="grid-template-rows:28px repeat(${nLanes}, 24px) minmax(14px,1fr)">`;
      days.forEach((d, i) => {
        const k = dayKey(d);
        const cls = [d.getMonth() !== m-1 ? "out" : "", k === today ? "today" : "", k < today ? "past" : ""].join(" ");
        html += `<button type="button" class="calday ${cls}" style="grid-column:${i+1};grid-row:1 / -1" data-day="${k}" aria-label="${esc(d.toLocaleDateString(locale(),{dateStyle:"full"}))}"><span>${d.getDate()}</span></button>`;
      });
      for (const g of segs){
        html += `<button type="button" class="calbar ${g.e.cls}${g.contL?" contL":""}${g.contR?" contR":""}" style="grid-column:${g.c0+1} / ${g.c1+2};grid-row:${g.lane+2}" data-kind="${g.e.kind}" data-id="${g.e.id}" title="${esc(g.e.title)}">${esc(g.e.label)}</button>`;
      }
      html += `</div>`;
    }
    $("cal").innerHTML = html;
  }
  $("calPrev").addEventListener("click", () => { const [y,m] = calMonth.split("-").map(Number); const d = new Date(y, m-2, 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth()+1)}`; renderCalendar(); });
  $("calNext").addEventListener("click", () => { const [y,m] = calMonth.split("-").map(Number); const d = new Date(y, m, 1); calMonth = `${d.getFullYear()}-${pad(d.getMonth()+1)}`; renderCalendar(); });
  $("calToday").addEventListener("click", () => { calMonth = isoToday().slice(0,7); renderCalendar(); });
  $("calLayers").addEventListener("click", e => {
    const b = e.target.closest("[data-layer]"); if (!b) return;
    calLayers[b.dataset.layer] = !calLayers[b.dataset.layer];
    b.setAttribute("aria-pressed", calLayers[b.dataset.layer] ? "true" : "false"); renderCalendar();
  });
  $("cal").addEventListener("click", e => {
    const bar = e.target.closest(".calbar");
    if (bar){
      if (bar.dataset.kind === "loan"){ const l = loanById(bar.dataset.id); if (l) focusLoan(l.slipNo); }
      else { const r = resById(bar.dataset.id); if (r) openReservation(r); }
      return;
    }
    const day = e.target.closest("[data-day]"); if (!day) return;
    if (day.dataset.day < isoToday()) return;
    openReservation(null, day.dataset.day);
  });

  // ---------- réservations ----------
  function resState(r){
    const today = isoToday();
    if (r.status === "converted"){ const l = loanById(r.loanId); return {key:"back", label:t("rsConverted",{no: l ? l.slipNo : ""})}; }
    if (r.status === "cancelled") return {key:"neutral", label:t("rsCancelled")};
    if (r.endDate < today) return {key:"late", label:t("rsExpired")};
    if (r.startDate <= today) return {key:"soon", label:t("rsOngoing")};
    return {key:"res", label:t("rsUpcoming")};
  }
  function renderResList(){
    const today = isoToday();
    const list = reservations.filter(r => resFilter === "all" || (r.status === "active" && r.endDate >= today))
      .sort((a,b) => resFilter === "all" ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate));
    $("resRows").innerHTML = list.map(r => {
      const st = resState(r), active = r.status === "active";
      return `<tr>
        <td><span class="tag res">${esc(r.resNo)}</span></td>
        <td>${r.items.map(i => `<div>${esc(i.item)} <button type="button" class="link serial" data-hist-serial="${esc(i.serial)}">${esc(i.serial)}</button></div>`).join("")}</td>
        <td><button type="button" class="link" data-hist-borrower="${esc(r.borrower)}">${esc(r.borrower)}</button><div class="sub">${esc(r.department)}</div></td>
        <td class="mono">${fmt(r.startDate)} → ${fmt(r.endDate)}</td>
        <td><span class="pill ${st.key}">${esc(st.label)}</span></td>
        <td><div class="rowacts">${active ? `
          <button class="btn small primary" type="button" data-res-act="convert" data-id="${r.id}">${esc(t("actConvert"))}</button>
          <button class="btn small" type="button" data-res-act="edit" data-id="${r.id}">${esc(t("actEdit"))}</button>
          <button class="btn small" type="button" data-res-act="cancel" data-id="${r.id}">${esc(t("actCancelRes"))}</button>` : `
          <button class="btn small" type="button" data-res-act="delete" data-id="${r.id}">${esc(t("delete"))}</button>`}
        </div></td></tr>`;
    }).join("");
    $("resEmpty").hidden = list.length > 0;
    $("resEmptyText").textContent = resFilter === "all" ? t("resEmptyAll") : t("resEmpty");
  }
  $("resChips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    resFilter = c.dataset.r; $("resChips").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x===c?"true":"false")); renderResList();
  });
  $("resRows").addEventListener("click", e => {
    const hs = e.target.closest("[data-hist-serial]"); if (hs){ openItemHistory({serial: hs.dataset.histSerial}); return; }
    const hb = e.target.closest("[data-hist-borrower]"); if (hb){ openBorrowerHistory(hb.dataset.histBorrower); return; }
    const b = e.target.closest("[data-res-act]"); if (!b) return;
    const r = resById(b.dataset.id); if (!r) return;
    if (b.dataset.resAct === "convert") openForm(null, null, r);
    if (b.dataset.resAct === "edit") openReservation(r);
    if (b.dataset.resAct === "cancel") confirmBox({ title: t("cancelResTitle"), text: t("cancelResText",{no:r.resNo, who:r.borrower}), yes: t("cancelResYes"), danger: true, onYes: async () => {
      try{ await api("POST", `/api/reservations/${r.id}/cancel`); toast(t("tResCancelled")); await load(); } catch(ex){ toast(ex.message); }
    }});
    if (b.dataset.resAct === "delete") confirmBox({ title: t("delResTitle"), text: t("delResText",{no:r.resNo, who:r.borrower}), yes: t("delete"), danger: true, onYes: async () => {
      try{ const d = await api("DELETE", `/api/reservations/${r.id}`); toast(t("tResDeleted"), d && d.undo); await load(); } catch(ex){ toast(ex.message); }
    }});
  });
  $("newResBtn").addEventListener("click", () => openReservation(null));


  // ---------- borrowing requests (sent from /request) ----------
  const reqUrl = () => ((settings && settings.publicUrl) || location.origin) + "/request";
  const reqName = r => `${r.firstName} ${r.lastName}`.trim();
  const reqWhat = r => r.lines.map(l => `${l.qty} × ${l.category || t("reqOther")}`);
  function reqState(r){
    if (r.status === "pending") return {key:"soon", label:t("rqPending")};
    if (r.status === "declined") return {key:"late", label:t("rqDeclined")};
    if (r.status === "cancelled") return {key:"neutral", label:t("rqCancelled")};
    const res = reservations.find(x => x.id === r.reservationId);
    return {key:"back", label: res ? t("rqApprovedNo", {no: res.resNo}) : t("rqApproved")};
  }
  function reqBadge(){
    const n = requests.filter(r => r.status === "pending").length;
    $("reqBadge").hidden = !n; $("reqBadge").textContent = n > 9 ? "9+" : n;
    $("reqBadge").setAttribute("aria-label", t("reqBadge", {n}));
    $("reqCount").textContent = n ? n : "";
  }
  function renderReqList(){
    const list = requests.filter(r => reqFilter === "all" || r.status === "pending");
    $("reqRows").innerHTML = list.map(r => {
      const st = reqState(r), pend = r.status === "pending";
      return `<tr${pend ? ' class="req-new"' : ""}>
        <td><span class="tag">${esc(r.reqNo)}</span><div class="sub">${esc(fmt(r.createdAt))}</div></td>
        <td><button type="button" class="link" data-hist-borrower="${esc(reqName(r))}">${esc(reqName(r))}</button><div class="sub"><a href="mailto:${esc(r.email)}">${esc(r.email)}</a>${r.department ? " · " + esc(r.department) : ""}</div></td>
        <td>${reqWhat(r).map(x => `<div>${esc(x)}</div>`).join("")}${r.other ? `<div class="sub">${esc(r.other)}</div>` : ""}${r.reason ? `<div class="sub req-why">“${esc(r.reason)}”</div>` : ""}</td>
        <td class="mono">${fmt(r.startDate)} → ${fmt(r.endDate)}${r.site ? `<div class="sub">${esc(r.site)}</div>` : ""}</td>
        <td><span class="pill ${st.key}">${esc(st.label)}</span>${r.decisionNote ? `<div class="sub">${esc(r.decisionNote)}</div>` : ""}</td>
        <td><div class="rowacts">${pend ? `
          <button class="btn small primary" type="button" data-req-act="approve" data-id="${r.id}">${esc(t("reqApprove"))}</button>
          <button class="btn small" type="button" data-req-act="decline" data-id="${r.id}">${esc(t("reqDecline"))}</button>` : `
          <button class="btn small" type="button" data-req-act="delete" data-id="${r.id}">${esc(t("delete"))}</button>`}
        </div></td></tr>`;
    }).join("");
    $("reqEmpty").hidden = list.length > 0;
    $("reqEmptyText").textContent = reqFilter === "all" ? t("reqEmptyAll") : t("reqEmpty");
  }
  $("reqChips").addEventListener("click", e => {
    const c = e.target.closest(".chip"); if (!c) return;
    reqFilter = c.dataset.q; $("reqChips").querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x===c?"true":"false")); renderReqList();
  });
  async function copyText(txt){
    try{ if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(txt); return true; } }catch(_){}
    const ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
    let ok = false; try{ ok = document.execCommand("copy"); }catch(_){} ta.remove(); return ok;
  }
  const copyReqLink = async () => { const ok = await copyText(reqUrl()); toast(ok ? t("reqLinkCopied", {url: reqUrl()}) : reqUrl()); };
  $("reqLinkBtn").addEventListener("click", copyReqLink);
  $("reqCopy").addEventListener("click", copyReqLink);
  $("reqRows").addEventListener("click", e => {
    const hb = e.target.closest("[data-hist-borrower]"); if (hb){ openBorrowerHistory(hb.dataset.histBorrower); return; }
    const b = e.target.closest("[data-req-act]"); if (!b) return;
    const r = requests.find(x => String(x.id) === b.dataset.id); if (!r) return;
    if (b.dataset.reqAct === "approve") approveRequest(r);
    if (b.dataset.reqAct === "decline") confirmBox({ title: t("reqDeclineTitle", {no: r.reqNo}), text: t("reqDeclineText", {who: reqName(r)}), yes: t("reqDecline"), danger: true,
      input: t("reqDeclineWhy"), onYes: async note => {
        try{ await api("POST", `/api/requests/${r.id}/decline`, {note}); toast(t("reqDeclined", {no: r.reqNo})); await load(); } catch(ex){ toast(ex.message); }
      }});
    if (b.dataset.reqAct === "delete") confirmBox({ title: t("reqDelTitle", {no: r.reqNo}), text: t("reqDelText"), yes: t("delete"), danger: true, onYes: async () => {
      try{ await api("DELETE", `/api/requests/${r.id}`); await load(); } catch(ex){ toast(ex.message); }
    }});
  });
  // Approving opens the reservation form, filled in from the request, with free matching items already picked
  async function approveRequest(r){
    openReservation(null, r.startDate);
    resFromRequest = r.id;
    $("v_borrower").value = reqName(r); $("v_contact").value = r.email; $("v_purpose").value = r.reason || "";
    $("v_startDate").value = r.startDate; $("v_endDate").value = r.endDate;
    if (r.department) $("v_department").innerHTML = listOptions(settings.departments, r.department);
    if (r.site) $("v_site").innerHTML = listOptions(settings.sites, r.site);
    $("v_notes").value = [t("reqNoteLine", {no: r.reqNo}), ...reqWhat(r), r.other].filter(Boolean).join("\n");
    const ban = $("resFromReq");
    ban.innerHTML = `<strong>${esc(t("reqFrom", {no: r.reqNo, who: reqName(r)}))}</strong><span>${esc([...reqWhat(r), r.other].filter(Boolean).join(" · "))}</span>`;
    ban.hidden = false;
    $("resTitle").textContent = t("reqApproveTitle", {no: r.reqNo});
    $("resSave").textContent = t("reqApproveSave");
    try{
      const sug = await api("GET", `/api/requests/${r.id}/suggest`);
      if (resFromRequest === r.id && !resItems.length){ resItems = sug; renderResItems(); }
    }catch(_){}
  }

  const resPickLabel = e => `${e.name} — ${e.serial}${e.site ? " · " + e.site : ""}`;
  function refreshResPicker(){
    $("resList").innerHTML = equipment.filter(e => !resItems.some(i => String(i.equipmentId) === String(e.id))).map(e => `<option value="${esc(resPickLabel(e))}">`).join("");
  }
  function renderResItems(){
    $("resItems").innerHTML = resItems.length
      ? resItems.map((i, n) => `<li><span>${esc(i.item)} <span class="serial">${esc(i.serial)}</span></span><button type="button" data-i="${n}" aria-label="${esc(t("removeItem"))}">×</button></li>`).join("")
      : `<li class="none">${esc(t("errResItems"))}</li>`;
    refreshResPicker();
  }
  $("resPick").addEventListener("input", e => {
    const v = e.target.value.trim(); if (!v) return;
    const lower = v.toLowerCase();
    const eq = equipment.find(x => resPickLabel(x) === v) || equipment.find(x => x.serial.toLowerCase() === lower);
    if (eq && !resItems.some(i => String(i.equipmentId) === String(eq.id))){ resItems.push({equipmentId: eq.id, item: eq.name, serial: eq.serial}); e.target.value = ""; renderResItems(); }
  });
  $("resPick").addEventListener("keydown", e => { if (e.key === "Enter") e.preventDefault(); });
  $("resItems").addEventListener("click", e => { const b = e.target.closest("button[data-i]"); if (!b) return; resItems.splice(Number(b.dataset.i), 1); renderResItems(); });

  function openReservation(r, startDay){
    resEditingId = r ? r.id : null;
    $("resTitle").textContent = r ? t("resEdit",{no:r.resNo}) : t("resNew");
    $("resSave").textContent = r ? t("resSaveEdit") : t("resSaveNew");
    $("resErr").hidden = true; $("resForm").reset();
    resFromRequest = null; $("resFromReq").hidden = true;
    $("v_department").innerHTML = listOptions(settings.departments, r && r.department);
    $("v_site").innerHTML = listOptions(settings.sites, r && r.site);
    if (r){
      for (const k of ["borrower","contact","purpose","bookedBy","notes","startDate","endDate"]) $("v_"+k).value = r[k] || "";
      resItems = r.items.map(i => ({equipmentId: i.equipmentId, item: i.item, serial: i.serial}));
    } else {
      const s0 = startDay || isoToday();
      $("v_startDate").value = s0; $("v_endDate").value = addDays(s0, 1);
      $("v_bookedBy").value = store.get("issuedBy");
      resItems = [];
    }
    renderResItems();
    $("resSheet").hidden = false; setTimeout(() => $("resPick").focus(), 50);
  }
  const closeRes = () => { $("resSheet").hidden = true; resEditingId = null; resFromRequest = null; };
  $("closeRes").addEventListener("click", closeRes); $("cancelRes").addEventListener("click", closeRes);
  $("v_startDate").addEventListener("change", () => { if ($("v_endDate").value < $("v_startDate").value) $("v_endDate").value = $("v_startDate").value; });
  $("resForm").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("resErr"), fail = m => { err.textContent = m; err.hidden = false; };
    const body = {}; for (const k of ["borrower","department","site","contact","purpose","bookedBy","notes","startDate","endDate"]) body[k] = $("v_"+k).value.trim();
    if (!resItems.length) return fail(t("errResItems"));
    if (!body.borrower || (settings.departments.length && !body.department) || !body.startDate || !body.endDate) return fail(t("errResRequired"));
    if (body.endDate < body.startDate) return fail(t("errResDates"));
    body.items = resItems.map(i => ({equipmentId: i.equipmentId}));
    const fromReq = !resEditingId && resFromRequest;
    if (fromReq) body.requestId = resFromRequest;
    $("resSave").disabled = true;
    try{
      if (body.bookedBy) store.set("issuedBy", body.bookedBy);
      const saved = resEditingId ? await api("PUT", `/api/reservations/${resEditingId}`, body) : await api("POST", "/api/reservations", body);
      closeRes(); toast(fromReq ? t("reqApprovedToast",{no:saved.resNo}) : t("tResSaved",{no:saved.resNo})); await load();
    }catch(ex){ fail(ex.message); }
    finally{ $("resSave").disabled = false; }
  });

  // ---------- notifications ----------
  const ALERT_DAYS = 2;
  function alerts(){
    const today = isoToday(), soon = [], late = [], res = [];
    for (const l of loans){
      if (l.returnDate) continue;
      const d = daysBetween(today, l.dueDate);
      if (d < 0) late.push({l, d}); else if (d <= ALERT_DAYS) soon.push({l, d});
    }
    for (const r of reservations){
      if (r.status !== "active" || r.endDate < today) continue;
      const d = daysBetween(today, r.startDate);
      if (d <= ALERT_DAYS) res.push({r, d});
    }
    const notes = notesData.filter(n => !n.done && n.remindOn && n.remindOn <= today).map(n => ({n, d: daysBetween(today, n.remindOn)}));
    const reqs = requests.filter(q => q.status === "pending").map(q => ({q, d: daysBetween(today, q.startDate)}));
    soon.sort((a,b) => a.d-b.d); late.sort((a,b) => a.d-b.d); res.sort((a,b) => a.d-b.d); notes.sort((a,b) => a.d-b.d); reqs.sort((a,b) => a.d-b.d);
    return {soon, late, res, notes, reqs};
  }
  const alertKey = x => x.q ? `q${x.q.id}` : x.n ? `n${x.n.id}:${x.n.remindOn}` : x.r ? `r${x.r.id}:${x.r.startDate}:${x.d<0?"open":"soon"}` : `${x.l.id}:${x.l.dueDate}:${x.d<0?"late":"soon"}`;
  const seen = () => { try{ return new Set(JSON.parse(store.get("seenAlerts")||"[]")); }catch(_){ return new Set(); } };
  function renderBell(){
    const {soon, late, res, notes, reqs} = alerts(), all = [...reqs, ...soon, ...late, ...res, ...notes], s = seen();
    const unseen = all.filter(x => !s.has(alertKey(x))).length;
    $("bellBadge").hidden = unseen === 0; $("bellBadge").textContent = unseen > 9 ? "9+" : unseen;
    const item = x => {
      const when = x.d < 0 ? t("whenLate",{n:-x.d}) : x.d === 0 ? t("whenToday") : x.d === 1 ? t("whenTomorrow") : t("whenIn",{n:x.d});
      const names = x.l.items.filter(i => !i.returnDate).map(i => i.item);
      const label = names.length > 1 ? `${names[0]} ${t("moreItems",{n:names.length-1})}` : names[0] || "";
      return `<button type="button" class="notif-item" data-slip="${esc(x.l.slipNo)}">
        <span class="what">${esc(label)} <span class="serial">${esc(x.l.slipNo)}</span></span>
        <span class="who">${esc(x.l.borrower)} · ${esc(x.l.department)} · ${fmt(x.l.dueDate)}</span>
        <span class="when"><span class="pill ${x.d<0?"late":"soon"}">${esc(when)}</span></span></button>`;
    };
    let html = reqs.length ? `<div class="notif-group">${esc(t("notifReqs"))}</div>` + reqs.map(x => `<button type="button" class="notif-item" data-req="${x.q.id}">
        <span class="what">${esc(reqWhat(x.q).join(", ") || x.q.other.slice(0, 60))} <span class="serial">${esc(x.q.reqNo)}</span></span>
        <span class="who">${esc(reqName(x.q))}${x.q.department ? " · " + esc(x.q.department) : ""} · ${fmt(x.q.startDate)} → ${fmt(x.q.endDate)}</span>
        <span class="when"><span class="pill soon">${esc(t("rqPending"))}</span></span></button>`).join("") : "";
    html += `<div class="notif-group">${esc(t("notifSoon"))}</div>` + (soon.length ? soon.map(item).join("") : `<div class="notif-empty">${esc(t("notifEmpty"))}</div>`);
    if (late.length) html += `<div class="notif-group">${esc(t("notifLate"))}</div>` + late.map(item).join("");
    if (res.length) html += `<div class="notif-group">${esc(t("notifRes"))}</div>` + res.map(x => {
      const when = x.d < 0 ? t("resNotCollected") : x.d === 0 ? t("resStartsToday") : x.d === 1 ? t("whenTomorrow") : t("resStartsIn",{n:x.d});
      const names = x.r.items.map(i => i.item);
      return `<button type="button" class="notif-item" data-res="${x.r.id}">
        <span class="what">${esc(names[0] || "")}${names.length > 1 ? " " + esc(t("moreItems",{n:names.length-1})) : ""} <span class="serial">${esc(x.r.resNo)}</span></span>
        <span class="who">${esc(x.r.borrower)} · ${esc(x.r.department)} · ${fmt(x.r.startDate)} → ${fmt(x.r.endDate)}</span>
        <span class="when"><span class="pill ${x.d<0?"late":"res"}">${esc(when)}</span></span></button>`;
    }).join("");
    if (notes.length) html += `<div class="notif-group">${esc(t("notifNotes"))}</div>` + notes.map(x => {
      const when = x.d < 0 ? t("noteRemindLate",{n:-x.d}) : t("whenToday");
      return `<button type="button" class="notif-item" data-note="${x.n.id}">
        <span class="what">${esc(x.n.text.split("\n")[0].slice(0, 90))}</span>
        <span class="who">${esc(t("noteRemindOn",{d:fmt(x.n.remindOn)}))}</span>
        <span class="when"><span class="pill ${x.d<0?"late":"soon"}">${esc(when)}</span></span></button>`;
    }).join("");
    $("notifList").innerHTML = html;
  }
  function toggleNotif(open){
    const p = $("notifPanel"), willOpen = open ?? p.hidden;
    p.hidden = !willOpen; $("bellBtn").setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen){ const {soon, late, res, notes, reqs} = alerts(); store.set("seenAlerts", JSON.stringify([...reqs, ...soon, ...late, ...res, ...notes].map(alertKey))); $("bellBadge").hidden = true; }
  }
  $("bellBtn").addEventListener("click", e => { e.stopPropagation(); toggleNotif(); });
  document.addEventListener("click", e => { if (!$("notifPanel").hidden && !e.target.closest(".bellwrap")) toggleNotif(false); });
  $("notifList").addEventListener("click", e => {
    const b = e.target.closest(".notif-item"); if (!b) return; toggleNotif(false);
    if (b.dataset.req){ showRequests(); return; }
    if (b.dataset.note){ if (view === "settings") location.hash = "register"; setTimeout(() => { if (window.TallyHelper){ TallyHelper.open(); TallyHelper.showNotes(true); } }, 60); return; }
    if (b.dataset.res){ const r = resById(b.dataset.res); if (r){ if (view !== "calendrier") location.hash = "calendar"; openReservation(r); } }
    else focusLoan(b.dataset.slip);
  });

  // ---------- confirmation ----------
  let confirmAction = null;
  function confirmBox({title, text, yes, danger, onYes, input}){
    $("cTitle").textContent = title; $("cText").textContent = text; $("cYes").textContent = yes;
    $("cYes").className = danger ? "btn danger" : "btn primary";
    $("cField").hidden = !input; $("cFieldLbl").textContent = input || ""; $("cInput").value = "";
    confirmAction = onYes; $("confirm").hidden = false;
    if (input) setTimeout(() => $("cInput").focus(), 30);
  }
  $("cNo").addEventListener("click", () => { $("confirm").hidden = true; confirmAction = null; });
  $("cYes").addEventListener("click", () => { const f = confirmAction, v = $("cInput").value.trim(); $("confirm").hidden = true; confirmAction = null; if (f) f(v); });

  // ---------- champs date : saisie au format choisi dans les paramètres ----------
  const dateParts = () => { const f = dateFmt(); return { order: f.match(/DD|MM|YYYY/g), sep: f.replace(/DD|MM|YYYY/g, "")[0] }; };
  const dateHint = () => lang === "fr" ? dateFmt().replace("DD","JJ").replace("YYYY","AAAA") : dateFmt();
  function parseDateText(text){
    const { order } = dateParts();
    let parts = text.trim().split(/[\/.\-\s]+/).filter(Boolean);
    const digits = text.replace(/\D/g, "");
    if (parts.length === 1 && digits.length === 8){ let i = 0; parts = order.map(o => { const n = o === "YYYY" ? 4 : 2; const c = digits.slice(i, i+n); i += n; return c; }); }
    if (parts.length !== 3 || parts.some(x => !/^\d+$/.test(x))) return "";
    const v = {}; order.forEach((o, i) => v[o] = parts[i]);
    let y = Number(v.YYYY), m = Number(v.MM), d = Number(v.DD);
    if (v.YYYY.length === 2) y += 2000; else if (v.YYYY.length !== 4) return "";
    const dt = new Date(y, m-1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m-1 || dt.getDate() !== d) return "";
    return `${String(y).padStart(4,"0")}-${pad(m)}-${pad(d)}`;
  }
  const dateSyncs = [];
  const syncDateFields = () => dateSyncs.forEach(f => f());
  function enhanceDate(input){
    const wrap = document.createElement("span"); wrap.className = "dfield";
    input.parentNode.insertBefore(wrap, input);
    const txt = document.createElement("input"); txt.type = "text"; txt.className = "dtxt"; txt.inputMode = "numeric"; txt.autocomplete = "off"; txt.spellcheck = false;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "dbtn"; btn.tabIndex = -1;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    wrap.append(txt, input, btn);
    input.classList.add("dnative"); input.tabIndex = -1; input.setAttribute("aria-hidden", "true");
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    const sync = () => {
      txt.value = desc.get.call(input) ? fmt(desc.get.call(input)) : ""; txt.placeholder = dateHint();
      txt.disabled = btn.disabled = input.disabled; txt.classList.remove("bad"); txt.removeAttribute("aria-invalid");
      btn.setAttribute("aria-label", t("pickDate"));
    };
    Object.defineProperty(input, "value", { configurable: true, get(){ return desc.get.call(input); }, set(v){ desc.set.call(input, v); sync(); } });
    const fire = () => { input.dispatchEvent(new Event("input", {bubbles:true})); input.dispatchEvent(new Event("change", {bubbles:true})); };
    txt.addEventListener("input", e => {
      if (e.inputType && e.inputType.startsWith("delete")) return;
      const { order, sep } = dateParts(), lens = order.map(o => o === "YYYY" ? 4 : 2);
      const tokens = txt.value.split(/\D+/).filter(Boolean);
      if (tokens.length >= 3 || /[^\d\/.\-\s]/.test(txt.value)) return;      // already complete, or pasted text: leave it to the parser
      if (/\D$/.test(txt.value) && tokens.length){ const g = tokens.length - 1; if (lens[g] === 2) tokens[g] = tokens[g].padStart(2, "0"); }   // "5/" -> "05/"
      const dg = tokens.join("").slice(0, 8);
      let out = "", i = 0;
      for (let g = 0; g < 3 && i < dg.length; g++){
        const c = dg.slice(i, i + lens[g]); out += (g ? sep : "") + c; i += lens[g];
        if (c.length < lens[g]) break;
        if (g < 2 && i >= dg.length) out += sep;
      }
      txt.value = out;
    });
    txt.addEventListener("change", () => {
      const raw = txt.value.trim();
      if (!raw){ desc.set.call(input, ""); sync(); fire(); return; }
      const iso = parseDateText(raw);
      if (!iso){ desc.set.call(input, ""); txt.classList.add("bad"); txt.setAttribute("aria-invalid", "true"); toast(t("badDate", {f: dateHint()})); return; }
      input.value = iso; fire();
    });
    input.addEventListener("change", sync);
    btn.addEventListener("click", () => { try{ input.showPicker(); }catch(_){ txt.focus(); } });
    if (input.form) input.form.addEventListener("reset", () => setTimeout(sync));
    dateSyncs.push(sync); sync();
  }
  document.querySelectorAll('input[type="date"]').forEach(enhanceDate);
  function fillDateFormatOptions(){
    const sel = $("s_dateFormat"), cur = sel.value || (settings && settings.dateFormat) || "DD/MM/YYYY", ex = new Date(2026, 11, 31);
    sel.innerHTML = DATE_FORMATS.map(f => `<option value="${f}">${esc((lang === "fr" ? f.replace("DD","JJ").replace("YYYY","AAAA") : f))}  (${esc(f.replace("DD","31").replace("MM","12").replace("YYYY","2026"))})</option>`).join("");
    sel.value = cur;
  }
  fillDateFormatOptions();

  // info popup next to "Registry address for QR codes"
  [["urlInfoBtn","urlInfoPop"],["dataInfoBtn","dataInfoPop"]].forEach(([b, p]) => (function(){
    const btn = $(b), pop = $(p), wrap = btn.parentElement;
    const open = v => { pop.hidden = !v; btn.setAttribute("aria-expanded", v ? "true" : "false"); };
    wrap.addEventListener("mouseenter", () => open(true));
    wrap.addEventListener("mouseleave", () => { if (document.activeElement !== btn) open(false); });
    btn.addEventListener("focus", () => open(true));
    btn.addEventListener("blur", () => open(false));
    btn.addEventListener("click", () => open(true));
    document.addEventListener("keydown", e => { if (e.key === "Escape") open(false); });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) open(false); });
  })());

  // ---------- nouveautés (CHANGELOG.md) ----------
  let changelog = null, clShowAll = false;
  const CL_SHOWN = 5;
  async function loadChangelog(){ if (changelog) return changelog; try{ changelog = await api("GET", "/api/changelog"); }catch(_){ changelog = []; } return changelog; }
  const clSection = name => ({Added:"clAdded", Improved:"clImproved", Fixed:"clFixed"}[name] ? t({Added:"clAdded", Improved:"clImproved", Fixed:"clFixed"}[name]) : name);
  function renderChangelog(){
    const list = changelog || [], shown = clShowAll ? list : list.slice(0, CL_SHOWN);
    if (!list.length){ $("clBody").innerHTML = `<p class="sub">${esc(t("clEmpty"))}</p>`; return; }
    const note = t("clEnOnly");
    $("clBody").innerHTML = (note ? `<p class="sub">${esc(note)}</p>` : "") + shown.map(v => `<section class="clv">
      <h3>v${esc(v.version)} <span class="pill cl-${esc(v.type)}" title="${esc(t("clType_"+v.type+"_d"))}">${esc(t("clType_"+v.type))}</span>${v.version === APP_VERSION ? ` <span class="pill out">${esc(t("clInstalled"))}</span>` : ""}</h3>
      ${Object.entries(v.sections).map(([name, items]) => `<h4>${esc(clSection(name))}</h4><ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`).join("")}
    </section>`).join("") + (!clShowAll && list.length > CL_SHOWN ? `<button type="button" class="btn" id="clMore">${esc(t("clOlder"))}</button>` : "");
    const more = $("clMore"); if (more) more.addEventListener("click", () => { clShowAll = true; renderChangelog(); });
  }
  async function openChangelog(){
    await loadChangelog(); clShowAll = false; renderChangelog();
    $("clModal").hidden = false; $("clModal").scrollTop = 0; $("updateBanner").hidden = true; store.set("seenVersion", APP_VERSION);
  }
  $("whatsNewBtn").addEventListener("click", openChangelog);
  $("updateOpen").addEventListener("click", openChangelog);
  $("closeCl").addEventListener("click", () => { $("clModal").hidden = true; });
  $("clModal").addEventListener("click", e => { if (e.target === $("clModal")) $("clModal").hidden = true; });
  $("updateDismiss").addEventListener("click", () => { $("updateBanner").hidden = true; store.set("seenVersion", APP_VERSION); });
  function checkUpdated(){
    const seen = store.get("seenVersion");
    if (!seen){ store.set("seenVersion", APP_VERSION); return; }       // first visit on this browser: nothing to announce
    if (seen === APP_VERSION) return;
    $("updateText").textContent = t("updatedTo", {v: APP_VERSION}); $("updateBanner").hidden = false;
  }

  // ---------- événements généraux ----------
  $("newBtn").addEventListener("click", () => openForm(null));
  $("emptyNew").addEventListener("click", () => openForm(null));
  $("closeSheet").addEventListener("click", closeForm); $("cancelForm").addEventListener("click", closeForm);
  $("closeRet").addEventListener("click", closeRet); $("cancelRet").addEventListener("click", closeRet);
  $("closeExt").addEventListener("click", closeExt); $("cancelExt").addEventListener("click", closeExt);
  $("q").addEventListener("input", e => { query = e.target.value; renderRegister(); });
  document.querySelectorAll("#view-registre .chip, #view-registre .stat[data-f]").forEach(c => c.addEventListener("click", () => { setFilter(c.dataset.f); renderRegister(); }));
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$("helpModal").hidden) return closeHelp();
    if (!$("rowMenu").hidden) return closeRowMenu(true);
    if (!$("notifPanel").hidden) return toggleNotif(false);
    if (!$("confirm").hidden) return $("cNo").click();
    if (!$("clModal").hidden) return $("closeCl").click();
    if (!$("slipModal").hidden) return $("closeSlip").click();
    if (!$("arcModal").hidden) return $("closeArc").click();
    for (const [id, close] of [["histSheet", () => $("histSheet").hidden = true], ["resSheet", closeRes], ["extSheet", closeExt], ["retSheet", closeRet], ["eqSheet", closeEq], ["sheet", closeForm]])
      if (!$(id).hidden) return close();
  });

  const anyOpen = () => ["sheet","retSheet","extSheet","eqSheet","resSheet","confirm","arcModal"].some(id => !$(id).hidden);

  // ---------- help window + keyboard shortcuts ----------
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";
  const SHORTCUTS = [
    ["scNav",     [[["1","2","3","4"], "scTabs"], [[","], "scSettings"], [["?"], "scHelp"]]],
    ["scActions", [[["N"], "scNew"], [["/"], "scSearch"], [["H"], "scHelper"]]],
    ["scCal",     [[["←","→"], "scMonth"], [["T"], "scToday"]]],
    ["scWin",     [[[MOD,"Enter"], "scSave"], [["Esc"], "scClose"]]]
  ];
  let helpUnmount = null, helpLoading = false, helpGradientLoaded = false;
  function renderHelp(){
    let n = 0;
    $("helpList").innerHTML = SHORTCUTS.map(([g, rows]) => `<div class="help-group"><h3>${esc(t(g))}</h3>${rows.map(([keys, d]) =>
      `<div class="help-row" style="animation-delay:${(120 + 45 * n++)}ms"><span>${esc(t(d))}</span><span class="help-keys">${keys.map(k => `<kbd>${esc(k)}</kbd>`).join(keys[0] === MOD ? "<i>+</i>" : "")}</span></div>`).join("")}</div>`).join("");
  }
  function startHelpGradient(){
    const bg = $("helpBg");
    if (helpUnmount || helpLoading) return;
    let ok = false; try{ const c = document.createElement("canvas"); ok = !!(c.getContext("webgl2") || c.getContext("webgl")); }catch(_){}
    if (!ok || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const run = () => { if ($("helpModal").hidden) return; try{ helpUnmount = window.TallyGradient.mount(bg, "help"); setTimeout(() => bg.classList.add("ready"), 450); }catch(_){} };
    if (window.TallyGradient){ run(); return; }
    helpLoading = true;
    const sc = document.createElement("script"); sc.src = "vendor/shadergradient.js";
    sc.onload = () => { helpLoading = false; run(); };
    sc.onerror = () => { helpLoading = false; };
    document.head.appendChild(sc);
  }
  let helpFrom = null;
  function openHelp(){
    if (!$("helpModal").hidden) return;
    helpFrom = document.activeElement;
    renderHelp(); $("helpModal").hidden = false; $("closeHelp").focus();
    startHelpGradient();
  }
  function closeHelp(){
    if ($("helpModal").hidden) return;
    $("helpModal").hidden = true; $("helpBg").classList.remove("ready");
    if (helpUnmount){ try{ helpUnmount(); }catch(_){} helpUnmount = null; }
    if (helpFrom && helpFrom.focus) helpFrom.focus(); helpFrom = null;
  }
  $("helpBtn").addEventListener("click", openHelp);
  $("closeHelp").addEventListener("click", closeHelp);
  $("helpModal").addEventListener("click", e => { if (e.target === $("helpModal")) closeHelp(); });
  // keep Tab inside the window
  $("helpModal").addEventListener("keydown", e => { if (e.key === "Tab"){ e.preventDefault(); $("closeHelp").focus(); } });

  const overlayOpen = () => anyOpen() || ["clModal","slipModal","helpModal","setupModal"].some(id => !$(id).hidden) || !$("notifPanel").hidden || !$("rowMenu").hidden;
  document.addEventListener("keydown", e => {
    // Ctrl/⌘ + Enter saves the open form
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey){
      const f = e.target.closest && e.target.closest("form"); if (f && !f.closest("[hidden]") ){ e.preventDefault(); f.requestSubmit(); }
      return;
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tg = e.target, typing = tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName));
    if (typing || overlayOpen()) return;
    const k = e.key;
    if (k === "?"){ e.preventDefault(); openHelp(); return; }
    if ((k === "h" || k === "H") && window.TallyHelper){ e.preventDefault(); window.TallyHelper.toggle(); return; }
    if (k === ","){ e.preventDefault(); location.hash = "#settings"; return; }
    if (/^[1-4]$/.test(k)){ e.preventDefault(); location.hash = "#" + ["register","inventory","calendar","statistics"][Number(k) - 1]; return; }
    if (k === "/"){
      const box = view === "registre" ? $("q") : view === "inventaire" ? $("iq") : null;
      if (box){ e.preventDefault(); box.focus(); box.select(); }
      return;
    }
    if (k === "n" || k === "N"){
      const btn = view === "registre" ? $("newBtn") : view === "inventaire" ? $("newEqBtn") : view === "calendrier" ? $("newResBtn") : null;
      if (btn){ e.preventDefault(); btn.click(); }
      return;
    }
    if (view === "calendrier"){
      if (k === "ArrowLeft"){ e.preventDefault(); $("calPrev").click(); }
      else if (k === "ArrowRight"){ e.preventDefault(); $("calNext").click(); }
      else if (k === "t" || k === "T"){ e.preventDefault(); $("calToday").click(); }
    }
  });
  function startRefresh(){
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!anyOpen() && document.visibilityState === "visible") load(); }, ((settings && settings.refreshSeconds) || 30) * 1000);
  }

  // ---------- settings page: section rail, back-to-top ----------
  const SEC_IDS = ["set-general","set-assistant","set-archive","set-a11y","set-loans","set-lists","set-slip","intCard","set-data"];
  const smooth = () => (document.documentElement.dataset.motion === "reduce" || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) ? "auto" : "smooth";
  let railCur = -1, railTick = false, railBound = false;
  function buildRail(){
    $("railList").innerHTML = SEC_IDS.map(id => {
      const label = t($(id).dataset.sec);
      return `<li><button type="button" data-target="${id}" aria-label="${esc(label)}"><span class="rail-dot"></span><span class="rail-label">${esc(label)}</span></button></li>`;
    }).join("");
    railCur = -1;
  }
  function updateRail(){
    if (view !== "settings") return;
    const y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight), pivot = innerHeight * 0.32;
    let cur = 0;
    SEC_IDS.forEach((id, i) => { if ($(id).getBoundingClientRect().top <= pivot) cur = i; });
    if (max - y < 6) cur = SEC_IDS.length - 1;
    $("railFill").style.transform = `scaleY(${Math.min(1, y / max).toFixed(4)})`;
    $("toTop").classList.toggle("show", y > 480); $("toTop").hidden = false;
    if (cur === railCur) return;
    railCur = cur;
    const btns = [...$("railList").querySelectorAll("button")];
    btns.forEach((b, i) => { if (i === cur) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    const b = btns[cur];
    if (b) $("railThumb").style.transform = `translateY(${b.parentElement.offsetTop + b.parentElement.offsetHeight / 2}px)`;
    const sec = $("crumbSec"), label = t($(SEC_IDS[cur]).dataset.sec);
    if (sec.textContent !== label){ sec.textContent = label; if (sec.animate && smooth() === "smooth") sec.animate([{transform:"translateY(10px)",opacity:0},{transform:"none",opacity:1}], {duration:280, easing:"cubic-bezier(.2,.9,.3,1)"}); }
  }
  function settingsNavOn(){
    buildRail(); $("rail").hidden = false; $("toTop").hidden = false;
    if (!railBound){
      railBound = true;
      window.addEventListener("scroll", () => { if (railTick || view !== "settings") return; railTick = true; requestAnimationFrame(() => { railTick = false; updateRail(); }); }, {passive:true});
      window.addEventListener("resize", () => { railCur = -1; updateRail(); });
      $("railList").addEventListener("click", e => {
        const b = e.target.closest("button[data-target]"); if (!b) return;
        const sec = $(b.dataset.target); sec.scrollIntoView({behavior: smooth(), block: "start"});
        const h = sec.querySelector("h2"); if (h){ h.tabIndex = -1; h.focus({preventScroll:true}); }
      });
      $("toTop").addEventListener("click", () => { window.scrollTo({top:0, behavior: smooth()}); $("backBtn").focus({preventScroll:true}); });
    }
    requestAnimationFrame(updateRail);
  }
  function settingsNavOff(){ $("rail").hidden = true; $("toTop").hidden = true; $("toTop").classList.remove("show"); }

  // ---------- archive ----------
  const ARC_OPTS = [3, 6, 12, 24, 36, 60];
  function fillArchiveOptions(){
    const sel = $("s_archiveMonths"), keep = sel.value || String((settings && settings.archiveMonths) || 12);
    const vals = ARC_OPTS.includes(Number(keep)) ? ARC_OPTS : [...ARC_OPTS, Number(keep)].sort((a,b) => a-b);
    sel.innerHTML = vals.map(n => `<option value="${n}">${esc(n % 12 === 0 ? t(n === 12 ? "arcYear1" : "arcYearsN", {n: n/12}) : t("arcMonthsN", {n}))}</option>`).join("");
    sel.value = keep;
  }
  let arcN = 0;
  async function refreshArchiveCount(){
    try{ arcN = (await api("GET", "/api/archive?count=1")).count; }catch(_){ return; }
    $("arcCount").textContent = arcN ? `(${arcN})` : "";
    $("arcView").disabled = !arcN; $("arcEmpty").disabled = !arcN;
    $("arcDl").setAttribute("aria-disabled", arcN ? "false" : "true"); $("arcDl").classList.toggle("disabled", !arcN);
    $("arcStatus").textContent = arcN ? t("arcStatus", {n: arcN}) : t("arcStatusNone");
  }
  $("arcDl").addEventListener("click", e => { if (!arcN) e.preventDefault(); });
  let arcLoans = [];
  async function openArchive(){
    try{ const r = await api("GET", "/api/archive"); arcLoans = r.loans; }catch(ex){ toast(ex.message); return; }
    renderArchive(); $("arcModal").hidden = false; setTimeout(() => $("arcAll").focus(), 40);
  }
  function renderArchive(){
    $("arcModalSub").textContent = t("arcModalSub", {n: arcLoans.length});
    $("arcRows").innerHTML = arcLoans.map(l => `<tr>
      <td><input type="checkbox" data-id="${l.id}" aria-label="${esc(t("arcSelectOne", {no: l.slipNo}))}"></td>
      <td><span class="tag">${esc(l.slipNo)}</span></td>
      <td>${esc(l.borrower)}<div class="sub">${esc(l.department)}</div></td>
      <td>${l.items.map(i => `<div>${esc(i.item)} <span class="serial">${esc(i.serial)}</span></div>`).join("")}</td>
      <td class="mono">${fmt(l.loanDate)}</td><td class="mono">${fmt(l.returnDate)}</td></tr>`).join("");
    $("arcEmptyNote").hidden = arcLoans.length > 0; $("arcAll").checked = false; $("arcAll").disabled = !arcLoans.length; arcSelUpdate();
  }
  const arcChecked = () => [...$("arcRows").querySelectorAll('input[type="checkbox"]:checked')].map(c => Number(c.dataset.id));
  function arcSelUpdate(){
    const n = arcChecked().length, all = $("arcRows").querySelectorAll('input[type="checkbox"]').length;
    $("arcSel").textContent = n ? t("arcSel", {n}) : ""; $("arcDelSel").disabled = !n;
    $("arcAll").checked = all > 0 && n === all; $("arcAll").indeterminate = n > 0 && n < all;
  }
  $("arcRows").addEventListener("change", arcSelUpdate);
  $("arcAll").addEventListener("change", e => { $("arcRows").querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = e.target.checked); arcSelUpdate(); });
  $("arcView").addEventListener("click", openArchive);
  $("closeArc").addEventListener("click", () => { $("arcModal").hidden = true; });
  $("arcDelSel").addEventListener("click", () => {
    const ids = arcChecked(); if (!ids.length) return;
    confirmBox({ title: t("arcDelTitle"), text: t("arcDelText", {n: ids.length}), yes: t("delete"), danger: true, onYes: async () => {
      try{ const r = await api("POST", "/api/archive/delete", {ids}); toast(t("arcDeleted", {n: r.deleted})); await openArchive(); refreshArchiveCount(); }
      catch(ex){ toast(ex.message); }
    }});
  });
  $("arcEmpty").addEventListener("click", () => {
    confirmBox({ title: t("arcEmptyTitle"), text: t("arcEmptyText", {n: arcN}), yes: t("arcEmptyYes"), danger: true, onYes: async () => {
      try{ const r = await api("POST", "/api/archive/delete", {all: true}); toast(t("arcDeleted", {n: r.deleted})); $("arcModal").hidden = true; refreshArchiveCount(); }
      catch(ex){ toast(ex.message); }
    }});
  });

  // ---------- restore from a backup ----------
  $("restoreBtn").addEventListener("click", () => $("restoreFile").click());
  $("restoreFile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    confirmBox({ title: t("restoreTitle"), text: t("restoreText", {name: f.name}), yes: t("restoreYes"), danger: true, onYes: async () => {
      const msg = $("restoreMsg"); msg.classList.remove("err"); msg.textContent = t("restoring");
      try{
        const r = await fetch("/api/restore", {method: "POST", headers: {"Content-Type": "application/octet-stream"}, body: f});
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        msg.textContent = t("restored"); toast(t("restored")); setTimeout(() => location.reload(), 1200);
      }catch(ex){ msg.classList.add("err"); msg.textContent = t("restoreFail", {msg: ex.message}); }
    }});
  });

  // ---------- accessibility: focus goes into an opened dialog, stays there and returns afterwards ----------
  (function(){
    const dlgs = [...document.querySelectorAll(".scrim, .modal, .help, .setup")];
    const stack = [];
    const FOC = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const shown = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const focusables = root => [...root.querySelectorAll(FOC)].filter(shown);
    const setInert = on => { for (const sel of [".wrap", "#rail"]){ const el = document.querySelector(sel); if (el) el.inert = on; } };
    const mo = new MutationObserver(muts => {
      for (const m of muts){
        const el = m.target, at = stack.findIndex(x => x.el === el);
        if (!el.hidden && at < 0){
          stack.push({el, from: document.activeElement}); setInert(true);
          setTimeout(() => { if (!el.hidden && !el.contains(document.activeElement)){ const f = focusables(el)[0]; if (f) f.focus(); } }, 70);
        } else if (el.hidden && at >= 0){
          const {from} = stack.splice(at, 1)[0]; if (!stack.length) setInert(false);
          if (from && from.isConnected && shown(from)) try{ from.focus(); }catch(_){}
        }
      }
    });
    dlgs.forEach(el => mo.observe(el, {attributes: true, attributeFilter: ["hidden"]}));
    document.addEventListener("keydown", e => {
      if (e.key !== "Tab" || e.defaultPrevented || !stack.length) return;
      const top = stack[stack.length - 1].el, f = focusables(top);
      if (!f.length) return;
      if (!top.contains(document.activeElement)){ e.preventDefault(); f[0].focus(); }
      else if (e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
    });
  })();

  // ---------- first-run setup ----------
  const SETUP_STEPS = 5;
  const SETUP_SW = {auto:["#f3f5f4","#121715"], light:["#f3f5f4","#1f4fbf"], dark:["#121715","#7ea2ff"], indigo:["#07080c","#6e6be5"], ocean:["#05102a","#00a6ff"], forest:["#f1eee1","#1f5a3d"], sunset:["#fff3e8","#c2410c"], mocha:["#14100d","#d9a066"], nord:["#242933","#88c0d0"], graphite:["#0f0f10","#a3e635"], rose:["#fdf2f5","#be185d"], mint:["#ecf8f3","#0f766e"]};
  let suStep = 0, suTheme = "auto", suBusy = false;
  function suSwatches(){
    $("setupThemes").innerHTML = THEME_IDS.map(id => {
      const [a,b] = SETUP_SW[id];
      const bg = id === "auto" ? `linear-gradient(110deg,${a} 50%,${b} 50%)` : `linear-gradient(110deg,${a} 58%,${b} 58%)`;
      return `<button type="button" class="susw" data-theme-id="${id}" aria-pressed="${id===suTheme}"><span class="chip2" style="background:${bg}"></span>${esc(t("theme_"+id))}</button>`;
    }).join("");
  }
  // Step 3 scene: the badge follows the form
  function suBadge(){
    const name = $("su_orgName").value.trim() || "Tally";
    const pre = ($("su_slipPrefix").value.trim() || "PR").toUpperCase().replace(/[^A-Z0-9]/g,"") || "PR";
    const days = Math.max(1, Math.min(365, Math.round(Number($("su_days").value)) || 14));
    $("suBdName").textContent = name;
    $("suBdMark").textContent = (name.match(/[\p{L}\p{N}]/u) || ["T"])[0].toUpperCase();
    $("suBdPrefix").textContent = pre + "-0001";
    $("suBdDays").textContent = days;
    document.querySelector("#suBadge .bd-ring .fg").style.strokeDashoffset = String(100 - Math.max(8, Math.min(100, days / 90 * 100)));
  }
  const SU_PULSE = {su_orgName:"suBdName", su_slipPrefix:"suBdPrefix", su_days:"suBdDays"};
  ["su_orgName","su_slipPrefix","su_days"].forEach(id => $(id).addEventListener("input", () => {
    suBadge();
    const el = $(SU_PULSE[id]); if (el && el.animate) el.animate([{transform:"scale(1.12)"},{transform:"scale(1)"}], {duration:260, easing:"ease-out"});
    const m = $("suBdMark"); if (id === "su_orgName" && m.animate) m.animate([{transform:"scale(.8) rotate(-8deg)"},{transform:"scale(1) rotate(0)"}], {duration:300, easing:"cubic-bezier(.3,1.6,.5,1)"});
  }));
  // Step 2 scene: a small flourish whenever a theme is picked
  function suMockSwap(){ const m = $("suMock"); if (m.animate) m.animate([{transform:"scale(.94)"},{transform:"scale(1)"}], {duration:380, easing:"cubic-bezier(.3,1.6,.5,1)"}); }
  function suRender(dir){
    const m = $("setupModal");
    suBadge();
    m.dataset.step = suStep; m.dataset.dir = dir || "next";
    m.querySelectorAll(".setup-pane").forEach(p => { p.hidden = Number(p.dataset.step) !== suStep; });
    $("setupDots").querySelectorAll("i").forEach((d,i) => { d.classList.toggle("on", i <= suStep); d.classList.toggle("cur", i === suStep); });
    $("setupCount").textContent = t("setupStep", {n: suStep+1, total: SETUP_STEPS});
    $("suBack").hidden = suStep === 0;
    $("suSkip").hidden = suStep === SETUP_STEPS-1;
    $("suNext").textContent = t(suStep === SETUP_STEPS-1 ? "setupFinish" : "setupNext");
    m.querySelectorAll("#setupLang button").forEach(b => b.setAttribute("aria-pressed", b.dataset.lang === lang ? "true" : "false"));
    $("setupErr").hidden = true;
    if (suStep === 3) suWalkInit();
  }
  // Step 4 scene: the helper walks in carrying a parcel
  function suWalkInit(){
    const s = $("suWalkSvg");
    if (!s.childElementCount && window.TallyHelper && TallyHelper.figure){
      s.innerHTML = `<defs><linearGradient id="suBox" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7b57f"/><stop offset="1" stop-color="#cd9259"/></linearGradient></defs>` +
        TallyHelper.figure("su") + `<g transform="translate(14 4)"><g class="suw-stack">
          <g class="suw-b sb1"><rect x="34" y="94" width="66" height="32" rx="3" fill="url(#suBox)"/><path d="M34 103 h66" stroke="#b97f47" stroke-width="2"/><rect x="62" y="94" width="10" height="9" fill="#f3d5a8"/><rect x="72" y="108" width="22" height="12" rx="1.5" fill="#fff"/><path d="M75 110 v8 M78 110 v8 M81 110 v8 M84 110 v8 M87 110 v8 M90 110 v8" stroke="#07132f" stroke-width="1.3"/></g>
          <ellipse cx="33" cy="113" rx="8.5" ry="11" fill="#0d1a3e"/><ellipse cx="101" cy="111" rx="8.5" ry="11" fill="#0d1a3e"/>
        </g></g>`;
    }
    const on = !(A11Y && A11Y.noHelper);
    $("su_helper").checked = on; $("suWalk").dataset.on = on ? "1" : "0";
  }
  $("su_helper").addEventListener("change", () => {
    const on = $("su_helper").checked;
    A11Y.noHelper = !on; store.set("tally.a11y", JSON.stringify(A11Y)); applyA11y();
    $("a11yHelper").checked = on; $("suWalk").dataset.on = on ? "1" : "0";
  });
  function openSetup(){
    suStep = 0; suTheme = (settings && settings.theme) || "auto";
    $("su_orgName").value = (settings && settings.orgName) || "";
    $("su_slipPrefix").value = (settings && settings.slipPrefix) || "PR";
    $("su_days").value = (settings && settings.defaultLoanDays) || 14;
    suSwatches(); suRender();
    $("setupModal").hidden = false;
    setTimeout(() => { const b = document.querySelector("#setupLang button[aria-pressed=true]"); if (b) b.focus(); }, 60);
  }
  async function suSave(final){
    const body = { defaultLang: lang, theme: suTheme, setupDone: !!final };
    if (suStep >= 2 || final){
      body.orgName = $("su_orgName").value.trim();
      body.slipPrefix = $("su_slipPrefix").value.trim() || "PR";
      body.defaultLoanDays = Math.max(1, Math.min(365, Math.round(Number($("su_days").value)) || 14));
    }
    settings = await api("PUT", "/api/settings", body);
    applyTheme(settings.theme);
    lang = settings.defaultLang === "fr" ? "fr" : "en";
    applyI18n(); try{ $("ldText").textContent = t("loading"); }catch(_){} fillDateFormatOptions(); fillSettingsForm(); syncDateFields(); renderAll(); renderPicklists(); renderLogoSetting();
  }
  function closeSetup(){ $("setupModal").hidden = true; }
  async function suNext(){
    if (suBusy) return; suBusy = true;
    try{
      if (suStep === 2){ await suSave(false); }
      if (suStep === SETUP_STEPS-1){ await suSave(true); closeSetup(); return; }
      suStep++; suRender("next");
    }catch(ex){ $("setupErr").textContent = ex.message || t("setupSaveErr"); $("setupErr").hidden = false; }
    finally{ suBusy = false; }
  }
  $("suNext").addEventListener("click", suNext);
  $("suBack").addEventListener("click", () => { if (suStep > 0){ suStep--; suRender("back"); } });
  $("suSkip").addEventListener("click", async () => {
    if (suBusy) return; suBusy = true;
    try{ await suSave(true); closeSetup(); }
    catch(ex){ $("setupErr").textContent = ex.message || t("setupSaveErr"); $("setupErr").hidden = false; }
    finally{ suBusy = false; }
  });
  $("setupLang").addEventListener("click", e => {
    const b = e.target.closest("button[data-lang]"); if (!b) return;
    lang = b.dataset.lang; applyI18n(); suSwatches(); suRender("keep");
  });
  $("setupThemes").addEventListener("click", e => {
    const b = e.target.closest(".susw"); if (!b) return;
    suTheme = b.dataset.themeId; applyTheme(suTheme); suMockSwap();
    $("setupThemes").querySelectorAll(".susw").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  });
  $("setupModal").addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.tagName === "INPUT"){ e.preventDefault(); suNext(); }
    if (e.key === "Tab"){ // keep focus inside the card
      const f = [...$("setupModal").querySelectorAll("button,input")].filter(x => !x.hidden && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length-1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });
  $("suImport").addEventListener("click", async () => { try{ await suSave(true); }catch(_){} closeSetup(); location.hash = "#settings"; setTimeout(() => { const b = $("importBtn"); if (b){ b.scrollIntoView({block:"center"}); b.focus(); } }, 150); });
  $("suKeys").addEventListener("click", async () => { try{ await suSave(true); }catch(_){} closeSetup(); openHelp(); });

  // ---------- bridge for the Tally helper (helper.js) ----------
  window.TallyApp = {
    get loans(){ return loans; }, get equipment(){ return equipment; }, get reservations(){ return reservations; },
    get settings(){ return settings; }, get lang(){ return lang; }, get view(){ return view; }, get loaded(){ return loaded; },
    t, esc, fmt, isoToday, daysBetween, status, alerts, eqState, overlayOpen, toast, openHelp, exportCsv, openItemHistory, openBorrowerHistory,
    go(v){ location.hash = "#" + (VIEW_HASH[v] || v); },
    newLoan(){ if (view !== "registre") location.hash = "#register"; setTimeout(() => openForm(), 80); },
    showRegister(f, q){ location.hash = "#register"; setTimeout(() => { query = q || ""; $("q").value = query; setFilter(f || "active"); renderRegister(); }, 60); },
    focusLoan(slip){ location.hash = "#register"; setTimeout(() => focusLoan(slip), 60); },
    goSettings(sec){ location.hash = "#settings"; setTimeout(() => { const s = $(sec); if (s) s.scrollIntoView({behavior: smooth(), block: "start"}); }, 120); },
    get notes(){ return notesData; }, get requests(){ return requests; }, showRequests,
    setNotes(list){ notesData = list || []; renderBell(); refreshLoanWarnings(); },
    backup(){ const a = document.createElement("a"); a.href = "/api/backup"; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); }
  };

  // ---------- accessibility settings (per browser) ----------
  const A11Y = (() => { try{ return JSON.parse(store.get("tally.a11y") || "{}") || {}; }catch(_){ return {}; } })();
  function applyA11y(){
    const r = document.documentElement;
    A11Y.text ? r.dataset.text = A11Y.text : delete r.dataset.text;
    A11Y.contrast ? r.dataset.contrast = "high" : delete r.dataset.contrast;
    A11Y.motion ? r.dataset.motion = "reduce" : delete r.dataset.motion;
    A11Y.focus ? r.dataset.focus = "strong" : delete r.dataset.focus;
    A11Y.noHelper ? r.dataset.helper = "off" : delete r.dataset.helper;
  }
  applyA11y();
  function initA11y(){
    $("a11yText").value = A11Y.text || ""; $("a11yContrast").checked = !!A11Y.contrast; $("a11yMotion").checked = !!A11Y.motion; $("a11yFocus").checked = !!A11Y.focus; $("a11yHelper").checked = !A11Y.noHelper;
    const save = () => { A11Y.text = $("a11yText").value; A11Y.contrast = $("a11yContrast").checked; A11Y.motion = $("a11yMotion").checked; A11Y.focus = $("a11yFocus").checked; A11Y.noHelper = !$("a11yHelper").checked; store.set("tally.a11y", JSON.stringify(A11Y)); applyA11y(); };
    ["a11yText","a11yContrast","a11yMotion","a11yFocus","a11yHelper"].forEach(id => $(id).addEventListener("change", save));
  }
  initA11y(); setTimeout(() => { try{ hideLoader(); }catch(_){} }, 8000);
  function hideLoader(){
    const l = $("loader"); if (!l) return;
    l.classList.add("ld-off"); setTimeout(() => l.remove(), 450);
  }

  // ---------- démarrage ----------
  async function checkServerVersion(){
    let v = "", info = {}; try{ info = await api("GET", "/api/version"); v = info.version; }catch(_){}
    $("aboutVer").textContent = "Tally v" + APP_VERSION;
    if (info.repo && /^https:\/\//.test(info.repo)) $("ghLink").href = info.repo;
    if (v === APP_VERSION) return;
    $("offline").dataset.outdated = JSON.stringify({page: APP_VERSION, server: v || "1.0"});
    $("offline").textContent = t("outdated", {page: APP_VERSION, server: v || "1.0"});
    $("offline").hidden = false;
  }
  (async () => {
    try{ settings = await api("GET", "/api/settings"); }
    catch(_){ settings = {orgName:"",serviceName:"",publicUrl:"",defaultLang:"en",dateFormat:"DD/MM/YYYY",slipPrefix:"PR",defaultLoanDays:14,dueSoonDays:3,refreshSeconds:30,requireIssuedBy:false,sites:[],departments:[],categories:[],terms:"",theme:"auto",setupDone:true}; }
    lang = settings.defaultLang === "fr" ? "fr" : "en";
    applyTheme(settings.theme);
    applyI18n(); fillDateFormatOptions(); syncDateFields(); checkUpdated();
    await checkServerVersion();
    loadLogo();
    await load();
    route();
    startRefresh();
    // keep the loader up long enough to read as a loader, then reveal the app; the setup card opens only once it is gone so its animation plays in full
    setTimeout(() => {
      hideLoader();
      if (settings && settings.setupDone === false) setTimeout(openSetup, 480);
    }, Math.max(0, 700 - performance.now()));
  })();
})();
