/**
 * Claude API wrapper — inicializace klienta, volání API, parsing JSON odpovědí.
 */

import Anthropic from "@anthropic-ai/sdk";
import { EXTRACT_SYSTEM_PROMPT, buildExtractUserMessage } from "../prompts/extract-data.js";
import { OFFER_SYSTEM_PROMPT, buildOfferUserMessage } from "../prompts/generate-offer.js";
import type { ExtractedEmailData } from "./types.js";
import type { VysledekNabidky } from "./cenik-parser.js";
import { ExtractedEmailDataSchema, OfferTextsSchema } from "./schemas.js";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;

// Lazy-init singleton — klient se vytvoří jen jednou při prvním volání.
let _client: Anthropic | null = null;

// ─────────────────────────────────────────────────────────────────────
// 1. Inicializace klienta
// ─────────────────────────────────────────────────────────────────────

function createClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "[CLAUDE] Chybí ANTHROPIC_API_KEY v prostředí. Ujisti se, že máš .env soubor s platným klíčem.",
    );
  }

  _client = new Anthropic({ apiKey });
  console.log("[CLAUDE] Klient inicializován.");
  return _client;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Generické volání API
// ─────────────────────────────────────────────────────────────────────

/**
 * Zavolá Claude API se system promptem a user zprávou.
 *
 * @param systemPrompt - Systémová instrukce (bezpečnostní kontext + pravidla).
 * @param userMessage  - User zpráva s daty (nedůvěryhodný vstup obalený v tagu).
 * @param label        - Popis volání pro console.log.
 */
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  label: string,
): Promise<string> {
  const client = createClient();

  console.log(`[CLAUDE] ${label} — volám API (model: ${MODEL})...`);
  const start = Date.now();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      },
      { timeout: 60_000, maxRetries: 3 },
    );
  } catch (err) {
    console.error(`[CLAUDE] ${label} — chyba při volání API:`, err);
    throw err;
  }

  const ms = Date.now() - start;
  const tokens = response.usage.input_tokens + response.usage.output_tokens;
  console.log(`[CLAUDE] ${label} — hotovo (${tokens} tokenů, ${ms} ms)`);

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error(
      `[CLAUDE] ${label} — neočekávaný typ odpovědi: ${block?.type ?? "undefined"}`,
    );
  }

  return block.text;
}

// ─────────────────────────────────────────────────────────────────────
// 3. JSON parser — obranyschopný vůči markdown wrapperům
// ─────────────────────────────────────────────────────────────────────

/**
 * Najde konec JSON objektu začínajícího na indexu `start` v textu.
 * Respektuje stringové literály (včetně escape sekvencí), takže "}" uvnitř
 * stringu (např. "Děkujeme :}") neukončí vyhledávání předčasně.
 */
function findJsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let i = start;

  while (i < text.length) {
    const ch = text[i];

    if (inString) {
      if (ch === "\\") {
        i += 2; // přeskoč escaped znak
        continue;
      }
      if (ch === '"') inString = false;
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    i++;
  }
  return -1;
}

/**
 * Zparsuje JSON z textu od Claude.
 * Odstraní markdown code fences, pak pomocí balanced-brace parseru najde
 * hranice JSON objektu.
 */
export function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");

  const start = cleaned.indexOf("{");
  if (start === -1) {
    const ukazka = text.slice(0, 200);
    throw new Error(
      `[CLAUDE] Odpověď neobsahuje validní JSON objekt.\nUkázka odpovědi: ${ukazka}`,
    );
  }

  const end = findJsonEnd(cleaned, start);
  if (end === -1) {
    const ukazka = cleaned.slice(start, start + 200);
    throw new Error(
      `[CLAUDE] JSON objekt není uzavřen (nevyvážené závorky).\nUkázka: ${ukazka}`,
    );
  }

  const jsonStr = cleaned.slice(start, end);

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    const ukazka = jsonStr.slice(0, 200);
    throw new Error(
      `[CLAUDE] Nelze zparsovat JSON: ${err instanceof Error ? err.message : String(err)}\nUkázka: ${ukazka}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. Extrakce dat z emailu (Call #1)
// ─────────────────────────────────────────────────────────────────────

export async function callClaudeExtractData(
  emailText: string,
): Promise<ExtractedEmailData> {
  const userMessage = buildExtractUserMessage(emailText);
  const raw = await callClaude(EXTRACT_SYSTEM_PROMPT, userMessage, "Extrakce dat z emailu");
  const parsed = extractJSON(raw);

  const result = ExtractedEmailDataSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`[CLAUDE] Extrakce dat — nevalidní odpověď: ${issues}`);
  }
  return result.data as ExtractedEmailData;
}

// ─────────────────────────────────────────────────────────────────────
// 5. Generování textu nabídky (Call #2)
// ─────────────────────────────────────────────────────────────────────

export async function callClaudeGenerateOffer(
  data: ExtractedEmailData,
  vysledek: VysledekNabidky,
): Promise<{ text_uvod: string; text_zaver: string }> {
  const userMessage = buildOfferUserMessage(data, vysledek);
  const raw = await callClaude(OFFER_SYSTEM_PROMPT, userMessage, "Generování textu nabídky");
  const parsed = extractJSON(raw);

  const result = OfferTextsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`[CLAUDE] Generování textu — nevalidní odpověď: ${issues}`);
  }
  return result.data;
}
