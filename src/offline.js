// Offline support: a local copy of the last-loaded data so the app opens
// without signal, and a queue of writes made while offline that get sent
// when the connection comes back.
//
// Only planting writes are queued. Map layout changes (bed counts, marker
// positions, names) are developer-only and require a connection — queuing
// those would mean merging conflicting layouts, which isn't worth it.

import { supabase } from "./supabaseClient";

const CACHE_KEY = "pm_cache_v1";
const QUEUE_KEY = "pm_queue_v1";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode or quota — the app still works, just online-only
  }
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

// --- Last-known data ---
export function loadCache() {
  return read(CACHE_KEY, null);
}
export function saveCache(locations, plantings, isDeveloper) {
  write(CACHE_KEY, { locations, plantings, isDeveloper, savedAt: new Date().toISOString() });
}

// --- Pending writes ---
export function getQueue() {
  return read(QUEUE_KEY, []);
}
function setQueue(q) {
  write(QUEUE_KEY, q);
}
export function enqueue(op) {
  const q = getQueue();
  q.push({ ...op, queuedAt: Date.now() });
  setQueue(q);
  return q.length;
}

async function applyOp(op) {
  if (op.type === "upsert") {
    const { error } = await supabase.from("plantings").upsert(op.row);
    return !error;
  }
  if (op.type === "delete") {
    const { error } = await supabase.from("plantings").delete().eq("id", op.id);
    return !error;
  }
  return true; // unknown op — drop it rather than blocking the queue forever
}

// Sends queued writes oldest-first. Stops at the first failure so ordering is
// preserved: an edit that follows a create never lands before it.
export async function flushQueue() {
  if (!isOnline()) return { flushed: 0, remaining: getQueue().length, failed: false };
  let q = getQueue();
  let flushed = 0;
  while (q.length) {
    const ok = await applyOp(q[0]);
    if (!ok) return { flushed, remaining: q.length, failed: true };
    q = q.slice(1);
    setQueue(q);
    flushed++;
  }
  return { flushed, remaining: 0, failed: false };
}
