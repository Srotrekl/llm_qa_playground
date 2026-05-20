import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
// Výstup Claude Call #1 — extrakce dat z emailu
// ─────────────────────────────────────────────────────────────────────

export const ExtractedEmailDataSchema = z.object({
  typ_prace: z.string().min(1),
  lokalita: z.object({
    mesto: z.string().min(1),
    cast: z.string().optional(),
    ulice: z.string().optional(),
  }),
  rozsah: z.object({
    plocha_m2: z.number().optional(),
    poznamka: z.string().optional(),
  }),
  polozky: z
    .array(
      z.object({
        nazev: z.string().min(1),
        mnozstvi: z.number().positive().max(100000),
        jednotka: z.string().min(1),
      }),
    )
    .min(1, "Odpověď neobsahuje žádné položky."),
  kontakt: z.object({
    jmeno: z.string().min(1),
    email: z.string().email().max(200).optional(),
    telefon: z.string().optional(),
  }),
  termin: z.string().optional(),
  poznamky: z.string().optional(),
  kategorie_dph: z.enum(["bytova_vystavba", "komercni", "neurceno"]).default("neurceno"),
  vzdalenost_km: z.number().nonnegative().optional(),
});

export type ExtractedEmailDataFromSchema = z.infer<typeof ExtractedEmailDataSchema>;

// ─────────────────────────────────────────────────────────────────────
// Výstup Claude Call #2 — texty nabídky
// ─────────────────────────────────────────────────────────────────────

export const OfferTextsSchema = z.object({
  text_uvod: z.string().min(1),
  text_zaver: z.string().min(1),
});

export type OfferTexts = z.infer<typeof OfferTextsSchema>;
