/**
 * Orchestrátor — hlavní vstupní bod AI Nabídka generátoru.
 *
 * Tok:
 *   email.txt → Claude extrakce → ceník výpočet → Claude texty → PDF
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Nabidka } from "./lib/types.js";
import { nactiCenik, mapDphSazba, spocitejNabidku } from "./lib/cenik-parser.js";
import { callClaudeExtractData, callClaudeGenerateOffer } from "./lib/claude.js";
import { generujPDF, vytvorCisloNabidky } from "./lib/pdf-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMAIL_PATH = resolve(__dirname, "data", "mock-email.txt");
const OUTPUT_DIR = resolve(__dirname, "..", "output");

// ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== AI Nabídka — generátor nabídek ===\n");

  // ── 1. Načti email ───────────────────────────────────────────────
  const emailText = readFileSync(EMAIL_PATH, "utf-8");
  console.log("[1/6] Email načten\n");

  // ── 2. Načti ceník ───────────────────────────────────────────────
  const cenik = nactiCenik();
  console.log(
    `[2/6] Ceník načten: ${cenik.polozky.length} položek, ${cenik.balicky.length} balíčků\n`,
  );

  // ── 3. Claude Call #1 — extrakce dat z emailu ───────────────────
  const extracted = await callClaudeExtractData(emailText);
  console.log("[3/6] Data extrahována:");
  console.log(JSON.stringify(extracted, null, 2));
  console.log();

  // Sanity check: každá extrahovaná položka by měla mít alespoň jedno
  // klíčové slovo (delší než 3 znaky, bez diakritiky) v původním emailu.
  // Varuje před položkami vloženými injection útokem.
  const emailNorm = emailText.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const p of extracted.polozky) {
    const slovaNorm = p.nazev
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/\s+/)
      .filter((s) => s.length > 3);
    const nalezeno = slovaNorm.some((slovo) => emailNorm.includes(slovo));
    if (!nalezeno) {
      console.warn(`[BEZPEČNOST] ⚠ Položka nezmíněná v emailu: ${p.nazev}`);
    }
  }

  // ── 4. Výpočet nabídky ───────────────────────────────────────────
  const dphSazba = mapDphSazba(extracted.kategorie_dph);
  console.log(`[DPH] Kategorie: ${extracted.kategorie_dph} → sazba ${dphSazba} %`);
  if (extracted.kategorie_dph === "neurceno") {
    console.warn("[DPH] ⚠ Kategorie DPH neurčena — použita výchozí sazba 21 %");
  }
  const vysledek = spocitejNabidku(extracted.polozky, cenik, dphSazba, extracted.vzdalenost_km);
  console.log("\n[4/6] Nabídka spočítána:");
  console.log(`  Mezisoučet: ${vysledek.mezisoucet} Kč`);
  console.log(`  DPH ${dphSazba} %:   ${vysledek.dph_castka} Kč`);
  console.log(`  Celkem:     ${vysledek.celkem} Kč\n`);

  // ── 5. Claude Call #2 — generování textu nabídky ────────────────
  const texty = await callClaudeGenerateOffer(extracted, vysledek);
  console.log("[5/6] Texty vygenerovány\n");

  // ── 6. Sestavení Nabidka objektu ─────────────────────────────────
  const cislo = vytvorCisloNabidky();
  const datum = new Date().toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  const nabidka: Nabidka = {
    cislo,
    datum,
    klient: extracted.kontakt,
    lokalita: extracted.lokalita,
    polozky: vysledek.polozky,
    mezisoucet: vysledek.mezisoucet,
    dph_sazba: dphSazba,
    dph_castka: vysledek.dph_castka,
    celkem: vysledek.celkem,
    text_uvod: texty.text_uvod,
    text_zaver: texty.text_zaver,
  };

  // ── 7. Generování PDF ────────────────────────────────────────────
  const outputPath = resolve(OUTPUT_DIR, `${cislo}.pdf`);
  await generujPDF(nabidka, outputPath);
  console.log(`\n[6/6] ✓ Hotovo: output/${cislo}.pdf`);
  console.log("\n=== Nabídka úspěšně vygenerována ===");
}

// ─────────────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error(
    "\n❌ CHYBA:",
    err instanceof Error ? err.message : String(err),
  );
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
