# PROGRESS.md

Živý záznam vývoje. Updatuj po každém větším kroku.

**Pravidlo:** Žádné rozhodnutí není malé. Když si nejsi jistý, zapiš do "Otevřené otázky".

---

## Aktuální stav projektu

**Fáze:** Foundation (Sprint 1)  
**Last commit:** _(žádný zatím)_  
**Demo URL:** _(po prvním deploy)_  
**Test coverage:** _TBD_

### Severní hvězda KPI
Rodič po otevření appky cítí úlevu.

### Klíčové metriky (až bude analytics živá)
- 7denní retence: _TBD_
- Týdenní průměr relief check-in skóre: _TBD_
- Free → Premium konverze (14 dní): _TBD_
- Crisis detection accuracy: _TBD_

---

## [2026-05-15] — Sprint 1: Foundation (krok 1/7)

### ✅ Hotovo
- Next.js 16.2.6 (App Router) inicializován do kořenové složky
- TypeScript `strict: true` ověřeno v `tsconfig.json`
- Tailwind CSS v4 nainstalován (konfigurace přes `@theme` v `globals.css`)
- ESLint 9 nakonfigurován (`eslint.config.mjs`)
- `pnpm install` proběhl čistě (350 balíků, sharp + unrs-resolver build scripts schváleny)
- `pnpm typecheck` — 0 errorů
- `pnpm lint` — 0 errorů
- `package.json` doplněn o skript `typecheck: tsc --noEmit`

### 🚧 Rozpracováno
- _(zatím nic)_

### 🔮 Další krok
**Sprint 1, krok 2:** shadcn/ui setup + design tokeny v `globals.css`
- `pnpm dlx shadcn@latest init`
- Design tokeny (barvy, spacing, font) podle `docs/DESIGN.md` přes Tailwind v4 `@theme`

### 🚫 Blokátory
Žádné.

### ❓ Otevřené otázky pro produktové rozhodnutí
- `create-next-app` nainstaloval Next.js 16.2.6 (ne 15.x) — nejnovější stabilní verze v době instalace. Kompatibilní se všemi plánovanými závislostmi.

### 📊 Technický dluh
- Žádný.

### 💡 Postřehy / learnings
- `pnpm create next-app .` odmítá složky s velkými písmeny (BABYAPP) — workaround: projekt vytvořen do dočasné složky `tinysteps-ai`, soubory přesunuty ručně.
- pnpm 11 vyžaduje explicitní schválení build scriptů přes `pnpm-workspace.yaml` (klíč `allowBuilds`).
- Tailwind v4 — žádný `tailwind.config.ts`, konfigurace výhradně přes `globals.css`.

---

## [2026-05-15] — Sprint 0: Project setup

### ✅ Hotovo
- Vytvořena dokumentační struktura (`docs/`)
- CLAUDE.md, README.md, .env.example, .gitignore
- PRODUCT.md, DESIGN.md, AI.md, DATABASE.md, SECURITY.md, COPY.md, DECISIONS.md, ROADMAP.md
- Initial ADRs (001-005): paywall, multi-agent AI, EU region, i18n, shadcn/ui

### 🚧 Rozpracováno
- _(zatím nic)_

### 🔮 Další krok
**Sprint 1: Foundation**
1. `pnpm create next-app` s TS, Tailwind, App Router, ESLint
2. Setup shadcn/ui + design tokens v `globals.css`
3. Husky + lint-staged + Prettier
4. next-intl setup s `cs` default
5. Supabase projekt v Frankfurt regionu
6. Initial migration s schema z `docs/DATABASE.md`
7. Magic link auth flow
8. Deploy na Vercel s preview deploys

### 🚫 Blokátory
Žádné.

### ❓ Otevřené otázky pro produktové rozhodnutí
- _(zatím žádné)_

### 📊 Technický dluh
- _(zatím žádný)_

### 💡 Postřehy / learnings
- _(zatím žádné)_

---

## Šablona pro další sprint (zkopíruj nahoru)

```
## [YYYY-MM-DD] — Sprint X: _Název_

### ✅ Hotovo
- 

### 🚧 Rozpracováno
- 

### 🔮 Další krok
- 

### 🚫 Blokátory
- 

### ❓ Otevřené otázky pro produktové rozhodnutí
- 

### 📊 Technický dluh
- 

### 💡 Postřehy / learnings
- 
```

---

## Eval log

Záznam jak si vede AI eval set. Spouštět před každým deployem na prod.

| Datum | Commit | Pass rate | Regrese |
|-------|--------|-----------|---------|
| _TBD_ | _TBD_ | _TBD_ | _TBD_ |
