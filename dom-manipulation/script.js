// =====================================================
// Core data + storage
// =====================================================
const LS_QUOTES_KEY = "quotes";
const LS_LAST_CATEGORY = "lastCategory";
const LS_LAST_SYNC_AT = "lastSyncAt";

let quotes = [
  { id: "local-" + Date.now(), text: "Creativity is intelligence having fun.", category: "Creativity", updatedAt: nowIso(), source: "local" },
  { id: "local-" + (Date.now()+1), text: "Your time is limited, so don’t waste it living someone else’s life.", category: "Inspiration", updatedAt: nowIso(), source: "local" },
  { id: "local-" + (Date.now()+2), text: "Success is not final; failure is not fatal: It is the courage to continue that counts.", category: "Motivation", updatedAt: nowIso(), source: "local" }
];

function nowIso() { return new Date().toISOString(); }
function saveQuotes() { localStorage.setItem(LS_QUOTES_KEY, JSON.stringify(quotes)); }
function loadQuotes() {
  const stored = localStorage.getItem(LS_QUOTES_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    // Defensive: add missing fields for older saves
    quotes = parsed.map(q => ({
      id: q.id || ("local-" + Math.random().toString(16).slice(2)),
      text: q.text,
      category: q.category || "General",
      updatedAt: q.updatedAt || nowIso(),
      source: q.source || (String(q.id || "").startsWith("srv-") ? "server" : "local")
    }));
  }
}
function saveLastCategory(cat) { localStorage.setItem(LS_LAST_CATEGORY, cat); }
function loadLastCategory() { return localStorage.getItem(LS_LAST_CATEGORY) || "all"; }
function getLastSyncAt() { return localStorage.getItem(LS_LAST_SYNC_AT); }
function setLastSyncAt(iso) { localStorage.setItem(LS_LAST_SYNC_AT, iso); updateLastSyncLabel(); }

// =====================================================
// DOM
// =====================================================
const quoteDisplay   = document.getElementById("quoteDisplay");
const categoryFilter = document.getElementById("categoryFilter");
const conflictListEl = document.getElementById("conflictList");
const conflictCountEl= document.getElementById("conflictCount");
const syncStatusEl   = document.getElementById("syncStatus");
const lastSyncLabel  = document.getElementById("lastSyncAt");

// Build Add Quote form programmatically
function createAddQuoteForm() {
  const formContainer = document.getElementById("formContainer");
  formContainer.innerHTML = "";

  const textInput = document.createElement("input");
  textInput.id = "newQuoteText"; textInput.type = "text"; textInput.placeholder = "Enter a new quote"; textInput.size = 40;

  const categoryInput = document.createElement("input");
  categoryInput.id = "newQuoteCategory"; categoryInput.type = "text"; categoryInput.placeholder = "Enter quote category";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Quote";
  addBtn.addEventListener("click", addQuote);

  formContainer.append(textInput, categoryInput, addBtn);
}

// Categories
function populateCategories() {
  const selectedBefore = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  const cats = [...new Set(quotes.map(q => q.category))].sort();
  cats.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat; opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
  const last = loadLastCategory();
  categoryFilter.value = cats.includes(last) ? last : "all";
  // If user had a manual selection right now, prefer it (keeps UX snappy)
  if (selectedBefore && selectedBefore !== categoryFilter.value) {
    categoryFilter.value = selectedBefore;
  }
}

// Display logic
function filterQuotes() {
  const cat = categoryFilter.value;
  saveLastCategory(cat);
  const pool = (cat === "all") ? quotes : quotes.filter(q => q.category === cat);
  if (!pool.length) {
    quoteDisplay.textContent = "No quotes found for this category.";
    return;
  }
  const random = pool[Math.floor(Math.random()*pool.length)];
  quoteDisplay.textContent = `"${random.text}" — ${random.category} ${random.source === "server" ? "(from server)" : ""}`;
}
function showRandomQuote() { filterQuotes(); }

// Add quote
function addQuote() {
  const textEl = document.getElementById("newQuoteText");
  const catEl  = document.getElementById("newQuoteCategory");
  const text = textEl.value.trim();
  const category = catEl.value.trim() || "General";
  if (!text) { alert("Please enter a quote."); return; }

  const q = { id: "local-" + Date.now() + "-" + Math.random().toString(16).slice(2),
              text, category, updatedAt: nowIso(), source: "local", syncState: "pending" };
  quotes.push(q);
  saveQuotes();
  populateCategories();
  filterQuotes();

  textEl.value = ""; catEl.value = "";
  toast("Quote added locally. Will sync on next cycle.");
}

// =====================================================
// --- SYNC: mock server (JSONPlaceholder) + conflict handling
// =====================================================
const SERVER_BASE = "https://jsonplaceholder.typicode.com";
const POLL_MS = 30000; // 30s
let syncTimer = null;
let conflictQueue = []; // [{id, localVersion, serverVersion}]

function updateLastSyncLabel() {
  const v = getLastSyncAt();
  lastSyncLabel.textContent = v ? new Date(v).toLocaleString() : "—";
}

function toast(msg) {
  syncStatusEl.textContent = msg;
  // Clear after a moment
  setTimeout(() => { if (syncStatusEl.textContent === msg) syncStatusEl.textContent = "Idle."; }, 4000);
}

// Map server post -> app quote
function serverPostToQuote(post) {
  // Use body as text; derive a lightweight category
  const category = "API";
  return {
    id: "srv-" + post.id,
    text: String(post.body || post.title || "").trim() || "(empty)",
    category,
    updatedAt: nowIso(),      // JSONPlaceholder doesn’t version; we stamp now
    source: "server"
  };
}

// Fetch latest “server” quotes
async function fetchServerQuotes(limit = 10) {
  const res = await fetch(`${SERVER_BASE}/posts?_limit=${limit}`);
  if (!res.ok) throw new Error("Server fetch failed");
  const posts = await res.json();
  return posts.map(serverPostToQuote);
}

// Push local-only quotes to “server”
async function pushLocalPending() {
  // Only quotes created locally (ids starting with local-)
  const locals = quotes.filter(q => String(q.id).startsWith("local-"));
  if (!locals.length) return { pushed: 0, remapped: 0 };

  let pushed = 0, remapped = 0;
  for (const q of locals) {
    try {
      const body = { title: q.category, body: q.text, userId: 1 };
      const res = await fetch(`${SERVER_BASE}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      // JSONPlaceholder returns an object with an id (not persisted)
      if (res.ok) {
        const created = await res.json();
        // Remap local id to serverish id so future merges treat it as server-backed
        const newId = "srv-" + created.id;
        q.id = newId;
        q.source = "server";
        q.updatedAt = nowIso();
        pushed++; remapped++;
      }
    } catch {
      // Swallow; will retry next cycle
    }
  }
  return { pushed, remapped };
}

// Merge server quotes into local, detect conflicts
function mergeServerIntoLocal(serverQuotes) {
  const localById = new Map(quotes.map(q => [q.id, q]));
  const existingIds = new Set(localById.keys());
  let added = 0, overwritten = 0;

  for (const srv of serverQuotes) {
    if (!existingIds.has(srv.id)) {
      quotes.push(srv);
      added++;
      continue;
    }
    const local = localById.get(srv.id);

    // Conflict if text differs (simple rule). Server precedence by default.
    if (local.text !== srv.text || local.category !== srv.category) {
      // Record conflict for UI (server wins immediately)
      conflictQueue.push({ id: srv.id, localVersion: { ...local }, serverVersion: { ...srv } });
      // Apply server version
      local.text = srv.text;
      local.category = srv.category;
      local.source = "server";
      local.updatedAt = srv.updatedAt;
      overwritten++;
    }
  }
  // Persist changes
  if (added || overwritten) {
    saveQuotes();
    populateCategories();
    filterQuotes();
  }
  return { added, overwritten, conflicts: conflictQueue.length };
}

// Render conflicts UI
function renderConflicts() {
  conflictCountEl.textContent = String(conflictQueue.length);
  conflictListEl.innerHTML = "";
  if (!conflictQueue.length) return;

  conflictQueue.forEach((c, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "conflict";

    const hdr = document.createElement("div");
    hdr.className = "row";
    hdr.innerHTML = `<strong>Conflict on ID:</strong> <code>${c.id}</code> <span class="tag">server wins by default</span>`;

    const body = document.createElement("div");
    body.innerHTML = `
      <div><strong>Server:</strong> "${c.serverVersion.text}" — ${c.serverVersion.category}</div>
      <div><strong>Local:</strong> "${c.localVersion.text}" — ${c.localVersion.category}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "row";
    const keepServer = document.createElement("button");
    keepServer.textContent = "Keep Server";
    keepServer.addEventListener("click", () => {
      // Server is already applied; just remove from queue
      conflictQueue.splice(idx, 1);
      renderConflicts();
      toast("Kept server version.");
    });

    const keepLocal = document.createElement("button");
    keepLocal.textContent = "Keep Local";
    keepLocal.addEventListener("click", () => {
      // Restore local version over server-applied data
      const i = quotes.findIndex(q => q.id === c.id);
      if (i >= 0) {
        quotes[i] = { ...quotes[i], ...c.localVersion, updatedAt: nowIso(), source: "local" };
        saveQuotes();
        populateCategories();
        filterQuotes();
      }
      conflictQueue.splice(idx, 1);
      renderConflicts();
      toast("Restored local version.");
    });

    actions.append(keepServer, keepLocal);
    wrap.append(hdr, body, actions);
    conflictListEl.appendChild(wrap);
  });
}

// One sync cycle
async function syncWithServer() {
  try {
    syncStatusEl.textContent = "Syncing…";

    // 1) Pull server quotes
    const serverQuotes = await fetchServerQuotes(10);

    // 2) Merge (server precedence)
    const mergeRes = mergeServerIntoLocal(serverQuotes);

    // 3) Push local-only quotes (best effort)
    const pushRes = await pushLocalPending();

    setLastSyncAt(nowIso());
    const msg = [
      `Synced`,
      `${mergeRes.added} new from server`,
      `${mergeRes.overwritten} overwritten`,
      `${pushRes.remapped} pushed`
    ].join(" • ");
    toast(msg);
  } catch (e) {
    syncStatusEl.textContent = "Sync failed (network?). Will retry.";
  } finally {
    renderConflicts();
  }
}

// Start periodic polling
function startPolling() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(syncWithServer, POLL_MS);
}

// =====================================================
// Boot
// =====================================================
loadQuotes();
createAddQuoteForm();
populateCategories();
document.getElementById("newQuote").addEventListener("click", showRandomQuote);
document.getElementById("syncNow").addEventListener("click", syncWithServer);
updateLastSyncLabel();
filterQuotes();
startPolling();
