/**
 * Sdílené TypeScript interfaces pro celý tok dat ai-nabidka.
 *
 * Tok:  email → ExtractedEmailData → Nabidka → PDF
 */

// ─────────────────────────────────────────────────────────────────────
// 1. Výstup z Claude API Call #1 (extrakce dat z emailu)
// ─────────────────────────────────────────────────────────────────────

/**
 * Typ poptávaných prací. Volný string — Claude vrátí stručný typ jedním slovem
 * (např. "rekonstrukce", "instalace", "oprava", "servis", "přípojka",
 * "fotovoltaika", "revize", …). Uzavřený union by zbytečně failoval validaci.
 */
export type TypPrace = string;

/** Lokalita zakázky. */
export interface Lokalita {
  /** Město (např. "Praha"). */
  mesto: string;
  /** Část města (např. "Praha 6", "Dejvice"). Volitelné. */
  cast?: string;
  /** Ulice nebo přesnější adresa. Volitelné. */
  ulice?: string;
}

/** Rozsah prací (velikost objektu + volná poznámka). */
export interface Rozsah {
  /** Plocha v m². Volitelné. */
  plocha_m2?: number;
  /** Poznámka k rozsahu (např. "byt 3+1, panelový dům"). Volitelné. */
  poznamka?: string;
}

/** Jedna položka extrahovaná z emailu zákazníka. */
export interface EmailPolozka {
  /** Název položky tak, jak ho lze najít v ceníku (normalizovaný). */
  nazev: string;
  /** Množství. */
  mnozstvi: number;
  /** Jednotka (ks, bm, hod, komplet, …). */
  jednotka: string;
}

/** Kontakt na zákazníka. */
export interface Kontakt {
  /** Celé jméno zákazníka. */
  jmeno: string;
  /** E-mail. Volitelné. */
  email?: string;
  /** Telefon. Volitelné. */
  telefon?: string;
}

/** Strukturovaná data extrahovaná z poptávkového emailu (výstup Claude Call #1). */
export interface ExtractedEmailData {
  /** Typ poptávaných prací. */
  typ_prace: TypPrace;
  /** Lokalita zakázky. */
  lokalita: Lokalita;
  /** Rozsah prací. */
  rozsah: Rozsah;
  /** Seznam poptávaných položek. */
  polozky: EmailPolozka[];
  /** Kontakt na zákazníka. */
  kontakt: Kontakt;
  /** Požadovaný termín realizace. Volitelné. */
  termin?: string;
  /** Ostatní poznámky z emailu. Volitelné. */
  poznamky?: string;
  /** Kategorie DPH určená Claudem podle kontextu emailu. */
  kategorie_dph: "bytova_vystavba" | "komercni" | "neurceno";
  /** Přibližná vzdálenost zakázky od sídla firmy v km. Volitelné. */
  vzdalenost_km?: number;
}

// ─────────────────────────────────────────────────────────────────────
// 2. Ceník (cenik-elektro.json)
// ─────────────────────────────────────────────────────────────────────

/** Jedna položka v ceníku. */
export interface CenikPolozka {
  /** Oficiální název položky v ceníku. */
  nazev: string;
  /** Cena za jednotku v Kč bez DPH. */
  cena_ks: number;
  /** Jednotka (ks, bm, hod, …). */
  jednotka: string;
  /** Typ položky — "material" = navýší o marzi, "prace" = bez marže. Volitelné. */
  typ?: "material" | "prace";
}

/** Předdefinovaný balíček prací (komplet rekonstrukce, …). */
export interface CenikBalicek {
  /** Název balíčku. */
  nazev: string;
  /** Co balíček zahrnuje. Volitelné. */
  rozsah?: string;
  /** Spodní hranice ceny v Kč bez DPH. */
  cena_od: number;
  /** Horní hranice ceny v Kč bez DPH. */
  cena_do: number;
}

/** Kompletní ceník elektrofirmy. */
export interface Cenik {
  /** Hodinové sazby (např. elektrikar_prvni_hodina, revizni_technik, …). */
  hodinove_sazby: Record<string, number>;
  /** Jednotlivé položky. */
  polozky: CenikPolozka[];
  /** Balíčky prací. */
  balicky: CenikBalicek[];
  /** Marže na materiál (např. 0.20 = 20 %). */
  marze_material: number;
  /** Cena za km dopravy v Kč. */
  doprava_km: number;
  /** Minimální fakturované náklady v Kč. */
  min_naklady: number;
}

// ─────────────────────────────────────────────────────────────────────
// 3. Vypočtená nabídka (vstup do HTML šablony / PDF)
// ─────────────────────────────────────────────────────────────────────

/** Jedna vypočtená položka nabídky. */
export interface NabidkaPolozka {
  /** Zobrazovaný název (z ceníku, nebo původní pokud nenalezeno). */
  nazev: string;
  /** Množství. */
  mnozstvi: number;
  /** Jednotka. */
  jednotka: string;
  /** Cena za jednotku v Kč bez DPH. */
  cena_jednotka: number;
  /** Celková cena za položku bez DPH (mnozstvi × cena_jednotka). */
  celkem: number;
  /** True = položka nenalezena v ceníku → v PDF se zvýrazní žlutě s ⚠. */
  neznama?: boolean;
}

/** Finální nabídka připravená k vyrenderování do PDF. */
export interface Nabidka {
  /** Číslo nabídky, např. "NAB-20260519-143022". */
  cislo: string;
  /** Datum vystavení v českém formátu, např. "19. 5. 2026". */
  datum: string;
  /** Kontakt na klienta. */
  klient: Kontakt;
  /** Lokalita realizace. */
  lokalita: Lokalita;
  /** Položky nabídky. */
  polozky: NabidkaPolozka[];
  /** Mezisoučet bez DPH. */
  mezisoucet: number;
  /** Sazba DPH v procentech — pouze povolené hodnoty 12 nebo 21. */
  dph_sazba: 12 | 21;
  /** Částka DPH v Kč. */
  dph_castka: number;
  /** Celkem s DPH. */
  celkem: number;
  /** Úvodní odstavec textu nabídky (Claude Call #2). Volitelné. */
  text_uvod?: string;
  /** Závěrečný odstavec (platnost, výzva k upřesnění). Volitelné. */
  text_zaver?: string;
}
