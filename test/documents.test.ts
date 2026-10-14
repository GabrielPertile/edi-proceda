import { describe, expect, it } from "vitest";
import { isValidCnpj, isValidCpf } from "../src/index.js";

describe("isValidCnpj", () => {
  it("aceita CNPJ numérico com ou sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("aceita o novo CNPJ alfanumérico", () => {
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("12abc34501de35")).toBe(true);
  });

  it("rejeita dígito errado, tamanho errado e sequências repetidas", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("12ABC34501DE36")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("12ABC34501DEAB")).toBe(false);
  });
});

describe("isValidCpf", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
  });
});
