/**
 * Ceník parser — načtení JSON, fuzzy matching položek a výpočty nabídky.
 *
 * Strategie matchingu:
 *   1. Normalizovaný token includes (rychlé, většina případů)
 *   2. Fallback: Levenshtein distance ≤ LEVENSHTEIN_THRESHOLD
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type {
  Cenik,
  CenikPolozka,
  EmailPolozka,
  ExtractedEmailData,
  NabidkaPolozka,
} from "./types.js";

// Výchozí cesta k ceníku — relativně k tomuto souboru (src/lib → ../data)
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CENIK_PATH = resolve(__dirname, "..", "data", "cenik-elektro.json");

// ─────────────────────────────────────────────────────────────────────
// 0. DPH mapping
// ─────────────────────────────────────────────────────────────────────

/** Mapuje kategorii DPH na sazbu. "neurceno" → konzervativní default 21 %. */
export function mapDphSazba(kategorie: ExtractedEmailData["kategorie_dph"]): 12 | 21 {
  return kategorie === "bytova_vystavba" ? 12 : 21;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Načtení a validace ceníku
// ─────────────────────────────────────────────────────────────────────

/**
 * Načte ceník ze souboru a zvaliduje jeho strukturu.
 * Hází chybu pokud chybí povinná pole.
 */
export function nactiCenik(filePath: string = DEFAULT_CENIK_PATH): Cenik {
  console.log(`[CENIK] Načítám ceník: ${filePath}`);
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as unknown;

  if (!data || typeof data !== "object") {
    throw new Error("Ceník: kořen JSON není objekt.");
  }
  const c = data as Record<string, unknown>;

  if (!c["hodinove_sazby"] || typeof c["hodinove_sazby"] !== "object") {
    throw new Error("Ceník: chybí nebo neplatné pole 'hodinove_sazby'.");
  }
  if (!Array.isArray(c["polozky"])) {
    throw new Error("Ceník: chybí nebo neplatné pole 'polozky' (musí být array).");
  }
  if (!Array.isArray(c["balicky"])) {
    throw new Error("Ceník: chybí nebo neplatné pole 'balicky' (musí být array).");
  }
  if (typeof c["marze_material"] !== "number") {
    throw new Error("Ceník: chybí 'marze_material' (number).");
  }
  if (typeof c["doprava_km"] !== "number") {
    throw new Error("Ceník: chybí 'doprava_km' (number).");
  }
  if (typeof c["min_naklady"] !== "number") {
    throw new Error("Ceník: chybí 'min_naklady' (number).");
  }

  const cenik = data as Cenik;
  console.log(
    `[CENIK] ✓ Načteno: ${cenik.polozky.length} položek, ${cenik.balicky.length} balíčků`,
  );
  return cenik;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Normalizace stringů (lowercase + bez diakritiky)
// ─────────────────────────────────────────────────────────────────────

/**
 * Normalizace pro fuzzy porovnávání:
 *   "Zásuvka 230V montáž" → "zasuvka 230v montaz"
 *
 * NFD rozloží znaky s diakritikou na základní písmeno + combining mark,
 * regex /\p{M}/gu pak odstraní všechny combining marks.
 */
export function normalizuj(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

// ─────────────────────────────────────────────────────────────────────
// 3. Levenshtein distance (vlastní impl, bez závislosti)
// ─────────────────────────────────────────────────────────────────────

/**
 * Klasická DP-tabulka pro edit distance.
 * Pro krátké stringy (názvy položek) je výkon dostatečný.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Jen předchozí + aktuální řádek matice (úspora paměti).
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insert
        prev[j]! + 1,           // delete
        prev[j - 1]! + cost,    // substitute
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length]!;
}

// ─────────────────────────────────────────────────────────────────────
// 4. Fuzzy match položky v ceníku
// ─────────────────────────────────────────────────────────────────────

/** Interní výsledek najdiPolozku — přidává příznak nízké jistoty. */
interface FuzzyVysledek {
  polozka: CenikPolozka;
  nizkaJistota: boolean;
}

/**
 * Najde nejlepší shodu mezi hledaným názvem a položkami v ceníku.
 *
 * Strategie A (token includes, min 4 znaky):
 *   Sbírá VŠECHNY shody s počtem matchujících tokenů, vrátí nejlepší
 *   (tiebreaker = kratší název). Confidence < 50 % → nizkaJistota.
 *   Guard: pokud žádný token nemá ≥ 4 znaky, vrátí null (zamezí dělení nulou).
 *
 * Strategie B (Levenshtein fallback):
 *   Dynamický threshold = min(3, floor(délka/4)).
 *   Confidence = vzdalenost/délka ≥ 0.5 → nizkaJistota.
 */
export function najdiPolozku(
  nazev: string,
  cenik: Cenik,
): FuzzyVysledek | null {
  const hledanyNorm = normalizuj(nazev);
  const hledanyTokeny = hledanyNorm.split(/\s+/).filter((t) => t.length >= 4);

  // Guard: žádný token ≥ 4 znaky — nelze bezpečně matchovat, přeskočíme na B.
  if (hledanyTokeny.length > 0) {
    // Strategie A: sbírej všechny shody
    const shody: { polozka: CenikPolozka; matchCount: number; totalTokens: number } [] = [];

    for (const polozka of cenik.polozky) {
      const polozkaNorm = normalizuj(polozka.nazev);
      const polozkaTokeny = polozkaNorm.split(/\s+/).filter((t) => t.length >= 4);
      if (polozkaTokeny.length === 0) continue;

      const matchCount = hledanyTokeny.filter((ht) =>
        polozkaTokeny.some((pt) => pt.includes(ht) || ht.includes(pt)),
      ).length;

      if (matchCount > 0) {
        shody.push({ polozka, matchCount, totalTokens: Math.max(hledanyTokeny.length, polozkaTokeny.length) });
      }
    }

    if (shody.length > 0) {
      // Seřaď: nejvíce matchů první, tiebreaker = kratší název
      shody.sort((a, b) =>
        b.matchCount - a.matchCount ||
        a.polozka.nazev.length - b.polozka.nazev.length,
      );
      const nejlepsi = shody[0]!;
      const nizkaJistota = nejlepsi.matchCount / nejlepsi.totalTokens < 0.5;
      console.log(
        `[FUZZY] "${nazev}" → "${nejlepsi.polozka.nazev}" (token, ${nejlepsi.matchCount}/${nejlepsi.totalTokens} tokenů${nizkaJistota ? ", nízká jistota" : ""})`,
      );
      return { polozka: nejlepsi.polozka, nizkaJistota };
    }
  }

  // Strategie B: Levenshtein fallback s dynamickým thresholdem
  const threshold = Math.min(3, Math.floor(hledanyNorm.length / 4));
  let nejlepsi: { polozka: CenikPolozka; vzdalenost: number } | null = null;
  for (const polozka of cenik.polozky) {
    const polozkaNorm = normalizuj(polozka.nazev);
    const vzdalenost = levenshtein(hledanyNorm, polozkaNorm);
    if (!nejlepsi || vzdalenost < nejlepsi.vzdalenost) {
      nejlepsi = { polozka, vzdalenost };
    }
  }

  if (nejlepsi && nejlepsi.vzdalenost <= threshold) {
    const nizkaJistota = hledanyNorm.length > 0 &&
      nejlepsi.vzdalenost / hledanyNorm.length >= 0.5;
    console.log(
      `[FUZZY] "${nazev}" → "${nejlepsi.polozka.nazev}" (Levenshtein=${nejlepsi.vzdalenost}, threshold=${threshold}${nizkaJistota ? ", nízká jistota" : ""})`,
    );
    return { polozka: nejlepsi.polozka, nizkaJistota };
  }

  console.log(`[FUZZY] ✗ "${nazev}" nenalezeno v ceníku`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// 5. Výpočet jedné položky
// ─────────────────────────────────────────────────────────────────────

/**
 * Najde položku v ceníku a spočítá její cenu.
 * Pokud položku nenajde, vrátí placeholder s neznama=true (žluté zvýraznění v PDF).
 */
export function spocitejPolozku(
  nazev: string,
  mnozstvi: number,
  cenik: Cenik,
): NabidkaPolozka {
  const vysledek = najdiPolozku(nazev, cenik);

  if (!vysledek) {
    return {
      nazev,
      mnozstvi,
      jednotka: "?",
      cena_jednotka: 0,
      celkem: 0,
      neznama: true,
    };
  }

  const { polozka, nizkaJistota } = vysledek;
  const celkem = mnozstvi * polozka.cena_ks;
  return {
    nazev: polozka.nazev,
    mnozstvi,
    jednotka: polozka.jednotka,
    cena_jednotka: polozka.cena_ks,
    celkem,
    neznama: nizkaJistota || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 6. Výpočet celé nabídky
// ─────────────────────────────────────────────────────────────────────

/**
 * Výsledek výpočtu nabídky — všechny finanční údaje bez/s DPH.
 * (Vrací jen sumy a položky; číslo nabídky, datum, klienta dosadí orchestrátor.)
 */
export interface VysledekNabidky {
  polozky: NabidkaPolozka[];
  mezisoucet: number;
  dph_sazba: 12 | 21;
  dph_castka: number;
  celkem: number;
}

/**
 * Pro každou položku z emailu provede výpočet a sečte celkové sumy.
 */
export function spocitejNabidku(
  polozky: EmailPolozka[],
  cenik: Cenik,
  dphSazba: 12 | 21,
): VysledekNabidky {
  console.log(`[VYPOCET] Počítám ${polozky.length} položek, DPH ${dphSazba} %`);

  const spocitane: NabidkaPolozka[] = polozky.map((p) =>
    spocitejPolozku(p.nazev, p.mnozstvi, cenik),
  );

  const mezisoucet = spocitane.reduce((sum, p) => sum + p.celkem, 0);
  const dph_castka = Math.round((mezisoucet * dphSazba) / 100);
  const celkem = mezisoucet + dph_castka;

  console.log(
    `[VYPOCET] ✓ Mezisoučet ${mezisoucet} Kč, DPH ${dph_castka} Kč, Celkem ${celkem} Kč`,
  );

  return { polozky: spocitane, mezisoucet, dph_sazba: dphSazba, dph_castka, celkem };
}
