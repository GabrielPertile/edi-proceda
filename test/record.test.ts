import { describe, expect, it } from "vitest";
import {
  date,
  decimal,
  defineRecord,
  digits,
  EdiFormatError,
  filler,
  formatRecord,
  int,
  parseRecord,
  text,
  time,
} from "../src/index.js";

const R = defineRecord({
  id: "999",
  name: "Registro de teste",
  length: 40,
  fields: [
    text("nome", 4, 10, { required: true }),
    digits("doc", 14, 5, { required: true }),
    decimal("valor", 19, 5, 2),
    date("data", 26),
    time("hora", 34),
    int("tipo", 38, 1),
    filler(39, 2),
  ],
});

describe("formatRecord", () => {
  it("aplica alinhamento, preenchimento e decimais implícitos", () => {
    const line = formatRecord(R, {
      nome: "joão",
      doc: "12-3",
      valor: 1234.5,
      data: "2026-10-14",
      hora: "09:05",
      tipo: 2,
    });
    //                 id  nome      doc  valor  data    hora t
    expect(line).toBe("999JOAO      0012301234501410202609052  ");
    expect(line).toHaveLength(40);
  });

  it("preenche campos ausentes com brancos e zeros", () => {
    expect(formatRecord(R, {})).toBe(`999${" ".repeat(10)}${"0".repeat(25)}  `);
  });

  it("corta texto longo, mas nunca números", () => {
    expect(formatRecord(R, { nome: "nome muito comprido" }).slice(3, 13)).toBe("NOME MUITO");
    expect(() => formatRecord(R, { valor: 100000 })).toThrow(EdiFormatError);
    expect(() => formatRecord(R, { nome: "x".repeat(11) }, { truncateText: false })).toThrow(
      EdiFormatError,
    );
  });

  it("arredonda decimais sem erro de ponto flutuante", () => {
    expect(formatRecord(R, { valor: 0.1 + 0.2 }).slice(18, 25)).toBe("0000030");
  });
});

describe("parseRecord", () => {
  it("faz o caminho inverso do formatRecord", () => {
    const values = {
      nome: "JOAO",
      doc: "00123",
      valor: 123.45,
      data: "2026-10-14",
      hora: "09:05",
      tipo: 2,
    };
    const { values: parsed, issues } = parseRecord(R, formatRecord(R, values));
    expect(issues).toEqual([]);
    expect(parsed).toEqual(values);
  });

  it("devolve null para datas e horas zeradas ou em branco", () => {
    const { values } = parseRecord(R, "999NOME      00001".padEnd(40, " "));
    expect(values).toMatchObject({ valor: 0, data: null, hora: null, tipo: null });
  });

  it("reporta problemas com linha, campo e posição, sem lançar", () => {
    const line = ["999", " ".repeat(10), "12A45", "0000000", "31022026", "9999", "0", "  "].join(
      "",
    );
    const { issues } = parseRecord(R, line, 7);
    expect(issues.map((i) => [i.code, i.field, i.position, i.line])).toEqual([
      ["REQUIRED_FIELD", "nome", 4, 7],
      ["INVALID_NUMERIC", "doc", 14, 7],
      ["INVALID_DATE", "data", 26, 7],
      ["INVALID_TIME", "hora", 34, 7],
    ]);
  });

  it("aceita linha curta como aviso e linha longa como erro", () => {
    const ok = formatRecord(R, { nome: "A", doc: "1" });
    expect(parseRecord(R, ok.trimEnd()).issues).toMatchObject([
      { code: "LINE_LENGTH", severity: "warning" },
    ]);
    expect(parseRecord(R, `${ok}XX`).issues).toMatchObject([
      { code: "LINE_LENGTH", severity: "error" },
    ]);
  });
});
