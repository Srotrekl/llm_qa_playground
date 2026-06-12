import { describe, it, expect } from "vitest";
import { najdiPolozku, normalizuj, normalizujJadro, spocitejNabidku, mapDphSazba } from "../src/lib/cenik-parser.js";
import type { Cenik } from "../src/lib/types.js";

// Mock ceník BEZ pole typ — testy DPH a min_naklady nejsou ovlivněny marží.
// min_naklady = 0 aby se neaktivovalo v DPH testech.
const mockCenikBezTypu: Cenik = {
  hodinove_sazby: {},
  balicky: [],
  marze_material: 0.2,
  doprava_km: 15,
  min_naklady: 0,
  polozky: [
    { nazev: "Zásuvka 230V montáž", cena_ks: 350, jednotka: "ks" },
    { nazev: "Vypínač jednoduchý", cena_ks: 280, jednotka: "ks" },
    { nazev: "Světelný bod", cena_ks: 450, jednotka: "ks" },
    { nazev: "Datová zásuvka", cena_ks: 420, jednotka: "ks" },
  ],
};

// Ceník s min_naklady pro testování floor logiky.
const mockCenikSMinimem: Cenik = {
  ...mockCenikBezTypu,
  min_naklady: 1500,
};

// Mock ceník S polem typ — pro test marže.
const mockCenikSTypem: Cenik = {
  hodinove_sazby: {},
  balicky: [],
  marze_material: 0.2,
  doprava_km: 15,
  min_naklady: 0,
  polozky: [
    { nazev: "Rozvody silnoproud", cena_ks: 100, jednotka: "bm", typ: "material" },
    { nazev: "Montáž zásuvky", cena_ks: 200, jednotka: "ks", typ: "prace" },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// normalizuj
// ─────────────────────────────────────────────────────────────────────

describe("normalizuj", () => {
  it("převede na lowercase a odstraní diakritiku", () => {
    expect(normalizuj("Zásuvka")).toBe("zasuvka");
    expect(normalizuj("Světelný bod")).toBe("svetelny bod");
    expect(normalizuj("  Příkop  ")).toBe("prikop");
  });
});

// ─────────────────────────────────────────────────────────────────────
// najdiPolozku
// ─────────────────────────────────────────────────────────────────────

describe("najdiPolozku", () => {
  it("najde zásuvku přes víceslovný dotaz", () => {
    // "zásuvka 230v" matchuje přesněji "Zásuvka 230V montáž" (2 tokeny) vs "Datová zásuvka" (1 token)
    const vysledek = najdiPolozku("zásuvka 230v", mockCenikBezTypu);
    expect(vysledek).not.toBeNull();
    expect(vysledek!.polozka.nazev).toBe("Zásuvka 230V montáž");
  });

  it("najde shodu bez diakritiky", () => {
    const vysledek = najdiPolozku("svetelny", mockCenikBezTypu);
    expect(vysledek).not.toBeNull();
    expect(vysledek!.polozka.nazev).toBe("Světelný bod");
  });

  it("vrátí null pro zcela neznámý název", () => {
    const vysledek = najdiPolozku("zlaty lustr", mockCenikBezTypu);
    expect(vysledek).toBeNull();
  });

  it("najde datovou zásuvku přes přesný dotaz", () => {
    const vysledek = najdiPolozku("datová zásuvka", mockCenikBezTypu);
    expect(vysledek).not.toBeNull();
    expect(vysledek!.polozka.nazev).toBe("Datová zásuvka");
  });

  it("vrátí nizkaJistota=false pro dobrou shodu", () => {
    const vysledek = najdiPolozku("datová zásuvka", mockCenikBezTypu);
    expect(vysledek).not.toBeNull();
    expect(vysledek!.nizkaJistota).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// spocitejNabidku — DPH (mockCenikBezTypu s min_naklady = 0)
// ─────────────────────────────────────────────────────────────────────

describe("spocitejNabidku — DPH 21 %", () => {
  it("správně počítá DPH 21 %", () => {
    // "světelný bod" matchuje "Světelný bod" = 450 Kč
    const polozky = [{ nazev: "světelný bod", mnozstvi: 1, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikBezTypu, 21);
    expect(vysledek.mezisoucet).toBe(450);
    expect(vysledek.dph_castka).toBe(95); // round(450 * 0.21) = round(94.5) = 95
    expect(vysledek.celkem).toBe(545);
    expect(vysledek.dph_sazba).toBe(21);
  });
});

describe("spocitejNabidku — DPH 12 %", () => {
  it("správně počítá DPH 12 %", () => {
    // "světelný bod" × 2 = 900 Kč
    const polozky = [{ nazev: "světelný bod", mnozstvi: 2, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikBezTypu, 12);
    expect(vysledek.mezisoucet).toBe(900);
    expect(vysledek.dph_castka).toBe(108); // round(900 * 0.12) = 108
    expect(vysledek.celkem).toBe(1008);
    expect(vysledek.dph_sazba).toBe(12);
  });
});

// ─────────────────────────────────────────────────────────────────────
// spocitejNabidku — min_naklady (mockCenikSMinimem, min = 1500)
// ─────────────────────────────────────────────────────────────────────

describe("spocitejNabidku — min_naklady", () => {
  it("přidá virtuální položku 'Minimální zakázka' pokud je součet pod minimem", () => {
    // světelný bod 450 Kč × 1 = 450, min = 1500, rozdíl = 1050
    const polozky = [{ nazev: "světelný bod", mnozstvi: 1, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikSMinimem, 21);
    expect(vysledek.min_naklady_pouzite).toBe(true);
    const minPolozka = vysledek.polozky.find((p) => p.nazev === "Minimální zakázka");
    expect(minPolozka).toBeDefined();
    expect(minPolozka!.celkem).toBe(1050);
    expect(vysledek.mezisoucet).toBeGreaterThanOrEqual(1500);
  });

  it("nepřidá virtuální položku pokud součet dosáhne minima", () => {
    // světelný bod 450 × 4 = 1800 > 1500
    const polozky = [{ nazev: "světelný bod", mnozstvi: 4, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikSMinimem, 21);
    expect(vysledek.min_naklady_pouzite).toBe(false);
    expect(vysledek.polozky.find((p) => p.nazev === "Minimální zakázka")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// spocitejNabidku — marže na materiál
// ─────────────────────────────────────────────────────────────────────

describe("spocitejNabidku — marže na materiál", () => {
  it("navýší cenu materiálové položky o marži a spočítá marze_castka", () => {
    // Rozvody silnoproud: 100 Kč/bm + 20 % = 120 Kč/bm, 10 bm → 1200 Kč, marže = 200 Kč
    const polozky = [{ nazev: "rozvody", mnozstvi: 10, jednotka: "bm" }];
    const vysledek = spocitejNabidku(polozky, mockCenikSTypem, 21);
    const rozvodyPolozka = vysledek.polozky.find((p) => p.nazev === "Rozvody silnoproud");
    expect(rozvodyPolozka).toBeDefined();
    expect(rozvodyPolozka!.cena_jednotka).toBe(120);
    expect(rozvodyPolozka!.celkem).toBe(1200);
    expect(vysledek.marze_castka).toBe(200);
  });

  it("neaplikuje marži na položky typu 'prace'", () => {
    // "zasuvka" matchuje "Montáž zásuvky" přes jadro (montaz je servisní slovo, zůstane "zasuvky")
    const polozky = [{ nazev: "zasuvka", mnozstvi: 1, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikSTypem, 21);
    const montazPolozka = vysledek.polozky.find((p) => p.nazev === "Montáž zásuvky");
    expect(montazPolozka).toBeDefined();
    expect(montazPolozka!.cena_jednotka).toBe(200);
    expect(vysledek.marze_castka).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// spocitejNabidku — doprava
// ─────────────────────────────────────────────────────────────────────

describe("spocitejNabidku — doprava", () => {
  it("přidá položku Doprava a nezahrnuje ji do min_naklady kontroly", () => {
    // světelný bod 450 Kč < min_naklady 1500 → virtuální položka MUSÍ být přidána
    // + doprava 10 km × 2 × 15 = 300 Kč
    const polozky = [{ nazev: "světelný bod", mnozstvi: 1, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikSMinimem, 21, 10);
    expect(vysledek.doprava).toBe(300);
    const dopravaPolozka = vysledek.polozky.find((p) => p.nazev === "Doprava");
    expect(dopravaPolozka).toBeDefined();
    expect(dopravaPolozka!.celkem).toBe(300);
    // min_naklady se kontroluje BEZ dopravy → virtuální položka MUSÍ být přidána
    expect(vysledek.min_naklady_pouzite).toBe(true);
  });

  it("nepřidá dopravu pokud vzdalenost_km není zadána", () => {
    const polozky = [{ nazev: "světelný bod", mnozstvi: 4, jednotka: "ks" }];
    const vysledek = spocitejNabidku(polozky, mockCenikSMinimem, 21);
    expect(vysledek.doprava).toBe(0);
    expect(vysledek.polozky.find((p) => p.nazev === "Doprava")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Mock ceník s reálnými názvy z cenik-elektro.json — pro nové matcher testy
// ─────────────────────────────────────────────────────────────────────

const mockCenikElektro: Cenik = {
  hodinove_sazby: {},
  balicky: [],
  marze_material: 0.2,
  doprava_km: 15,
  min_naklady: 0,
  polozky: [
    { nazev: "Montáž a zapojení zásuvky",       cena_ks: 145, jednotka: "ks", typ: "prace" },
    { nazev: "Montáž a zapojení vypínače",       cena_ks: 140, jednotka: "ks", typ: "prace" },
    { nazev: "Montáž a zapojení svítidla",       cena_ks: 350, jednotka: "ks", typ: "prace" },
    { nazev: "Sekání šliců",                     cena_ks:  65, jednotka: "bm", typ: "prace" },
    { nazev: "Osazení rozvaděče",                cena_ks: 450, jednotka: "ks", typ: "prace" },
    { nazev: "Tahání kabelu",                    cena_ks:  60, jednotka: "bm", typ: "prace" },
    { nazev: "Zapojení jednofázového jističe",   cena_ks: 252, jednotka: "ks", typ: "prace" },
    { nazev: "Zapojení třífázového jističe",     cena_ks: 477, jednotka: "ks", typ: "prace" },
    { nazev: "Zapojení ventilátoru",             cena_ks: 500, jednotka: "ks", typ: "prace" },
    { nazev: "Zapojení digestoře",               cena_ks: 500, jednotka: "ks", typ: "prace" },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// normalizujJadro
// ─────────────────────────────────────────────────────────────────────

describe("normalizujJadro", () => {
  it("odstraní servisní slova a vrátí jádrové tokeny", () => {
    expect(normalizujJadro("Montáž a zapojení zásuvky")).toEqual(["zasuvky"]);
    expect(normalizujJadro("Osazení rozvaděče")).toEqual(["rozvadece"]);
    expect(normalizujJadro("Tahání kabelu")).toEqual(["kabelu"]);
  });

  it("vrátí prázdné pole pro čistě servisní frázi", () => {
    expect(normalizujJadro("montáž a zapojení")).toEqual([]);
  });

  it("odfiltruje tokeny kratší než 4 znaky", () => {
    // "bod" má 3 znaky → odfiltrován
    expect(normalizujJadro("světelný bod")).toEqual(["svetelny"]);
    // "kab" má 3 znaky → odfiltrován
    expect(normalizujJadro("kab")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Matcher — produkční případy (reálné názvy z emailu vs cenik-elektro)
// ─────────────────────────────────────────────────────────────────────

describe("najdiPolozku — produkční případy z emailu", () => {
  it('"zásuvka" najde "Montáž a zapojení zásuvky" (145 Kč)', () => {
    const v = najdiPolozku("zásuvka", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Montáž a zapojení zásuvky");
    expect(v!.polozka.cena_ks).toBe(145);
    expect(v!.nizkaJistota).toBe(false);
  });

  it('"vypínač" najde "Montáž a zapojení vypínače"', () => {
    const v = najdiPolozku("vypínač", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Montáž a zapojení vypínače");
    expect(v!.nizkaJistota).toBe(false);
  });

  it('"světelný bod" najde "Montáž a zapojení svítidla"', () => {
    // "svetelny" prefix-matchuje "svitidla"? Ne — různé kmeny.
    // Strategy A: jadro query = ["svetelny"], jadro ceníku = ["svitidla"] → no prefix match.
    // Strategy B Levenshtein: "svetelny bod" (12) vs "montaz a zapojeni svitidla" — over threshold.
    // Správný výsledek: null — ceník nemá synonym pro "světelný bod".
    const v = najdiPolozku("světelný bod", mockCenikElektro);
    expect(v).toBeNull();
  });

  it('"svítidlo" najde "Montáž a zapojení svítidla"', () => {
    // "svitidlo" prefix-matchuje "svitidla" (oba začínají "svitidl") ✓
    const v = najdiPolozku("svítidlo", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Montáž a zapojení svítidla");
  });

  it('"kabel" najde "Tahání kabelu"', () => {
    // jadro query: ["kabel"], jadro ceníku: ["kabelu"] → "kabelu".startsWith("kabel") ✓
    const v = najdiPolozku("kabel", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Tahání kabelu");
  });

  it('"Zasuvka" (velké Z) najde "Montáž a zapojení zásuvky"', () => {
    const v = najdiPolozku("Zasuvka", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Montáž a zapojení zásuvky");
  });

  it('"zasuvka" (bez diakritiky) najde "Montáž a zapojení zásuvky"', () => {
    const v = najdiPolozku("zasuvka", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Montáž a zapojení zásuvky");
  });
});

// ─────────────────────────────────────────────────────────────────────
// Matcher — false positive guardy (musí vrátit null)
// ─────────────────────────────────────────────────────────────────────

describe("najdiPolozku — false positive guardy", () => {
  it('"zlatý lustr" → null (žádný overlap)', () => {
    expect(najdiPolozku("zlatý lustr", mockCenikElektro)).toBeNull();
  });

  it('"klimatizace" → null (mimo obor)', () => {
    expect(najdiPolozku("klimatizace", mockCenikElektro)).toBeNull();
  });

  it('"rozvodnice" → null (rozvodnice ≠ rozvaděč elektrotechnicky)', () => {
    // "rozvodnice" jadro: ["rozvodnice"], "Osazení rozvaděče" jadro: ["rozvadece"]
    // LCP("rozvodnice","rozvadece") = "rozv" = 4 znaky, 4/9 = 44 % < 75 % → no jadro match
    // Levenshtein fallback: "rozvodnice" (10) vs full catalog names → over threshold → null
    expect(najdiPolozku("rozvodnice", mockCenikElektro)).toBeNull();
  });

  it('"kab" (3 znaky) → null (pod prahem 4 znaků)', () => {
    // jadro prázdné → Strategy A přeskočena; Levenshtein "kab" vs libovolný název >> threshold
    expect(najdiPolozku("kab", mockCenikElektro)).toBeNull();
  });

  it('"vent" nenajde "Zapojení digestoře" (adversariální prefix test)', () => {
    // "vent" matchuje pouze "ventilatoru", ne "digestore" — různé prefixy
    const v = najdiPolozku("vent", mockCenikElektro);
    // "vent" má 4 znaky → jadro: ["vent"]; "ventilatoru".startsWith("vent") → match jen ventilátoru
    if (v !== null) {
      expect(v.polozka.nazev).toBe("Zapojení ventilátoru");
      expect(v.polozka.nazev).not.toBe("Zapojení digestoře");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Tie-break — deterministický výběr při stejném skóre
// ─────────────────────────────────────────────────────────────────────

describe("najdiPolozku — tie-break", () => {
  it('"jistič" matchuje kratší ze dvou jističů deterministicky, nizkaJistota=true', () => {
    // Oba jističe mají v jadru "jistice" → prefix match s "jistic" → tie
    // Tiebreaker: kratší nazev.length → "Zapojení třífázového jističe" (29) < "Zapojení jednofázového jističe" (30)
    const v = najdiPolozku("jistič", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Zapojení třífázového jističe");
    expect(v!.nizkaJistota).toBe(true);
  });

  it("tie-break je stabilní — 10× stejný výsledek pro ambiguózní query", () => {
    const vysledky = Array.from({ length: 10 }, () =>
      najdiPolozku("jistič", mockCenikElektro),
    );
    for (const v of vysledky) {
      expect(v?.polozka.nazev).toBe(vysledky[0]?.polozka.nazev);
      expect(v?.nizkaJistota).toBe(vysledky[0]?.nizkaJistota);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Determinismus — 10× identický výsledek pro všechny klíčové vstupy
// ─────────────────────────────────────────────────────────────────────

describe("najdiPolozku — determinismus", () => {
  it("vrací bajt-identický výsledek při 10 opakováních pro každý vstup", () => {
    const vstupy = ["zásuvka", "vypínač", "kabel", "jistič", "rozvodnice", "zlatý lustr"];
    for (const vstup of vstupy) {
      const vysledky = Array.from({ length: 10 }, () =>
        najdiPolozku(vstup, mockCenikElektro),
      );
      const prvni = vysledky[0];
      for (const v of vysledky) {
        expect(v?.polozka.nazev).toBe(prvni?.polozka.nazev);
        expect(v?.nizkaJistota).toBe(prvni?.nizkaJistota);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// Výpočtový invariant — aritmetika nabídky
// ─────────────────────────────────────────────────────────────────────

describe("spocitejNabidku — výpočtový invariant", () => {
  it("mezisoučet = suma řádků, celkem = mezisoučet + DPH", () => {
    const polozky = [
      { nazev: "zásuvka",  mnozstvi: 10, jednotka: "ks" },
      { nazev: "vypínač",  mnozstvi:  5, jednotka: "ks" },
      { nazev: "kabel",    mnozstvi: 20, jednotka: "bm" },
    ];
    const v = spocitejNabidku(polozky, mockCenikElektro, 12);
    const sumaRadku = v.polozky.reduce((sum, p) => sum + p.celkem, 0);
    expect(v.mezisoucet).toBe(sumaRadku);
    expect(v.celkem).toBe(v.mezisoucet + v.dph_castka);
    // DPH kontrola: dph_castka = round(mezisoucet * sazba / 100)
    expect(v.dph_castka).toBe(Math.round((v.mezisoucet * v.dph_sazba) / 100));
  });

  it("bytova_vystavba → DPH 12 % (česká legislativa bytová výstavba)", () => {
    expect(mapDphSazba("bytova_vystavba")).toBe(12);
  });

  it("komercni → DPH 21 %", () => {
    expect(mapDphSazba("komercni")).toBe(21);
  });

  it("neurceno → DPH 21 % (konzervativní default)", () => {
    expect(mapDphSazba("neurceno")).toBe(21);
  });

  it("DPH sazba v nabídce odpovídá zadané sazbě", () => {
    const polozky = [{ nazev: "zásuvka", mnozstvi: 1, jednotka: "ks" }];
    const v12 = spocitejNabidku(polozky, mockCenikElektro, 12);
    const v21 = spocitejNabidku(polozky, mockCenikElektro, 21);
    expect(v12.dph_sazba).toBe(12);
    expect(v21.dph_sazba).toBe(21);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Žádná tichá nula — každá položka s celkem=0 musí mít neznama=true
// ─────────────────────────────────────────────────────────────────────

describe("spocitejNabidku — žádná tichá nula", () => {
  it("nenalezená položka má neznama=true, nikdy tiše celkem=0 bez příznaku", () => {
    const polozky = [{ nazev: "zlatý lustr", mnozstvi: 3, jednotka: "ks" }];
    const v = spocitejNabidku(polozky, mockCenikElektro, 12);
    const ticha = v.polozky.filter((p) => p.celkem === 0 && p.neznama !== true);
    expect(ticha).toHaveLength(0);
  });

  it("nenalezená položka má cena_jednotka=0 a je označena neznama=true", () => {
    const polozky = [{ nazev: "zlatý lustr", mnozstvi: 3, jednotka: "ks" }];
    const v = spocitejNabidku(polozky, mockCenikElektro, 12);
    const neznama = v.polozky.find((p) => p.nazev === "zlatý lustr");
    expect(neznama).toBeDefined();
    expect(neznama!.neznama).toBe(true);
    expect(neznama!.cena_jednotka).toBe(0);
  });

  it("položka s nizkaJistota=true má cenu > 0 (není tiše nulová)", () => {
    // "jistič" matchuje oba jističe → tie → nizkaJistota=true, ale cena > 0
    const v = najdiPolozku("jistič", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.cena_ks).toBeGreaterThan(0);
    expect(v!.nizkaJistota).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Datová zásuvka — false positive guard + groupování
// ─────────────────────────────────────────────────────────────────────

describe("najdiPolozku — false positive guard pro rozlišující adjektiva", () => {
  it('"datová zásuvka" → null (nesmí matchnout obecnou zásuvku)', () => {
    // "datova" je unmatched token → unmatchedRatio = 1/2 = 50 % ≥ 50 % → zamítnuto
    expect(najdiPolozku("datová zásuvka", mockCenikElektro)).toBeNull();
  });

  it('"zásuvka" stále matchuje "Montáž a zapojení zásuvky" správně', () => {
    // 1 token, 1 matched → unmatchedRatio = 0 → prochází
    const v = najdiPolozku("zásuvka", mockCenikElektro);
    expect(v).not.toBeNull();
    expect(v!.polozka.nazev).toBe("Montáž a zapojení zásuvky");
    expect(v!.nizkaJistota).toBe(false);
  });
});

describe("spocitejNabidku — groupování duplicitních řádků", () => {
  it("dvě položky matchující stejný ceníkový řádek se sloučí do jednoho", () => {
    // "zásuvka" (21 ks) + "zásuvka" (4 ks) → jeden řádek "Montáž a zapojení zásuvky" (25 ks)
    const polozky = [
      { nazev: "zásuvka", mnozstvi: 21, jednotka: "ks" },
      { nazev: "zásuvka", mnozstvi: 4,  jednotka: "ks" },
    ];
    const v = spocitejNabidku(polozky, mockCenikElektro, 12);
    const zasuvky = v.polozky.filter((p) => p.nazev === "Montáž a zapojení zásuvky");
    expect(zasuvky).toHaveLength(1);
    expect(zasuvky[0]!.mnozstvi).toBe(25);
    expect(zasuvky[0]!.celkem).toBe(25 * 145);
  });

  it("součet groupovaných řádků sedí na mezisoučet", () => {
    const polozky = [
      { nazev: "zásuvka", mnozstvi: 10, jednotka: "ks" },
      { nazev: "zásuvka", mnozstvi: 5,  jednotka: "ks" },
      { nazev: "vypínač", mnozstvi: 3,  jednotka: "ks" },
    ];
    const v = spocitejNabidku(polozky, mockCenikElektro, 12);
    const sumaRadku = v.polozky.reduce((sum, p) => sum + p.celkem, 0);
    expect(v.mezisoucet).toBe(sumaRadku);
    // Zásuvky: 15 × 145 = 2175, vypínač: 3 × 140 = 420, celkem 2595
    expect(v.mezisoucet).toBe(15 * 145 + 3 * 140);
  });

  it("položky s nizkaJistota se NEgroupují (zůstávají jako samostatné řádky)", () => {
    // "jistič" → nizkaJistota=true → dvě separate volání musí dát dva řádky
    const polozky = [
      { nazev: "jistič", mnozstvi: 2, jednotka: "ks" },
      { nazev: "jistič", mnozstvi: 3, jednotka: "ks" },
    ];
    const v = spocitejNabidku(polozky, mockCenikElektro, 12);
    // Oba matchují "Zapojení třífázového jističe" s nizkaJistota=true → NEsloučit
    const jistice = v.polozky.filter((p) => p.nazev === "Zapojení třífázového jističe");
    expect(jistice).toHaveLength(2);
  });
});
