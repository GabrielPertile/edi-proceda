import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateNotfis, parseNotfis } from "../src/index.js";
import { EMBARCADORA_CNPJ, sample } from "./sample.js";

const fixture = readFileSync(new URL("./fixtures/notfis31-exemplo.txt", import.meta.url), "latin1");
const linesOf = (s: string) => s.split("\r\n").filter(Boolean);

describe("generateNotfis", () => {
  const output = generateNotfis(sample);
  const lines = linesOf(output);

  it("gera registros de 240 posições na ordem hierárquica do manual", () => {
    expect(lines.every((l) => l.length === 240)).toBe(true);
    expect(lines.map((l) => l.slice(0, 3))).toEqual([
      "000",
      "310",
      "311",
      "312",
      "313",
      "333",
      "314",
      "314",
      "312",
      "313",
      "317",
      "318",
    ]);
  });

  it("posiciona os campos exatamente como o manual descreve", () => {
    const at = (line: string, start: number, length: number) =>
      line.slice(start - 1, start - 1 + length);
    const [h, , emb, dest, nf] = lines as [string, string, string, string, string];

    expect(at(h, 74, 6)).toBe("141026"); // data DDMMAA
    expect(at(emb, 4, 14)).toBe(EMBARCADORA_CNPJ);
    expect(at(emb, 33, 40).trim()).toBe("RUA DAS ARAUCARIAS, 100"); // maiúsculas, sem acento
    expect(at(dest, 44, 14)).toBe("00052998224725"); // CPF alinhado à direita com zeros
    expect(at(nf, 33, 8)).toBe("00001234"); // número da NF
    expect(at(nf, 86, 15)).toBe("000000001543210"); // N 13,2 sem vírgula
    expect(at(nf, 101, 7)).toBe("0025050"); // peso N 5,2
  });

  it("calcula o registro 318 quando os totais não são informados", () => {
    const tot = lines.at(-1) ?? "";
    expect(tot.slice(3, 18)).toBe("000000001633200"); // 15432,10 + 899,90
    expect(tot.slice(18, 33)).toBe("000000000029250"); // 250,50 + 42,00
  });

  it("é determinístico e bate com a fixture versionada", () => {
    expect(output).toBe(fixture);
  });
});

describe("parseNotfis", () => {
  it("lê a fixture sem erros nem avisos", () => {
    const result = parseNotfis(fixture);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("monta a árvore documento → embarcadora → destinatário → nota", () => {
    const { data } = parseNotfis(fixture);
    const nota = data.documentos[0]?.embarcadoras[0]?.destinatarios[0]?.notas[0];

    expect(data.cabecalho).toMatchObject({ data: "2026-10-14", hora: "13:57" });
    expect(nota).toMatchObject({
      numero: "00001234",
      dataEmissao: "2026-10-14",
      valorTotal: 15432.1,
      peso: 250.5,
      condicaoFrete: "C",
    });
    expect(nota?.mercadorias).toHaveLength(5);
    expect(nota?.mercadorias[4]).toEqual({
      volumes: 0.5,
      especie: "AVULSO",
      mercadoria: "PARAFUSOS",
    });
    expect(nota?.complemento?.entregasCasadas).toEqual([
      { cnpj: "011222333000181", serie: "2", numero: "00000777" },
    ]);
    expect(data.documentos[0]?.totais?.valorTotal).toBe(16332);
  });

  it("parse → generate reproduz o arquivo byte a byte", () => {
    const { data } = parseNotfis(fixture);
    expect(generateNotfis(data)).toBe(fixture);
  });

  it("aceita quebras de linha LF e BOM", () => {
    expect(parseNotfis(`﻿${fixture.replaceAll("\r\n", "\n")}`).ok).toBe(true);
  });

  it("aponta divergência entre o 318 e a soma das notas", () => {
    const doc = sample.documentos[0];
    const changed = {
      ...sample,
      documentos: [
        {
          ...doc,
          embarcadoras: doc?.embarcadoras ?? [],
          totais: { valorTotal: 1, pesoTotal: 292.5, volumesTotal: 13 },
        },
      ],
    };
    const result = parseNotfis(generateNotfis(changed));
    expect(result.ok).toBe(true); // divergência é aviso, não erro
    expect(result.issues).toMatchObject([
      { code: "TOTALS_MISMATCH", field: "valorTotal", severity: "warning", line: 12 },
    ]);
  });

  it("detecta registros fora da hierarquia, desconhecidos e ausentes", () => {
    const lines = linesOf(fixture);
    const broken = [lines[0], lines[1], lines[4], "999XYZ", lines[11]].join("\r\n");
    const result = parseNotfis(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => [i.code, i.line])).toEqual([
      ["UNEXPECTED_RECORD", 3],
      ["UNKNOWN_RECORD", 4],
      ["TOTALS_MISMATCH", 5],
      ["TOTALS_MISMATCH", 5],
      ["TOTALS_MISMATCH", 5],
    ]);
    expect(parseNotfis(lines.slice(1).join("\n")).issues[0]).toMatchObject({
      code: "UNEXPECTED_RECORD",
      record: "310",
    });
  });

  it("valida CNPJ do embarcador", () => {
    const lines = linesOf(fixture);
    lines[2] = `311${"11222333000182"}${lines[2]?.slice(17)}`;
    expect(parseNotfis(lines.join("\r\n")).issues).toMatchObject([
      { code: "INVALID_CNPJ", line: 3, record: "311", severity: "warning" },
    ]);
  });
});
