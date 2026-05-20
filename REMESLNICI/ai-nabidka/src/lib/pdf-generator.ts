/**
 * PDF generator — renderování HTML šablony a převod na PDF přes Puppeteer.
 */

import { readFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import puppeteer from "puppeteer";
import type { Nabidka, NabidkaPolozka } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SABLONA_PATH = resolve(__dirname, "..", "data", "sablona.html");

// ─────────────────────────────────────────────────────────────────────
// Pomocné utility
// ─────────────────────────────────────────────────────────────────────

/** Escapuje HTML speciální znaky v datech z nedůvěryhodných zdrojů (email klienta). */
function escapeHtml(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Formátuje číslo s českými tisícovými oddělovači: 12345 → "12 345". */
function formatCislo(n: number): string {
  return n.toLocaleString("cs-CZ");
}

/** Vygeneruje číslo nabídky ve formátu NAB-YYYYMMDD-HHMMSS. */
export function vytvorCisloNabidky(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const datum =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate());
  const cas =
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  return `NAB-${datum}-${cas}`;
}

// ─────────────────────────────────────────────────────────────────────
// Renderování jednoho řádku tabulky
// ─────────────────────────────────────────────────────────────────────

/** Renderuje jeden <tr> řádek z šablony pro konkrétní položku nabídky. */
function renderujRadek(sablonRadku: string, polozka: NabidkaPolozka): string {
  const neznama = polozka.neznama === true;
  const nazevHtml = neznama ? `⚠ ${escapeHtml(polozka.nazev)}` : escapeHtml(polozka.nazev);

  return sablonRadku
    .replace("{{neznama_class}}", neznama ? "nezname" : "")
    .replace("{{nazev}}", nazevHtml)
    .replace("{{mnozstvi}}", String(polozka.mnozstvi))
    .replace("{{jednotka}}", escapeHtml(polozka.jednotka))
    .replace("{{cena_jednotka}}", formatCislo(polozka.cena_jednotka))
    .replace("{{celkem}}", formatCislo(polozka.celkem));
}

// ─────────────────────────────────────────────────────────────────────
// Sestavení upozorňovacího bloku pro neznámé položky
// ─────────────────────────────────────────────────────────────────────

/** Vrátí HTML blok s upozorněním na neznámé položky, nebo prázdný string. */
function sestavUpozorneni(polozky: NabidkaPolozka[]): string {
  const nezname = polozky.filter((p) => p.neznama === true);
  if (nezname.length === 0) return "";

  const seznam = nezname
    .map((p) => `<li>${escapeHtml(p.nazev)}</li>`)
    .join("\n        ");

  return `
  <div class="upozorneni">
    <span class="upozorneni-icon">⚠</span>
    <div>
      <strong>Upozornění:</strong> Následující položky nebyly nalezeny v ceníku
      a jsou uvedeny s nulovou cenou. Cena bude upřesněna po konzultaci:
      <ul style="margin-top:4px; padding-left:18px;">
        ${seznam}
      </ul>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Vyplnění HTML šablony daty nabídky
// ─────────────────────────────────────────────────────────────────────

/**
 * Načte HTML šablonu, vyplní všechny placeholdery daty nabídky a vrátí
 * hotový HTML string připravený pro Puppeteer.
 */
export function vyplnSablonu(template: string, nabidka: Nabidka): string {
  // Extrahuj šablonu řádku tabulky mezi markery.
  const radekRegex =
    /<!-- POLOZKY_START -->([\s\S]*?)<!-- POLOZKY_END -->/;
  const radekMatch = template.match(radekRegex);
  if (!radekMatch || !radekMatch[1]) {
    throw new Error(
      "[PDF] Šablona neobsahuje markery <!-- POLOZKY_START --> / <!-- POLOZKY_END -->.",
    );
  }
  const sablonRadku = radekMatch[1];

  // Vyrenderuj všechny řádky.
  const radky = nabidka.polozky
    .map((p) => renderujRadek(sablonRadku, p))
    .join("\n");

  // Vlož řádky zpět místo celého bloku (včetně markerů).
  let html = template.replace(
    radekRegex,
    radky,
  );

  // Sestavení lokality jako čitelného stringu.
  const lokalitaCasti = [
    nabidka.lokalita.mesto,
    nabidka.lokalita.cast,
    nabidka.lokalita.ulice,
  ].filter(Boolean);
  const lokalitaText = lokalitaCasti.join(", ");

  // Upozornění na neznámé položky (prázdný string = blok se nezobrazí).
  const upozorneniHtml = sestavUpozorneni(nabidka.polozky);

  // Replace skalárních placeholderů.
  html = html
    .replace(/\{\{cislo\}\}/g, nabidka.cislo)
    .replace(/\{\{datum\}\}/g, nabidka.datum)
    .replace(/\{\{klient_jmeno\}\}/g, escapeHtml(nabidka.klient.jmeno))
    .replace(/\{\{klient_email\}\}/g, escapeHtml(nabidka.klient.email) || "—")
    .replace(/\{\{klient_telefon\}\}/g, escapeHtml(nabidka.klient.telefon) || "—")
    .replace(/\{\{lokalita\}\}/g, escapeHtml(lokalitaText) || "—")
    .replace(/\{\{text_uvod\}\}/g, escapeHtml(nabidka.text_uvod))
    .replace(/\{\{text_zaver\}\}/g, escapeHtml(nabidka.text_zaver))
    .replace(/\{\{mezisoucet\}\}/g, formatCislo(nabidka.mezisoucet))
    .replace(/\{\{dph_sazba\}\}/g, String(nabidka.dph_sazba))
    .replace(/\{\{dph_castka\}\}/g, formatCislo(nabidka.dph_castka))
    .replace(/\{\{celkem\}\}/g, formatCislo(nabidka.celkem))
    .replace(/\{\{upozorneni_blok\}\}/g, upozorneniHtml);

  return html;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Generování PDF přes Puppeteer
// ─────────────────────────────────────────────────────────────────────

/**
 * Vygeneruje PDF z nabídky a uloží ho na zadanou cestu.
 * Vytvoří output adresář pokud neexistuje.
 */
export async function generujPDF(
  nabidka: Nabidka,
  outputPath: string,
): Promise<void> {
  const filename = basename(outputPath);
  console.log(`[PDF] Generuji ${filename}...`);

  // Zajisti existenci output adresáře.
  const outputDir = dirname(outputPath);
  mkdirSync(outputDir, { recursive: true });

  // Načti a vyplň šablonu.
  const template = readFileSync(SABLONA_PATH, "utf-8");
  const html = vyplnSablonu(template, nabidka);

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Předej HTML přímo — žádné soubory přes file://, tedy žádné CORS problémy.
    await page.setContent(html, { waitUntil: "load" });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });
  } catch (err) {
    console.error(`[PDF] Chyba při generování PDF:`, err);
    throw err;
  } finally {
    // Browser vždy zavřeme, i při chybě.
    if (browser) await browser.close();
  }

  // Zjisti velikost vygenerovaného souboru.
  const sizeBytes = statSync(outputPath).size;
  const sizeKB = Math.round(sizeBytes / 1024);
  console.log(`[PDF] ✓ Hotovo: ${filename} (${sizeKB} KB)`);
}
