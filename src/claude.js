import Anthropic from "@anthropic-ai/sdk";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (nejpřesnější)", fallbacks: true },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (levnější)", fallbacks: true },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (nejlevnější)", fallbacks: false },
];

export const DEFAULT_MODEL = MODELS[0].id;

const SYSTEM_PROMPT = `Jsi nutriční asistent. Z fotografie jídla a/nebo textového popisu odhadni složení a energetickou hodnotu porce.

Postup:
- Rozpoznej jednotlivé položky na talíři a odhadni jejich hmotnost v gramech podle velikosti talíře, příboru a běžných porcí.
- Pro každou položku uveď kalorie (kcal) a makroživiny (bílkoviny, sacharidy, tuky v gramech).
- Pokud uživatel doplnil text (např. množství, způsob přípravy, že snědl jen polovinu), má přednost před tím, co vidíš na fotce.
- Pokud je k dispozici jen text, odhadni hodnoty z popisu.
- Názvy jídel a poznámky piš česky.
- Do "note" stručně uveď hlavní nejistotu odhadu (např. skrytý tuk, velikost porce). Pokud jídlo nelze rozpoznat, napiš to tam a vrať prázdný seznam položek.`;

const RESULT_SCHEMA = {
  type: "object",
  properties: {
    meal_name: { type: "string", description: "Krátký název jídla česky" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["name", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
        additionalProperties: false,
      },
    },
    confidence: { type: "string", enum: ["nízká", "střední", "vysoká"] },
    note: { type: "string" },
  },
  required: ["meal_name", "items", "confidence", "note"],
  additionalProperties: false,
};

/**
 * Odhadne kalorie z fotky (base64 JPEG) a/nebo textu.
 * @returns {Promise<{meal_name:string, items:Array, confidence:string, note:string}>}
 */
export async function analyzeMeal({ apiKey, model, imageBase64, text }) {
  const client = new Anthropic({
    apiKey,
    // Klíč zůstává jen v tomto zařízení a posílá se přímo do Anthropic API.
    dangerouslyAllowBrowser: true,
  });

  const content = [];
  if (imageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
    });
  }
  content.push({
    type: "text",
    text: text?.trim()
      ? `Upřesnění od uživatele: ${text.trim()}`
      : "Odhadni kalorie tohoto jídla.",
  });

  const modelInfo = MODELS.find((m) => m.id === model) ?? MODELS[0];

  const params = {
    model: modelInfo.id,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: RESULT_SCHEMA },
    },
    messages: [{ role: "user", content }],
  };
  if (modelInfo.fallbacks) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }

  let response;
  try {
    response = await client.beta.messages.create(params);
  } catch (err) {
    throw new Error(describeApiError(err));
  }

  if (response.stop_reason === "refusal") {
    throw new Error("Claude tento požadavek odmítl zpracovat. Zkuste jinou fotku nebo popis.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Odpověď byla useknutá. Zkuste to prosím znovu.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Claude nevrátil žádný výsledek.");

  const result = JSON.parse(textBlock.text);
  return result;
}

function describeApiError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Neplatný API klíč. Zkontrolujte ho v Nastavení.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "API klíč nemá oprávnění k tomuto modelu.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Příliš mnoho požadavků nebo vyčerpaný kredit. Zkuste to za chvíli.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `Chybný požadavek: ${err.message}`;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Nepodařilo se spojit s Claude. Zkontrolujte připojení k internetu.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Chyba Claude API (${err.status ?? "?"}): ${err.message}`;
  }
  return err?.message ?? String(err);
}
