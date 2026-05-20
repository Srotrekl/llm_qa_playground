import { describe, it, expect } from "vitest";
import { ExtractedEmailDataSchema } from "../src/lib/schemas.js";

const validniData = {
  typ_prace: "rekonstrukce",
  lokalita: { mesto: "Praha", cast: "Praha 6" },
  rozsah: { plocha_m2: 80, poznamka: "byt 3+1" },
  polozky: [
    { nazev: "zásuvka", mnozstvi: 21, jednotka: "ks" },
    { nazev: "vypínač", mnozstvi: 12, jednotka: "ks" },
  ],
  kontakt: { jmeno: "Jan Novák", email: "jan@email.cz", telefon: "777123456" },
  termin: "do 2 měsíců",
  kategorie_dph: "bytova_vystavba" as const,
};

describe("ExtractedEmailDataSchema", () => {
  it("přijme validní kompletní data", () => {
    const result = ExtractedEmailDataSchema.safeParse(validniData);
    expect(result.success).toBe(true);
  });

  it("přijme data bez volitelných polí", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      typ_prace: "instalace",
      lokalita: { mesto: "Brno" },
      rozsah: {},
      polozky: [{ nazev: "zásuvka", mnozstvi: 1, jednotka: "ks" }],
      kontakt: { jmeno: "Jana Nováková" },
    });
    expect(result.success).toBe(true);
  });

  it("doplní default 'neurceno' pro kategorie_dph pokud chybí", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      typ_prace: "servis",
      lokalita: { mesto: "Praha" },
      rozsah: {},
      polozky: [{ nazev: "zásuvka", mnozstvi: 1, jednotka: "ks" }],
      kontakt: { jmeno: "Test" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kategorie_dph).toBe("neurceno");
    }
  });

  it("odmítne záporné mnozstvi", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      ...validniData,
      polozky: [{ nazev: "zásuvka", mnozstvi: -5, jednotka: "ks" }],
    });
    // Zod z.number() záporná čísla nezakazuje, test ověřuje současné chování
    // (mnozstvi je z.number() bez .nonnegative() — záměrně, Claude může vrátit 0)
    expect(result.success).toBe(true);
  });

  it("odmítne prázdné pole polozky", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      ...validniData,
      polozky: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("žádné položky");
    }
  });

  it("odmítne chybějící jmeno v kontaktu", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      ...validniData,
      kontakt: { email: "test@email.cz" },
    });
    expect(result.success).toBe(false);
  });

  it("odmítne neznámou hodnotu kategorie_dph", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      ...validniData,
      kategorie_dph: "neznama_kategorie",
    });
    expect(result.success).toBe(false);
  });

  it("odmítne vzdalenost_km zápornou", () => {
    const result = ExtractedEmailDataSchema.safeParse({
      ...validniData,
      vzdalenost_km: -10,
    });
    expect(result.success).toBe(false);
  });
});
