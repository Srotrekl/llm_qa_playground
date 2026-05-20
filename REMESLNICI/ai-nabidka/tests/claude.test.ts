import { describe, it, expect } from "vitest";
import { extractJSON } from "../src/lib/claude.js";

describe("extractJSON", () => {
  it("zparsuje validní JSON bez wrapperů", () => {
    const result = extractJSON('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("zparsuje JSON obalený v markdown fencích", () => {
    const result = extractJSON('```json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: "value" });
  });

  it("zparsuje JSON s } uvnitř stringu", () => {
    const result = extractJSON('{"text": "Děkujeme :}", "cislo": 42}');
    expect(result).toEqual({ text: "Děkujeme :}", cislo: 42 });
  });

  it("zparsuje JSON s escaped uvozovkou uvnitř stringu", () => {
    const result = extractJSON('{"text": "řekl \\"ahoj\\""}');
    expect(result).toEqual({ text: 'řekl "ahoj"' });
  });

  it("hází chybu pokud odpověď neobsahuje JSON objekt", () => {
    expect(() => extractJSON("Tady žádný JSON není.")).toThrow(
      "[CLAUDE] Odpověď neobsahuje validní JSON objekt.",
    );
  });

  it("hází chybu pokud JSON není uzavřen", () => {
    expect(() => extractJSON('{"key": "value"')).toThrow(
      "[CLAUDE] JSON objekt není uzavřen",
    );
  });

  it("hází chybu pokud JSON je syntakticky chybný", () => {
    expect(() => extractJSON('{"key": nevalidni}')).toThrow("[CLAUDE] Nelze zparsovat JSON");
  });

  it("ignoruje text před a za JSON objektem", () => {
    const result = extractJSON('Tady je výsledek: {"a": 1} a tady nic.');
    expect(result).toEqual({ a: 1 });
  });
});
