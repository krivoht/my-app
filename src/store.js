// Jednoduché úložiště v localStorage tohoto zařízení.
const ENTRIES_KEY = "kalorie.entries.v1";
const SETTINGS_KEY = "kalorie.settings.v1";

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
  } catch (err) {
    console.error("Uložení selhalo", err);
    return false;
  }
}

export function getSettings() {
  return { apiKey: "", model: "", goal: 2000, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  return write(SETTINGS_KEY, settings);
}

export function getEntries() {
  return read(ENTRIES_KEY, []);
}

export function saveEntries(entries) {
  return write(ENTRIES_KEY, entries);
}

export function addEntry(entry) {
  const entries = getEntries();
  entries.push(entry);
  return saveEntries(entries);
}

export function updateEntry(id, patch) {
  const entries = getEntries().map((e) => (e.id === id ? { ...e, ...patch } : e));
  return saveEntries(entries);
}

export function deleteEntry(id) {
  return saveEntries(getEntries().filter((e) => e.id !== id));
}

export function dayKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function entriesForDay(key) {
  return getEntries()
    .filter((e) => dayKey(e.timestamp) === key)
    .sort((a, b) => a.timestamp - b.timestamp);
}
