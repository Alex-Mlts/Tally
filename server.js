// Tally — serveur Express + SQLite (node:sqlite)
const path = require("path");
const fs = require("fs");
const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const VERSION = require("./package.json").version;
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const AUTH_USER = process.env.AUTH_USER || "";
const AUTH_PASS = process.env.AUTH_PASS || "";

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "registre.db"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");

const tx = fn => (...args) => {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(...args); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
};
const nowIso = () => new Date().toISOString();

// ---------- Schéma ----------
db.exec(`
CREATE TABLE IF NOT EXISTS loans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slip_no       TEXT UNIQUE NOT NULL,
  item          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT '',
  serial        TEXT NOT NULL,
  asset_tag     TEXT NOT NULL DEFAULT '',
  accessories   TEXT NOT NULL DEFAULT '',
  condition_out TEXT NOT NULL DEFAULT '',
  borrower      TEXT NOT NULL,
  department    TEXT NOT NULL,
  site          TEXT NOT NULL DEFAULT '',
  contact       TEXT NOT NULL DEFAULT '',
  purpose       TEXT NOT NULL DEFAULT '',
  issued_by     TEXT NOT NULL DEFAULT '',
  loan_date     TEXT NOT NULL,
  due_date      TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '',
  return_date   TEXT NOT NULL DEFAULT '',
  condition_in  TEXT NOT NULL DEFAULT '',
  return_notes  TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loans_serial ON loans(serial);
CREATE TABLE IF NOT EXISTS counters (year TEXT PRIMARY KEY, last INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS files (key TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS equipment (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  serial      TEXT NOT NULL,
  asset_tag   TEXT NOT NULL DEFAULT '',
  site        TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'available',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_serial ON equipment(serial COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS loan_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id       INTEGER NOT NULL,
  equipment_id  INTEGER,
  item          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT '',
  serial        TEXT NOT NULL,
  asset_tag     TEXT NOT NULL DEFAULT '',
  accessories   TEXT NOT NULL DEFAULT '',
  condition_out TEXT NOT NULL DEFAULT '',
  return_date   TEXT NOT NULL DEFAULT '',
  condition_in  TEXT NOT NULL DEFAULT '',
  return_notes  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_items_loan ON loan_items(loan_id);
CREATE INDEX IF NOT EXISTS idx_items_serial ON loan_items(serial COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_items_equipment ON loan_items(equipment_id);

CREATE TABLE IF NOT EXISTS loan_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id  INTEGER NOT NULL,
  type     TEXT NOT NULL,
  at       TEXT NOT NULL,
  data     TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_loan ON loan_events(loan_id);

CREATE TABLE IF NOT EXISTS reservations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  res_no      TEXT UNIQUE NOT NULL,
  borrower    TEXT NOT NULL,
  department  TEXT NOT NULL,
  site        TEXT NOT NULL DEFAULT '',
  contact     TEXT NOT NULL DEFAULT '',
  purpose     TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  booked_by   TEXT NOT NULL DEFAULT '',
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  loan_id     INTEGER,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reservation_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id  INTEGER NOT NULL,
  equipment_id    INTEGER,
  item            TEXT NOT NULL,
  serial          TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_resitems_res ON reservation_items(reservation_id);
CREATE INDEX IF NOT EXISTS idx_resitems_eq ON reservation_items(equipment_id);

`);

// Les rappels par e-mail (v1.4.0) ont été retirés : on efface leur journal
db.exec("DROP TABLE IF EXISTS email_log; DELETE FROM meta WHERE key = 'mail_last_run';");

// Colonnes ajoutées en v1.3
const loanCols = db.prepare("PRAGMA table_info(loans)").all().map(c => c.name);
if (!loanCols.includes("original_due")) db.exec("ALTER TABLE loans ADD COLUMN original_due TEXT NOT NULL DEFAULT ''");
if (!loanCols.includes("extension_count")) db.exec("ALTER TABLE loans ADD COLUMN extension_count INTEGER NOT NULL DEFAULT 0");

// ---------- Migration v1.2 -> v1.3 : un prêt = plusieurs objets, inventaire ----------
const getMeta = k => (db.prepare("SELECT value FROM meta WHERE key = ?").get(k) || {}).value;
const setMeta = (k, v) => db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, String(v));

tx(() => {
  if (getMeta("items_migrated")) return;
  const loans = db.prepare("SELECT * FROM loans ORDER BY id").all();
  const insItem = db.prepare(`INSERT INTO loan_items (loan_id, item, category, serial, asset_tag, accessories, condition_out, return_date, condition_in, return_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const l of loans) {
    if (db.prepare("SELECT 1 FROM loan_items WHERE loan_id = ?").get(l.id)) continue;
    insItem.run(l.id, l.item, l.category, l.serial, l.asset_tag, l.accessories, l.condition_out, l.return_date, l.condition_in, l.return_notes);
    db.prepare("INSERT INTO loan_events (loan_id, type, at, data) VALUES (?, 'created', ?, '{}')").run(l.id, l.created_at);
    if (l.return_date) db.prepare("INSERT INTO loan_events (loan_id, type, at, data) VALUES (?, 'returned', ?, ?)").run(l.id, l.updated_at, JSON.stringify({ date: l.return_date }));
  }
  // Inventaire initial : un équipement par n° de série déjà prêté (le prêt le plus récent fait foi)
  const items = db.prepare(`SELECT li.*, l.site, l.loan_date FROM loan_items li JOIN loans l ON l.id = li.loan_id ORDER BY l.loan_date DESC, li.id DESC`).all();
  const seen = new Map();
  for (const it of items) {
    const key = it.serial.trim().toLowerCase();
    if (!key) continue;
    let eqId = seen.get(key);
    if (eqId === undefined) {
      const ex = db.prepare("SELECT id FROM equipment WHERE serial = ? COLLATE NOCASE").get(it.serial.trim());
      if (ex) eqId = ex.id;
      else {
        const t = nowIso();
        eqId = Number(db.prepare(`INSERT INTO equipment (name, category, serial, asset_tag, site, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'available', ?, ?)`)
          .run(it.item, it.category, it.serial.trim(), it.asset_tag, it.site, t, t).lastInsertRowid);
      }
      seen.set(key, eqId);
    }
    db.prepare("UPDATE loan_items SET equipment_id = ? WHERE id = ?").run(eqId, it.id);
    if (!it.return_date) db.prepare("UPDATE equipment SET status = 'loaned' WHERE id = ?").run(eqId);
  }
  setMeta("items_migrated", "1");
})();

// ---------- Paramètres partagés ----------
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD.MM.YYYY", "DD-MM-YYYY"];
const THEMES = ["auto", "light", "dark", "indigo", "ocean", "forest", "sunset", "mocha", "nord", "graphite", "rose", "mint"];
const DEFAULT_SETTINGS = {
  orgName: "",
  serviceName: "",
  publicUrl: "",
  defaultLang: "en",
  dateFormat: "DD/MM/YYYY",
  slipPrefix: "PR",
  defaultLoanDays: 14,
  dueSoonDays: 3,
  refreshSeconds: 30,
  requireIssuedBy: false,
  sites: [],
  departments: [],
  categories: [],
  terms: "",
  theme: "auto",
};
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

function sanitizeSettings(input) {
  const out = {};
  const int = (v, min, max, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
  const list = v => (Array.isArray(v) ? v : String(v ?? "").split("\n")).map(x => str(x, 120)).filter(Boolean).slice(0, 200);
  if ("orgName" in input) out.orgName = str(input.orgName);
  if ("serviceName" in input) out.serviceName = str(input.serviceName);
  if ("publicUrl" in input) { const u = str(input.publicUrl, 300).replace(/\/+$/, ""); out.publicUrl = /^https?:\/\//i.test(u) ? u : ""; }
  if ("defaultLang" in input) out.defaultLang = input.defaultLang === "en" ? "en" : "fr";
  if ("slipPrefix" in input) out.slipPrefix = (str(input.slipPrefix, 8).toUpperCase().replace(/[^A-Z0-9]/g, "") || "PR");
  if ("defaultLoanDays" in input) out.defaultLoanDays = int(input.defaultLoanDays, 1, 365, 14);
  if ("dueSoonDays" in input) out.dueSoonDays = int(input.dueSoonDays, 0, 60, 3);
  if ("refreshSeconds" in input) out.refreshSeconds = int(input.refreshSeconds, 10, 600, 30);
  if ("requireIssuedBy" in input) out.requireIssuedBy = !!input.requireIssuedBy;
  for (const k of ["sites", "departments", "categories"]) if (k in input) out[k] = list(input[k]);
  if ("theme" in input) out.theme = THEMES.includes(input.theme) ? input.theme : "auto";
  if ("dateFormat" in input) out.dateFormat = DATE_FORMATS.includes(input.dateFormat) ? input.dateFormat : "DD/MM/YYYY";
  if ("terms" in input) out.terms = str(input.terms, 4000);
  return out;
}
function getSettings() {
  const row = db.prepare("SELECT json FROM settings WHERE id = 1").get();
  let saved = {};
  try { saved = row ? JSON.parse(row.json) : {}; } catch (_) {}
  if (!("terms" in saved) && (saved.termsFr || saved.termsEn)) saved.terms = (saved.defaultLang === "en" ? saved.termsEn || saved.termsFr : saved.termsFr || saved.termsEn) || ""; // v1.7: one slip text
  const rest = {};
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (k in saved) rest[k] = saved[k]; // ignore les anciennes clés (listes d'états, e-mails)
  const logo = db.prepare("SELECT updated_at FROM files WHERE key = 'logo'").get();
  return { ...DEFAULT_SETTINGS, ...rest, logoUpdated: logo ? logo.updated_at : "" };
}

// Purge des anciens réglages e-mail (dont le mot de passe SMTP) enregistrés par la v1.4.0
{
  const row = db.prepare("SELECT json FROM settings WHERE id = 1").get();
  if (row && /"smtp|"mail/.test(row.json)) {
    const { logoUpdated, ...clean } = getSettings();
    db.prepare("UPDATE settings SET json = ? WHERE id = 1").run(JSON.stringify(clean));
  }
}

// ---------- Conversions ----------
const HEADER = {
  borrower: "borrower", department: "department", site: "site", contact: "contact", purpose: "purpose",
  issuedBy: "issued_by", loanDate: "loan_date", dueDate: "due_date", notes: "notes",
};
const ITEM = { item: "item", category: "category", serial: "serial", assetTag: "asset_tag", accessories: "accessories", conditionOut: "condition_out" };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const itemToApi = r => ({
  id: r.id, equipmentId: r.equipment_id ?? null, item: r.item, category: r.category, serial: r.serial,
  assetTag: r.asset_tag, accessories: r.accessories, conditionOut: r.condition_out,
  returnDate: r.return_date, conditionIn: r.condition_in, returnNotes: r.return_notes,
});
const eventToApi = r => { let d = {}; try { d = JSON.parse(r.data); } catch (_) {} return { type: r.type, at: r.at, ...d }; };
const loanToApi = (r, items, events) => ({
  id: r.id, slipNo: r.slip_no, borrower: r.borrower, department: r.department, site: r.site,
  contact: r.contact, purpose: r.purpose, issuedBy: r.issued_by, loanDate: r.loan_date, dueDate: r.due_date,
  originalDue: r.original_due || "", extensionCount: r.extension_count || 0,
  notes: r.notes, returnDate: r.return_date, createdAt: r.created_at, updatedAt: r.updated_at,
  items: items.map(itemToApi), events: events.map(eventToApi),
});
function loadLoan(id) {
  const r = db.prepare("SELECT * FROM loans WHERE id = ?").get(id);
  if (!r) return null;
  return loanToApi(r,
    db.prepare("SELECT * FROM loan_items WHERE loan_id = ? ORDER BY id").all(id),
    db.prepare("SELECT * FROM loan_events WHERE loan_id = ? ORDER BY id").all(id));
}
const addEvent = (loanId, type, data = {}) =>
  db.prepare("INSERT INTO loan_events (loan_id, type, at, data) VALUES (?, ?, ?, ?)").run(loanId, type, nowIso(), JSON.stringify(data));

function cleanHeader(body) {
  const out = {};
  for (const [k, col] of Object.entries(HEADER)) if (body[k] !== undefined) out[col] = str(body[k], 2000);
  return out;
}
function cleanItem(b) {
  const out = {};
  for (const [k, col] of Object.entries(ITEM)) out[col] = str(b[k], 500);
  const eid = Number(b.equipmentId);
  out.equipment_id = b.equipmentId !== null && b.equipmentId !== undefined && b.equipmentId !== "" && Number.isInteger(eid) ? eid : null;
  out.add_to_inventory = !!b.addToInventory;
  out.id = b.id ? Number(b.id) : null;
  return out;
}
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function validateHeader(v) {
  const needDept = getSettings().departments.length > 0;
  if (["borrower", ...(needDept ? ["department"] : []), "loan_date", "due_date"].some(k => !v[k])) throw new HttpError(400, "Champs obligatoires manquants : emprunteur, service et dates.");
  if (!ISO.test(v.loan_date) || !ISO.test(v.due_date)) throw new HttpError(400, "Dates invalides (format AAAA-MM-JJ).");
  if (v.due_date < v.loan_date) throw new HttpError(400, "La date de retour prévue doit être postérieure à la date de prêt.");
}

// Objet non rendu correspondant à cet équipement ou à ce n° de série (hors prêt `exceptLoanId`)
function activeItemFor({ equipmentId, serial }, exceptLoanId = 0) {
  const base = `SELECT li.id, li.item, li.serial, l.id AS loan_id, l.slip_no, l.borrower FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE li.return_date = '' AND l.id != ? AND `;
  return equipmentId
    ? db.prepare(base + "(li.equipment_id = ? OR li.serial = ? COLLATE NOCASE) LIMIT 1").get(exceptLoanId, equipmentId, serial)
    : db.prepare(base + "li.serial = ? COLLATE NOCASE LIMIT 1").get(exceptLoanId, serial);
}

// Relie l'objet à l'inventaire (lien fourni, n° de série connu, ou création) et vérifie qu'il est libre
function prepareItem(it, loanId, site) {
  if (!it.item && !it.equipment_id) throw new HttpError(400, "Chaque objet doit avoir une désignation et un n° de série.");
  let eq = it.equipment_id ? db.prepare("SELECT * FROM equipment WHERE id = ?").get(it.equipment_id) : null;
  if (!eq && it.serial) eq = db.prepare("SELECT * FROM equipment WHERE serial = ? COLLATE NOCASE").get(it.serial);
  if (eq) { it.equipment_id = eq.id; it.item = eq.name; it.serial = eq.serial; it.category = it.category || eq.category; it.asset_tag = it.asset_tag || eq.asset_tag; }
  if (!it.item || !it.serial) throw new HttpError(400, "Chaque objet doit avoir une désignation et un n° de série.");
  const busy = activeItemFor({ equipmentId: eq ? eq.id : null, serial: it.serial }, loanId);
  if (busy) throw new HttpError(409, `« ${it.item} » (S/N ${it.serial}) est déjà prêté : bordereau ${busy.slip_no}, ${busy.borrower}.`);
  if (eq && eq.status === "loaned") throw new HttpError(409, `« ${eq.name} » (S/N ${eq.serial}) est marqué comme prêté dans l'inventaire. Repassez-le en disponible (point vert) avant de le prêter.`);
  if (!eq && it.add_to_inventory) {
    const t = nowIso();
    const id = Number(db.prepare(`INSERT INTO equipment (name, category, serial, asset_tag, site, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'available', ?, ?)`)
      .run(it.item, it.category, it.serial, it.asset_tag, site || "", t, t).lastInsertRowid);
    it.equipment_id = id;
  }
  return it;
}
const insertItem = (loanId, it) => db.prepare(`INSERT INTO loan_items (loan_id, equipment_id, item, category, serial, asset_tag, accessories, condition_out)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(loanId, it.equipment_id, it.item, it.category, it.serial, it.asset_tag, it.accessories, it.condition_out);
const setEquipStatus = (id, status) => { if (id) db.prepare("UPDATE equipment SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), id); };

// Met à jour les colonnes « résumé » du prêt (compatibilité) et sa date de retour globale
function syncLoan(loanId) {
  const items = db.prepare("SELECT * FROM loan_items WHERE loan_id = ? ORDER BY id").all(loanId);
  if (!items.length) return;
  const first = items[0];
  const label = items.length > 1 ? `${first.item} (+${items.length - 1})` : first.item;
  const open = items.filter(i => !i.return_date);
  const ret = open.length ? "" : items.map(i => i.return_date).sort().pop();
  db.prepare("UPDATE loans SET item = ?, category = ?, serial = ?, asset_tag = ?, return_date = ?, updated_at = ? WHERE id = ?")
    .run(label, first.category, first.serial, first.asset_tag, ret, nowIso(), loanId);
}

const nextSlip = year => {
  const prefix = getSettings().slipPrefix || "PR";
  const key = prefix === "PR" ? year : `${prefix}-${year}`;
  db.prepare("INSERT INTO counters (year, last) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last = last + 1").run(key);
  const n = db.prepare("SELECT last FROM counters WHERE year = ?").get(key).last;
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
};

// ---------- Réservations : conflits ----------
const frDate = iso => iso ? iso.split("-").reverse().join("/") : "";
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Réservation active qui chevauche [start, end] pour cet équipement
function reservationClash(equipmentId, start, end, { exceptResId = 0, exceptLoanId = 0 } = {}) {
  return db.prepare(`SELECT r.id, r.res_no, r.borrower, r.start_date, r.end_date FROM reservation_items ri JOIN reservations r ON r.id = ri.reservation_id
    WHERE ri.equipment_id = ? AND r.status = 'active' AND r.id != ? AND (r.loan_id IS NULL OR r.loan_id != ?)
      AND r.start_date <= ? AND r.end_date >= ? ORDER BY r.start_date LIMIT 1`).get(equipmentId, exceptResId, exceptLoanId, end, start);
}
function assertNoReservationClash(items, start, end, opts) {
  for (const it of items) {
    if (!it.equipment_id) continue;
    const c = reservationClash(it.equipment_id, start, end, opts);
    if (c) throw new HttpError(409, `« ${it.item} » est réservé du ${frDate(c.start_date)} au ${frDate(c.end_date)} (${c.res_no}, ${c.borrower}). Changez les dates ou annulez la réservation.`);
  }
}
const nextResNo = year => {
  const key = `RES-${year}`;
  db.prepare("INSERT INTO counters (year, last) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last = last + 1").run(key);
  return `RES-${year}-${String(db.prepare("SELECT last FROM counters WHERE year = ?").get(key).last).padStart(4, "0")}`;
};

// ---------- App ----------
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "3mb" }));

if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    const [type, b64] = (req.headers.authorization || "").split(" ");
    if (type === "Basic" && b64) {
      const [u, ...p] = Buffer.from(b64, "base64").toString().split(":");
      if (u === AUTH_USER && p.join(":") === AUTH_PASS) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Tally"').status(401).send("Authentification requise");
  });
}

const route = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error(e); res.status(500).json({ error: e.message });
  }
};

// CHANGELOG.md -> [{ version, type, sections: { Added: [...], Improved: [...], Fixed: [...] } }], newest first
// type: "initial" | "patch" | "minor" | "major" (from the tag in the heading, else worked out from the number)
function versionType(v) {
  const [maj, min, pat] = v.split(".").map(Number);
  return v === "1.0.0" ? "initial" : pat > 0 ? "patch" : min > 0 ? "minor" : "major";
}
function loadChangelog() {
  let text = "";
  try { text = fs.readFileSync(path.join(__dirname, "CHANGELOG.md"), "utf8"); } catch (_) { return []; }
  const out = []; let cur = null, sec = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^##\s+v?(\d+\.\d+\.\d+)\s*(?:[—–-]\s*(.+?))?\s*$/))) {
      const tag = String(m[2] || "").toLowerCase().match(/initial|patch|minor|major/);
      cur = { version: m[1], type: tag ? tag[0] : versionType(m[1]), sections: {} }; out.push(cur); sec = null;
    }
    else if (cur && (m = line.match(/^###\s+(.+)$/))) { sec = m[1].trim(); cur.sections[sec] = []; }
    else if (cur && sec && (m = line.match(/^[-*]\s+(.+)$/))) cur.sections[sec].push(m[1].trim());
  }
  return out;
}
const CHANGELOG = loadChangelog();
app.get("/api/changelog", (req, res) => res.json(CHANGELOG));
const REPO = String((require("./package.json").repository || {}).url || "").replace(/^git\+/, "").replace(/\.git$/, "");
app.get("/api/version", (req, res) => res.json({ version: VERSION, repo: REPO }));

// --- Prêts ---
app.get("/api/loans", route((req, res) => {
  const loans = db.prepare("SELECT * FROM loans ORDER BY created_at DESC").all();
  const by = rows => rows.reduce((m, r) => ((m[r.loan_id] ||= []).push(r), m), {});
  const ib = by(db.prepare("SELECT * FROM loan_items ORDER BY id").all());
  const eb = by(db.prepare("SELECT * FROM loan_events ORDER BY id").all());
  res.json(loans.map(l => loanToApi(l, ib[l.id] || [], eb[l.id] || [])));
}));

app.post("/api/loans", route((req, res) => {
  const body = req.body || {};
  const h = cleanHeader(body);
  validateHeader(h);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) throw new HttpError(400, "Ajoutez au moins un objet au prêt.");
  if (rawItems.length > 50) throw new HttpError(400, "50 objets maximum par prêt.");
  const id = tx(() => {
    const items = rawItems.map(cleanItem).map(it => prepareItem(it, 0, h.site));
    const serials = items.map(i => i.serial.toLowerCase());
    if (new Set(serials).size !== serials.length) throw new HttpError(400, "Le même n° de série figure deux fois dans ce prêt.");
    const resId = Number(body.reservationId) || 0;
    if (resId) {
      const r = db.prepare("SELECT * FROM reservations WHERE id = ?").get(resId);
      if (!r || r.status !== "active") throw new HttpError(409, "Cette réservation n'est plus active.");
    }
    assertNoReservationClash(items, h.loan_date, h.due_date, { exceptResId: resId });
    const t = nowIso();
    const slip = nextSlip(h.loan_date.slice(0, 4));
    const cols = Object.keys(h);
    const loanId = Number(db.prepare(`INSERT INTO loans (slip_no, item, serial, ${cols.join(",")}, created_at, updated_at)
      VALUES (?, ?, ?, ${cols.map(() => "?").join(",")}, ?, ?)`).run(slip, items[0].item, items[0].serial, ...cols.map(c => h[c]), t, t).lastInsertRowid);
    for (const it of items) { insertItem(loanId, it); setEquipStatus(it.equipment_id, "loaned"); }
    syncLoan(loanId);
    if (resId) {
      db.prepare("UPDATE reservations SET status = 'converted', loan_id = ?, updated_at = ? WHERE id = ?").run(loanId, t, resId);
      const r = db.prepare("SELECT res_no FROM reservations WHERE id = ?").get(resId);
      addEvent(loanId, "created", { items: items.length, reservation: r.res_no });
    } else addEvent(loanId, "created", { items: items.length });
    return loanId;
  })();
  res.status(201).json(loadLoan(id));
}));

app.put("/api/loans/:id", route((req, res) => {
  const cur = db.prepare("SELECT * FROM loans WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Prêt introuvable.");
  const body = req.body || {};
  const h = { ...cur, ...cleanHeader(body) };
  validateHeader(h);
  tx(() => {
    const cols = Object.values(HEADER);
    db.prepare(`UPDATE loans SET ${cols.map(c => `${c} = ?`).join(", ")} WHERE id = ?`).run(...cols.map(c => h[c]), cur.id);
    if (Array.isArray(body.items)) {
      const existing = db.prepare("SELECT * FROM loan_items WHERE loan_id = ?").all(cur.id);
      const incoming = body.items.map(cleanItem);
      const keepIds = new Set(incoming.filter(i => i.id).map(i => i.id));
      for (const ex of existing) {
        if (keepIds.has(ex.id) || ex.return_date) continue; // un objet rendu reste dans l'historique
        db.prepare("DELETE FROM loan_items WHERE id = ?").run(ex.id);
        setEquipStatus(ex.equipment_id, "available");
      }
      for (const it of incoming) {
        if (it.id) {
          const ex = existing.find(e => e.id === it.id);
          if (!ex) continue;
          db.prepare("UPDATE loan_items SET accessories = ?, condition_out = ?, category = ?, asset_tag = ? WHERE id = ?")
            .run(it.accessories, it.condition_out, it.category || ex.category, it.asset_tag || ex.asset_tag, ex.id);
          if (!ex.equipment_id && it.item && it.serial) db.prepare("UPDATE loan_items SET item = ?, serial = ? WHERE id = ?").run(it.item, it.serial, ex.id);
        } else {
          const p = prepareItem(it, cur.id, h.site);
          insertItem(cur.id, p); setEquipStatus(p.equipment_id, "loaned");
        }
      }
      const all = db.prepare("SELECT serial FROM loan_items WHERE loan_id = ?").all(cur.id).map(r => r.serial.toLowerCase());
      if (!all.length) throw new HttpError(400, "Un prêt doit contenir au moins un objet.");
      if (new Set(all).size !== all.length) throw new HttpError(400, "Le même n° de série figure deux fois dans ce prêt.");
    }
    const openNow = db.prepare("SELECT * FROM loan_items WHERE loan_id = ? AND return_date = ''").all(cur.id);
    assertNoReservationClash(openNow, h.loan_date, h.due_date, { exceptLoanId: cur.id });
    syncLoan(cur.id);
    addEvent(cur.id, "edited");
  })();
  res.json(loadLoan(cur.id));
}));

app.post("/api/loans/:id/return", route((req, res) => {
  const cur = db.prepare("SELECT * FROM loans WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Prêt introuvable.");
  const b = req.body || {};
  const date = str(b.returnDate, 10);
  if (!ISO.test(date)) throw new HttpError(400, "Date de retour invalide.");
  tx(() => {
    const open = db.prepare("SELECT * FROM loan_items WHERE loan_id = ? AND return_date = ''").all(cur.id);
    const list = Array.isArray(b.items) ? b.items : open.map(i => ({ id: i.id, conditionIn: b.conditionIn, returnNotes: b.returnNotes }));
    let n = 0;
    for (const r of list) {
      const it = open.find(o => o.id === Number(r.id));
      if (!it) continue;
      db.prepare("UPDATE loan_items SET return_date = ?, condition_in = ?, return_notes = ? WHERE id = ?")
        .run(date, str(r.conditionIn, 60), str(r.returnNotes, 1000), it.id);
      setEquipStatus(it.equipment_id, "available");
      n++;
    }
    if (!n) throw new HttpError(400, "Sélectionnez au moins un objet à rendre.");
    syncLoan(cur.id);
    addEvent(cur.id, "returned", { date, items: n, partial: n < open.length });
  })();
  res.json(loadLoan(cur.id));
}));

app.post("/api/loans/:id/extend", route((req, res) => {
  const cur = db.prepare("SELECT * FROM loans WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Prêt introuvable.");
  if (cur.return_date) throw new HttpError(400, "Ce prêt est déjà rendu.");
  const b = req.body || {};
  const due = str(b.dueDate, 10);
  if (!ISO.test(due)) throw new HttpError(400, "Nouvelle date invalide.");
  if (due <= cur.due_date) throw new HttpError(400, "La nouvelle date doit être postérieure à la date de retour actuelle.");
  const openNow = db.prepare("SELECT * FROM loan_items WHERE loan_id = ? AND return_date = ''").all(cur.id);
  assertNoReservationClash(openNow, cur.loan_date, due, { exceptLoanId: cur.id });
  tx(() => {
    db.prepare(`UPDATE loans SET original_due = CASE WHEN original_due = '' THEN due_date ELSE original_due END,
                due_date = ?, extension_count = extension_count + 1, updated_at = ? WHERE id = ?`).run(due, nowIso(), cur.id);
    addEvent(cur.id, "extended", { from: cur.due_date, to: due, reason: str(b.reason, 300) });
  })();
  res.json(loadLoan(cur.id));
}));

// --- Annuler une suppression : instantané en mémoire, rétabli avec les mêmes identifiants ---
const undoStore = new Map();
function stash(kind, data) {
  const now = Date.now();
  for (const [k, v] of undoStore) if (now - v.at > 15 * 60 * 1000) undoStore.delete(k);
  while (undoStore.size >= 50) undoStore.delete(undoStore.keys().next().value);
  const token = require("crypto").randomUUID();
  undoStore.set(token, { kind, data, at: now });
  return token;
}
function insertRow(table, row) {
  const cols = Object.keys(row);
  db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map(c => row[c]));
}
app.post("/api/undo/:token", route((req, res) => {
  const entry = undoStore.get(req.params.token);
  if (!entry) throw new HttpError(410, "Cette suppression ne peut plus être annulée.");
  const d = entry.data;
  tx(() => {
    if (entry.kind === "loan") {
      if (db.prepare("SELECT 1 FROM loans WHERE id = ?").get(d.loan.id)) throw new HttpError(409, "Ce prêt existe déjà.");
      const open = d.items.filter(i => !i.return_date);
      for (const it of open) {
        const busy = activeItemFor({ equipmentId: it.equipment_id, serial: it.serial });
        if (busy) throw new HttpError(409, `Impossible d'annuler : « ${it.item} » est maintenant sur le prêt ${busy.slip_no}.`);
        if (it.equipment_id) {
          const c = reservationClash(it.equipment_id, d.loan.loan_date, d.loan.due_date);
          if (c) throw new HttpError(409, `Impossible d'annuler : « ${it.item} » est réservé du ${frDate(c.start_date)} au ${frDate(c.end_date)} (${c.res_no}).`);
        }
      }
      insertRow("loans", d.loan);
      for (const it of d.items) {
        if (it.equipment_id && !db.prepare("SELECT 1 FROM equipment WHERE id = ?").get(it.equipment_id)) it.equipment_id = null;
        insertRow("loan_items", it);
        if (!it.return_date && it.equipment_id) setEquipStatus(it.equipment_id, "loaned");
      }
      for (const ev of d.events) insertRow("loan_events", ev);
    } else if (entry.kind === "equipment") {
      insertRow("equipment", d.equipment);
      for (const id of d.loanItemIds) db.prepare("UPDATE loan_items SET equipment_id = ? WHERE id = ?").run(d.equipment.id, id);
    } else if (entry.kind === "reservation") {
      if (d.reservation.status === "active") for (const it of d.items) {
        const c = it.equipment_id && reservationClash(it.equipment_id, d.reservation.start_date, d.reservation.end_date);
        if (c) throw new HttpError(409, `Impossible d'annuler : le matériel est maintenant réservé du ${frDate(c.start_date)} au ${frDate(c.end_date)} (${c.res_no}).`);
      }
      insertRow("reservations", d.reservation);
      for (const it of d.items) insertRow("reservation_items", it);
    }
  })();
  undoStore.delete(req.params.token);
  res.json({ ok: true, kind: entry.kind });
}));

app.delete("/api/loans/:id", route((req, res) => {
  const cur = db.prepare("SELECT * FROM loans WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Prêt introuvable.");
  const token = stash("loan", { loan: cur, items: db.prepare("SELECT * FROM loan_items WHERE loan_id = ?").all(cur.id), events: db.prepare("SELECT * FROM loan_events WHERE loan_id = ?").all(cur.id) });
  tx(() => {
    for (const it of db.prepare("SELECT * FROM loan_items WHERE loan_id = ? AND return_date = ''").all(cur.id)) setEquipStatus(it.equipment_id, "available");
    db.prepare("DELETE FROM loan_items WHERE loan_id = ?").run(cur.id);
    db.prepare("DELETE FROM loan_events WHERE loan_id = ?").run(cur.id);
    db.prepare("DELETE FROM loans WHERE id = ?").run(cur.id);
  })();
  res.json({ undo: token });
}));

// --- Inventaire ---
const EQ = { name: "name", category: "category", serial: "serial", assetTag: "asset_tag", site: "site", notes: "notes" };
const eqToApi = r => ({ id: r.id, name: r.name, category: r.category, serial: r.serial, assetTag: r.asset_tag, site: r.site, notes: r.notes, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });
function cleanEq(b) { const o = {}; for (const [k, c] of Object.entries(EQ)) if (b[k] !== undefined) o[c] = str(b[k], k === "notes" ? 2000 : 200); return o; }

app.get("/api/equipment", route((req, res) => {
  const rows = db.prepare("SELECT * FROM equipment ORDER BY name COLLATE NOCASE, serial").all();
  const active = db.prepare(`SELECT li.equipment_id, l.id AS loan_id, l.slip_no, l.borrower, l.department, l.due_date FROM loan_items li
    JOIN loans l ON l.id = li.loan_id WHERE li.return_date = '' AND li.equipment_id IS NOT NULL`).all();
  const byEq = Object.fromEntries(active.map(a => [a.equipment_id, { loanId: a.loan_id, slipNo: a.slip_no, borrower: a.borrower, department: a.department, dueDate: a.due_date }]));
  const upcoming = db.prepare(`SELECT ri.equipment_id, r.id, r.res_no, r.borrower, r.start_date, r.end_date FROM reservation_items ri
    JOIN reservations r ON r.id = ri.reservation_id WHERE r.status = 'active' AND r.end_date >= ? ORDER BY r.start_date`).all(localToday());
  const nextRes = {};
  for (const u of upcoming) if (!nextRes[u.equipment_id]) nextRes[u.equipment_id] = { id: u.id, resNo: u.res_no, borrower: u.borrower, startDate: u.start_date, endDate: u.end_date };
  res.json(rows.map(r => ({ ...eqToApi(r), currentLoan: byEq[r.id] || null, nextReservation: nextRes[r.id] || null })));
}));

app.post("/api/equipment", route((req, res) => {
  const v = cleanEq(req.body || {});
  if (!v.name || !v.serial) throw new HttpError(400, "La désignation et le n° de série sont obligatoires.");
  if (db.prepare("SELECT 1 FROM equipment WHERE serial = ? COLLATE NOCASE").get(v.serial)) throw new HttpError(409, `Le n° de série ${v.serial} existe déjà dans l'inventaire.`);
  const t = nowIso();
  const status = req.body.status === "loaned" ? "loaned" : "available";
  const id = db.prepare(`INSERT INTO equipment (name, category, serial, asset_tag, site, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(v.name, v.category || "", v.serial, v.asset_tag || "", v.site || "", v.notes || "", status, t, t).lastInsertRowid;
  res.status(201).json(eqToApi(db.prepare("SELECT * FROM equipment WHERE id = ?").get(id)));
}));

app.post("/api/equipment/import", route((req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) throw new HttpError(400, "Aucune ligne à importer.");
  if (rows.length > 5000) throw new HttpError(400, "Trop de lignes (5000 maximum).");
  const seen = new Set(), out = { added: 0, duplicates: 0, invalid: 0 };
  const t = nowIso();
  const ins = db.prepare(`INSERT INTO equipment (name, category, serial, asset_tag, site, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?)`);
  tx(() => {
    for (const r of rows) {
      const v = cleanEq(r || {});
      if (!v.name || !v.serial) { out.invalid++; continue; }
      const key = v.serial.toLowerCase();
      if (seen.has(key) || db.prepare("SELECT 1 FROM equipment WHERE serial = ? COLLATE NOCASE").get(v.serial)) { out.duplicates++; continue; }
      seen.add(key);
      ins.run(v.name, v.category || "", v.serial, v.asset_tag || "", v.site || "", v.notes || "", t, t);
      out.added++;
    }
  })();
  res.json(out);
}));

app.put("/api/equipment/:id", route((req, res) => {
  const cur = db.prepare("SELECT * FROM equipment WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Équipement introuvable.");
  const v = { ...cur, ...cleanEq(req.body || {}) };
  if (!v.name || !v.serial) throw new HttpError(400, "La désignation et le n° de série sont obligatoires.");
  if (db.prepare("SELECT 1 FROM equipment WHERE serial = ? COLLATE NOCASE AND id != ?").get(v.serial, cur.id)) throw new HttpError(409, `Le n° de série ${v.serial} existe déjà dans l'inventaire.`);
  db.prepare("UPDATE equipment SET name = ?, category = ?, serial = ?, asset_tag = ?, site = ?, notes = ?, updated_at = ? WHERE id = ?")
    .run(v.name, v.category, v.serial, v.asset_tag, v.site, v.notes, nowIso(), cur.id);
  res.json(eqToApi(db.prepare("SELECT * FROM equipment WHERE id = ?").get(cur.id)));
}));

app.post("/api/equipment/:id/status", route((req, res) => {
  const cur = db.prepare("SELECT * FROM equipment WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Équipement introuvable.");
  const status = req.body && req.body.status === "loaned" ? "loaned" : "available";
  if (status === "available") {
    const busy = activeItemFor({ equipmentId: cur.id, serial: cur.serial });
    if (busy) return res.status(409).json({ error: `Cet équipement est sur le prêt ${busy.slip_no} (${busy.borrower}). Enregistrez le retour pour le rendre disponible.`, code: "on_loan", loanId: busy.loan_id });
  }
  setEquipStatus(cur.id, status);
  res.json(eqToApi(db.prepare("SELECT * FROM equipment WHERE id = ?").get(cur.id)));
}));

app.delete("/api/equipment/:id", route((req, res) => {
  const cur = db.prepare("SELECT * FROM equipment WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Équipement introuvable.");
  const busy = activeItemFor({ equipmentId: cur.id, serial: cur.serial });
  if (busy) throw new HttpError(409, `Impossible de supprimer : l'équipement est sur le prêt ${busy.slip_no}.`);
  const resv = reservationClash(cur.id, localToday(), "9999-12-31");
  if (resv) throw new HttpError(409, `Impossible de supprimer : l'équipement est réservé (${resv.res_no}, ${resv.borrower}).`);
  const token = stash("equipment", { equipment: cur, loanItemIds: db.prepare("SELECT id FROM loan_items WHERE equipment_id = ?").all(cur.id).map(r => r.id) });
  tx(() => {
    db.prepare("UPDATE loan_items SET equipment_id = NULL WHERE equipment_id = ?").run(cur.id); // l'historique garde désignation et n° de série
    db.prepare("DELETE FROM equipment WHERE id = ?").run(cur.id);
  })();
  res.json({ undo: token });
}));

// --- Réservations ---
const RES = { borrower: "borrower", department: "department", site: "site", contact: "contact", purpose: "purpose", notes: "notes", bookedBy: "booked_by", startDate: "start_date", endDate: "end_date" };
const resToApi = (r, items) => ({
  id: r.id, resNo: r.res_no, borrower: r.borrower, department: r.department, site: r.site, contact: r.contact, purpose: r.purpose,
  notes: r.notes, bookedBy: r.booked_by, startDate: r.start_date, endDate: r.end_date, status: r.status, loanId: r.loan_id ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
  items: items.map(i => ({ id: i.id, equipmentId: i.equipment_id ?? null, item: i.item, serial: i.serial, category: i.category })),
});
const loadRes = id => { const r = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id); return r && resToApi(r, db.prepare("SELECT * FROM reservation_items WHERE reservation_id = ? ORDER BY id").all(id)); };

function saveReservation(body, existing) {
  const v = existing ? { ...existing } : {};
  for (const [k, c] of Object.entries(RES)) if (body[k] !== undefined) v[c] = str(body[k], 2000);
  if (!v.borrower || (!v.department && getSettings().departments.length > 0)) throw new HttpError(400, "Indiquez l'emprunteur et le service.");
  if (!ISO.test(v.start_date || "") || !ISO.test(v.end_date || "")) throw new HttpError(400, "Dates invalides.");
  if (v.end_date < v.start_date) throw new HttpError(400, "La date de fin doit être postérieure au début.");
  let ids = [...new Set((Array.isArray(body.items) ? body.items : []).map(i => Number(i.equipmentId)).filter(Boolean))];
  if (!ids.length && existing) ids = db.prepare("SELECT equipment_id FROM reservation_items WHERE reservation_id = ? AND equipment_id IS NOT NULL").all(existing.id).map(r => r.equipment_id);
  if (!ids.length) throw new HttpError(400, "Choisissez au moins un équipement de l'inventaire.");
  const resId = existing ? existing.id : 0;
  const eqs = ids.map(id => {
    const eq = db.prepare("SELECT * FROM equipment WHERE id = ?").get(id);
    if (!eq) throw new HttpError(400, "Équipement introuvable dans l'inventaire.");
    const c = reservationClash(eq.id, v.start_date, v.end_date, { exceptResId: resId });
    if (c) throw new HttpError(409, `« ${eq.name} » est déjà réservé du ${frDate(c.start_date)} au ${frDate(c.end_date)} (${c.res_no}, ${c.borrower}).`);
    const out = db.prepare(`SELECT l.slip_no, l.borrower, l.due_date FROM loan_items li JOIN loans l ON l.id = li.loan_id
      WHERE li.equipment_id = ? AND li.return_date = '' LIMIT 1`).get(eq.id);
    if (out && out.due_date >= v.start_date) throw new HttpError(409, `« ${eq.name} » est prêté jusqu'au ${frDate(out.due_date)} (${out.slip_no}, ${out.borrower}).`);
    if (out && out.due_date < localToday()) throw new HttpError(409, `« ${eq.name} » n'est pas encore rendu : retour prévu le ${frDate(out.due_date)} (${out.slip_no}, ${out.borrower}).`);
    return eq;
  });
  const t = nowIso();
  return tx(() => {
    let id = resId;
    if (existing) {
      db.prepare(`UPDATE reservations SET ${Object.values(RES).map(c => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...Object.values(RES).map(c => v[c] ?? ""), t, id);
    } else {
      id = Number(db.prepare(`INSERT INTO reservations (res_no, ${Object.values(RES).join(",")}, created_at, updated_at) VALUES (?, ${Object.values(RES).map(() => "?").join(",")}, ?, ?)`)
        .run(nextResNo(v.start_date.slice(0, 4)), ...Object.values(RES).map(c => v[c] ?? ""), t, t).lastInsertRowid);
    }
    {
      db.prepare("DELETE FROM reservation_items WHERE reservation_id = ?").run(id);
      for (const eq of eqs) db.prepare("INSERT INTO reservation_items (reservation_id, equipment_id, item, serial, category) VALUES (?, ?, ?, ?, ?)").run(id, eq.id, eq.name, eq.serial, eq.category);
    }
    return id;
  })();
}

app.get("/api/reservations", route((req, res) => {
  const rows = db.prepare("SELECT * FROM reservations ORDER BY start_date DESC, id DESC").all();
  const items = db.prepare("SELECT * FROM reservation_items ORDER BY id").all().reduce((m, r) => ((m[r.reservation_id] ||= []).push(r), m), {});
  res.json(rows.map(r => resToApi(r, items[r.id] || [])));
}));
app.post("/api/reservations", route((req, res) => { res.status(201).json(loadRes(saveReservation(req.body || {}, null))); }));
app.put("/api/reservations/:id", route((req, res) => {
  const cur = db.prepare("SELECT * FROM reservations WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Réservation introuvable.");
  if (cur.status !== "active") throw new HttpError(409, "Seule une réservation active peut être modifiée.");
  res.json(loadRes(saveReservation(req.body || {}, cur)));
}));
app.post("/api/reservations/:id/cancel", route((req, res) => {
  const cur = db.prepare("SELECT * FROM reservations WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Réservation introuvable.");
  if (cur.status !== "active") throw new HttpError(409, "Cette réservation n'est plus active.");
  db.prepare("UPDATE reservations SET status = 'cancelled', updated_at = ? WHERE id = ?").run(nowIso(), cur.id);
  res.json(loadRes(cur.id));
}));
app.delete("/api/reservations/:id", route((req, res) => {
  const cur = db.prepare("SELECT * FROM reservations WHERE id = ?").get(req.params.id);
  if (!cur) throw new HttpError(404, "Réservation introuvable.");
  const token = stash("reservation", { reservation: cur, items: db.prepare("SELECT * FROM reservation_items WHERE reservation_id = ?").all(cur.id) });
  tx(() => {
    db.prepare("DELETE FROM reservation_items WHERE reservation_id = ?").run(req.params.id);
    db.prepare("DELETE FROM reservations WHERE id = ?").run(req.params.id);
  })();
  res.json({ undo: token });
}));

// --- Paramètres, sauvegarde ---
app.get("/api/settings", (req, res) => res.json(getSettings()));

// --- Logo du bordereau (stocké dans la base pour être inclus dans les sauvegardes) ---
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
app.get("/api/logo", (req, res) => {
  const f = db.prepare("SELECT mime, data FROM files WHERE key = 'logo'").get();
  if (!f) return res.status(404).json({ error: "Aucun logo." });
  res.set({ "Content-Type": f.mime, "Cache-Control": "no-cache", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" });
  res.send(Buffer.from(f.data));
});
app.put("/api/logo", express.raw({ type: () => true, limit: "1mb" }), route((req, res) => {
  const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!LOGO_TYPES.includes(mime)) throw new HttpError(400, "Format non pris en charge : utilisez PNG, JPEG, WebP, GIF ou SVG.");
  if (!req.body || !req.body.length) throw new HttpError(400, "Fichier vide.");
  db.prepare("INSERT INTO files (key, mime, data, updated_at) VALUES ('logo', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at")
    .run(mime, req.body, nowIso());
  res.json(getSettings());
}));
app.delete("/api/logo", (req, res) => { db.prepare("DELETE FROM files WHERE key = 'logo'").run(); res.json(getSettings()); });
app.put("/api/settings", (req, res) => {
  const { logoUpdated, ...cur } = getSettings();
  const next = { ...cur, ...sanitizeSettings(req.body || {}) };
  db.prepare("INSERT INTO settings (id, json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(JSON.stringify(next));
  res.json(getSettings());
});
app.get("/api/backup", (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  const tmp = path.join(DATA_DIR, `backup-${Date.now()}.db`);
  try { db.prepare("VACUUM INTO ?").run(tmp); }
  catch (e) { return res.status(500).json({ error: "Sauvegarde impossible : " + e.message }); }
  res.download(tmp, `registre-prets-${stamp}.db`, () => fs.unlink(tmp, () => {}));
});

app.get("/vendor/qrcode.js", (req, res) => res.sendFile(require.resolve("qrcode-generator/qrcode.js")));
// Landing page at "/" and the app itself at "/app". The link-preview tags need absolute URLs, so fill in this server's address.
const APP_HTML = fs.readFileSync(path.join(__dirname, "public", "app.html"), "utf8");
const LANDING_HTML = fs.readFileSync(path.join(__dirname, "public", "landing.html"), "utf8");
const originOf = req => {
  const configured = getSettings().publicUrl;
  const proto = String(req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
  return (configured || `${proto}://${req.get("host")}`).replace(/[<>"']/g, "");
};
const REPO_URL = (/^https:\/\//.test(REPO) ? REPO : "https://github.com/Alex-Mlts/tally").replace(/[<>"']/g, "");
app.get(["/", "/index.html"], (req, res) => {
  res.type("html").set("Cache-Control", "no-cache").send(LANDING_HTML
    .replace(/__ORIGIN__/g, originOf(req)).replace(/__VERSION__/g, VERSION).replace(/__REPO__/g, REPO_URL).replace(/__LANG__/g, getSettings().defaultLang === "fr" ? "fr" : "en"));
});
app.get(["/app", "/app/", "/app.html"], (req, res) => {
  res.type("html").set("Cache-Control", "no-cache").send(APP_HTML.replace(/__ORIGIN__/g, originOf(req)));
});
app.use(express.static(path.join(__dirname, "public")));

// Anything else: JSON 404 for the API, the custom 404 page for the browser
const NOT_FOUND_HTML = fs.readFileSync(path.join(__dirname, "public", "404.html"), "utf8");
app.use("/api", (req, res) => res.status(404).json({ error: "Introuvable." }));
app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(404).type("text").send("Not found");
  res.status(404).type("html").set("Cache-Control", "no-cache").send(NOT_FOUND_HTML);
});

app.listen(PORT, () => {
  console.log(`Tally v${VERSION} : http://localhost:${PORT}  (données : ${DATA_DIR})`);
  if (!AUTH_USER) console.log("Attention : aucune authentification (définissez AUTH_USER et AUTH_PASS).");
});
