import "./style.css";
import { analyzeMeal, MODELS, DEFAULT_MODEL } from "./claude.js";
import { prepareImage } from "./image.js";
import {
  getSettings,
  saveSettings,
  getEntries,
  saveEntries,
  addEntry,
  deleteEntry,
  entriesForDay,
  dayKey,
} from "./store.js";

const $ = (id) => document.getElementById(id);

const state = {
  day: new Date(),
  image: null, // { base64, thumbDataUrl }
  result: null,
};

// ---------- Navigace mezi obrazovkami ----------
function show(view) {
  for (const id of ["day-view", "add-view", "settings-view"]) {
    $(id).hidden = id !== view;
  }
  $("add-btn").hidden = view !== "day-view";
  window.scrollTo(0, 0);
}

// ---------- Přehled dne ----------
const round = (n) => Math.round(Number(n) || 0);

function formatDay(date) {
  const today = dayKey(new Date());
  const yesterday = dayKey(Date.now() - 86400000);
  const key = dayKey(date);
  if (key === today) return "Dnes";
  if (key === yesterday) return "Včera";
  return date.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "numeric" });
}

function renderDay() {
  const settings = getSettings();
  const entries = entriesForDay(dayKey(state.day));
  const sum = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (Number(e.kcal) || 0),
      protein: acc.protein + (Number(e.protein_g) || 0),
      carbs: acc.carbs + (Number(e.carbs_g) || 0),
      fat: acc.fat + (Number(e.fat_g) || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  $("day-label").textContent = formatDay(state.day);
  $("next-day").disabled = dayKey(state.day) === dayKey(new Date());
  $("total-kcal").textContent = round(sum.kcal);
  $("goal-kcal").textContent = round(settings.goal);
  $("sum-protein").textContent = round(sum.protein);
  $("sum-carbs").textContent = round(sum.carbs);
  $("sum-fat").textContent = round(sum.fat);

  const pct = settings.goal > 0 ? (sum.kcal / settings.goal) * 100 : 0;
  const bar = $("progress-bar");
  bar.style.width = `${Math.min(100, pct)}%`;
  bar.classList.toggle("over", pct > 100);

  const list = $("entry-list");
  list.replaceChildren();
  for (const e of entries) {
    const li = document.createElement("li");
    li.className = "entry card";

    if (e.thumb) {
      const img = document.createElement("img");
      img.src = e.thumb;
      img.alt = "";
      li.append(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "thumb-ph";
      ph.textContent = "🍽";
      li.append(ph);
    }

    const info = document.createElement("div");
    info.className = "entry-info";
    const name = document.createElement("strong");
    name.textContent = e.name;
    const meta = document.createElement("small");
    meta.className = "muted";
    const time = new Date(e.timestamp).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    meta.textContent = `${time} · B ${round(e.protein_g)} · S ${round(e.carbs_g)} · T ${round(e.fat_g)} g`;
    info.append(name, meta);
    if (e.userNote) {
      const note = document.createElement("small");
      note.className = "muted note";
      note.textContent = e.userNote;
      info.append(note);
    }

    const kcal = document.createElement("div");
    kcal.className = "entry-kcal";
    kcal.textContent = `${round(e.kcal)} kcal`;

    const del = document.createElement("button");
    del.className = "icon-btn del";
    del.setAttribute("aria-label", "Smazat");
    del.textContent = "✕";
    del.addEventListener("click", () => {
      if (confirm(`Smazat „${e.name}“?`)) {
        deleteEntry(e.id);
        renderDay();
      }
    });

    li.append(info, kcal, del);
    list.append(li);
  }
  $("empty-day").hidden = entries.length > 0;
}

$("prev-day").addEventListener("click", () => {
  state.day = new Date(state.day.getTime() - 86400000);
  renderDay();
});
$("next-day").addEventListener("click", () => {
  state.day = new Date(state.day.getTime() + 86400000);
  renderDay();
});

// ---------- Přidání jídla ----------
function resetAdd() {
  state.image = null;
  state.result = null;
  $("photo-input").value = "";
  $("library-input").value = "";
  $("photo-preview").hidden = true;
  $("photo-preview").removeAttribute("src");
  $("photo-placeholder").hidden = false;
  $("note-input").value = "";
  $("add-error").hidden = true;
  $("result").hidden = true;
  setBusy(false);
}

function setBusy(busy) {
  const btn = $("analyze-btn");
  btn.disabled = busy;
  btn.textContent = busy ? "Počítám…" : "Spočítat kalorie";
}

function showError(msg) {
  const el = $("add-error");
  el.textContent = msg;
  el.hidden = false;
}

async function handlePhoto(file) {
  if (!file) return;
  $("add-error").hidden = true;
  try {
    state.image = await prepareImage(file);
    $("photo-preview").src = state.image.thumbDataUrl;
    $("photo-preview").hidden = false;
    $("photo-placeholder").hidden = true;
  } catch (err) {
    showError(err.message);
  }
}

$("add-btn").addEventListener("click", () => {
  if (!getSettings().apiKey) {
    openSettings();
    alert("Nejdřív zadejte svůj Anthropic API klíč.");
    return;
  }
  resetAdd();
  show("add-view");
});
$("photo-input").addEventListener("change", (e) => handlePhoto(e.target.files[0]));
$("library-input").addEventListener("change", (e) => handlePhoto(e.target.files[0]));
$("photo-library").addEventListener("click", () => $("library-input").click());
$("cancel-add").addEventListener("click", () => show("day-view"));

$("analyze-btn").addEventListener("click", async () => {
  const text = $("note-input").value;
  if (!state.image && !text.trim()) {
    showError("Vyfoťte jídlo nebo ho popište textem.");
    return;
  }
  const settings = getSettings();
  $("add-error").hidden = true;
  $("result").hidden = true;
  setBusy(true);
  try {
    const result = await analyzeMeal({
      apiKey: settings.apiKey,
      model: settings.model || DEFAULT_MODEL,
      imageBase64: state.image?.base64,
      text,
    });
    state.result = result;
    renderResult(result);
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
  }
});

function totals(items) {
  return items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + (Number(i.kcal) || 0),
      protein_g: acc.protein_g + (Number(i.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(i.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(i.fat_g) || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

function renderResult(result) {
  $("result-name").value = result.meal_name || "Jídlo";
  const tbody = $("result-items");
  tbody.replaceChildren();
  for (const item of result.items) {
    const tr = document.createElement("tr");
    for (const v of [item.name, round(item.grams), round(item.kcal)]) {
      const td = document.createElement("td");
      td.textContent = v;
      tr.append(td);
    }
    tbody.append(tr);
  }
  $("result-kcal").value = round(totals(result.items).kcal);
  $("result-note").textContent = `Jistota odhadu: ${result.confidence}. ${result.note || ""}`;
  $("result").hidden = false;
  $("result").scrollIntoView({ behavior: "smooth" });
}

$("retry-btn").addEventListener("click", () => $("analyze-btn").click());

$("save-btn").addEventListener("click", () => {
  const r = state.result;
  if (!r) return;
  const t = totals(r.items);
  const kcal = Number($("result-kcal").value);
  // Když uživatel ručně změní kcal, přepočítáme makra ve stejném poměru.
  const factor = t.kcal > 0 && kcal > 0 ? kcal / t.kcal : 1;

  // Pokud zobrazujeme jiný den než dnešek, uložíme jídlo do toho dne.
  const now = new Date();
  const ts = new Date(state.day);
  ts.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);

  const ok = addEntry({
    id: crypto.randomUUID(),
    timestamp: ts.getTime(),
    name: $("result-name").value.trim() || r.meal_name || "Jídlo",
    kcal: Number.isFinite(kcal) && kcal >= 0 ? kcal : t.kcal,
    protein_g: t.protein_g * factor,
    carbs_g: t.carbs_g * factor,
    fat_g: t.fat_g * factor,
    items: r.items,
    userNote: $("note-input").value.trim(),
    thumb: state.image?.thumbDataUrl ?? null,
  });
  if (!ok) {
    showError("Nepodařilo se uložit – úložiště je možná plné. Exportujte a smažte stará data.");
    return;
  }
  show("day-view");
  renderDay();
});

// ---------- Nastavení ----------
function openSettings() {
  const s = getSettings();
  $("api-key").value = s.apiKey;
  const sel = $("model-select");
  sel.replaceChildren(
    ...MODELS.map((m) => {
      const o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.label;
      return o;
    }),
  );
  sel.value = s.model || DEFAULT_MODEL;
  $("goal-input").value = s.goal;
  show("settings-view");
}

$("settings-btn").addEventListener("click", openSettings);
$("close-settings").addEventListener("click", () => show("day-view"));
$("save-settings").addEventListener("click", () => {
  saveSettings({
    apiKey: $("api-key").value.trim(),
    model: $("model-select").value,
    goal: Number($("goal-input").value) || 2000,
  });
  show("day-view");
  renderDay();
});

$("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(getEntries(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `kalorie-${dayKey(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Neplatný soubor.");
    const byId = new Map(getEntries().map((x) => [x.id, x]));
    for (const x of imported) if (x?.id) byId.set(x.id, x);
    saveEntries([...byId.values()]);
    alert(`Importováno ${imported.length} záznamů.`);
    renderDay();
  } catch (err) {
    alert(`Import selhal: ${err.message}`);
  }
  e.target.value = "";
});

// ---------- Start ----------
show("day-view");
renderDay();
