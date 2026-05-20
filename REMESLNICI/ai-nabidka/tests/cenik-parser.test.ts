import { describe, it, expect } from "vitest";
import { najdiPolozku, normalizuj, spocitejNabidku } from "../src/lib/cenik-parser.js";
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
    const polozky = [{ nazev: "montáž", mnozstvi: 1, jednotka: "ks" }];
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
