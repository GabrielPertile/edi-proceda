import { describe, expect, it } from "vitest";
import { NOTFIS_31 } from "../src/index.js";

describe("layout NOTFIS 3.1", () => {
  for (const [name, def] of Object.entries(NOTFIS_31.records)) {
    it(`${name}: campos contíguos começando na posição 4 e somando 240`, () => {
      let cursor = 4; // posições 1-3 são o identificador do registro
      for (const f of def.fields) {
        expect(f.start, `${def.id}.${f.key}`).toBe(cursor);
        cursor += f.length;
      }
      expect(cursor - 1).toBe(240);
    });
  }

  // Conferência pontual contra posições citadas no manual PROCEDA.
  it.each([
    ["R311", "dataEmbarque", 126, 8],
    ["R312", "cep", 168, 9],
    ["R313", "numero", 33, 8],
    ["R313", "valorTotal", 86, 15],
    ["R313", "valorIcms", 214, 12],
    ["R333", "despesasAdicionais", 189, 15],
    ["R314", "mercadoria4", 182, 30],
    ["R318", "valorSeguroTotal", 79, 15],
  ] as const)("%s.%s começa em %i com %i posições", (record, key, start, length) => {
    const def = NOTFIS_31.records[record];
    const f = def.fields.find((x) => x.key === key);
    expect(f).toMatchObject({ start, length });
  });
});
