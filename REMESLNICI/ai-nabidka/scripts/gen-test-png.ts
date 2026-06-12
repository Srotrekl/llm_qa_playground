import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer";
import type { Nabidka } from "../src/lib/types.js";
import { vyplnSablonu } from "../src/lib/pdf-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "..", "output");
const SABLONA_PATH = resolve(__dirname, "..", "src", "data", "sablona.html");
const FIRMA_PATH = resolve(__dirname, "..", "src", "data", "firma.json");

const nabidka: Nabidka = {
  cislo: "NAB-20260611-142530",
  datum: "11. 6. 2026",
  klient: { jmeno: "Jan Novák", email: "jan.novak@email.cz", telefon: "+420 777 123 456" },
  lokalita: { mesto: "Ostrava", cast: "Poruba", ulice: "Slévárenská 8" },
  dph_sazba: 12,
  polozky: [
    { nazev: "Montáž a zapojení zásuvky",  mnozstvi: 24,  jednotka: "ks", cena_jednotka: 145, celkem: 3480 },
    { nazev: "Montáž a zapojení vypínače",  mnozstvi: 8,   jednotka: "ks", cena_jednotka: 140, celkem: 1120 },
    { nazev: "Montáž a zapojení svítidla",  mnozstvi: 12,  jednotka: "ks", cena_jednotka: 350, celkem: 4200 },
    { nazev: "Sekání šliců",                mnozstvi: 60,  jednotka: "bm", cena_jednotka: 65,  celkem: 3900 },
    { nazev: "Tahání kabelu",               mnozstvi: 120, jednotka: "bm", cena_jednotka: 60,  celkem: 7200 },
    { nazev: "Osazení rozvaděče",           mnozstvi: 1,   jednotka: "ks", cena_jednotka: 450, celkem: 450  },
  ],
  mezisoucet: 20350,
  dph_castka: 2442,
  celkem: 22792,
  text_uvod: "Děkujeme za Vaši poptávku. Na základě uvedených požadavků jsme připravili následující cenovou nabídku na rekonstrukci elektroinstalace v bytě 3+1 v Ostravě-Porubě.",
  text_zaver: "Nabídka je platná 30 dní od data vystavení. V případě zájmu nás neváhejte kontaktovat pro upřesnění termínu realizace.",
};

async function main(): Promise<void> {
  const template = readFileSync(SABLONA_PATH, "utf-8");
  const firma = JSON.parse(readFileSync(FIRMA_PATH, "utf-8")) as any;
  firma.showBrandmark = firma.showBrandmark ?? true;

  const html = vyplnSablonu(template, nabidka, firma);
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: resolve(OUTPUT_DIR, "test-cisty.png"), fullPage: true });
    console.log("✓ output/test-cisty.png");
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => { console.error(err); process.exit(1); });
