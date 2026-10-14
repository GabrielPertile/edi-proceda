import { describe, expect, it } from "vitest";
import { nfeToNotfisInput, notfisFromNfe, parseNfe, parseNotfis } from "../src/index.js";
import { DESTINATARIO_CNPJ, DESTINATARIO_CPF, EMBARCADORA_CNPJ } from "./sample.js";

/** Monta o XML de uma NF-e 4.00 fictícia, no envelope <nfeProc> como sai do emissor. */
function nfeXml(o: {
  numero: string;
  dest?: string;
  modFrete?: string;
  entrega?: boolean;
  transporta?: boolean;
}): string {
  const dest = o.dest ?? DESTINATARIO_CNPJ;
  const docTag = dest.length === 11 ? "CPF" : "CNPJ";
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe versao="4.00" Id="NFe41261011222333000181550010000${o.numero.padStart(4, "0")}10000000019">
<ide><natOp>VENDA DE MERCADORIA</natOp><serie>1</serie><nNF>${o.numero}</nNF><dhEmi>2026-10-14T09:00:00-03:00</dhEmi><dhSaiEnt>2026-10-15T08:00:00-03:00</dhSaiEnt></ide>
<emit><CNPJ>${EMBARCADORA_CNPJ}</CNPJ><xNome>Indústria Exemplo &amp; Cia</xNome><enderEmit><xLgr>Rua das Araucárias</xLgr><nro>100</nro><xBairro>Centro</xBairro><cMun>4106902</cMun><xMun>Curitiba</xMun><UF>PR</UF><CEP>80000000</CEP></enderEmit><IE>1234567890</IE></emit>
<dest><${docTag}>${dest}</${docTag}><xNome>Comércio Fictício</xNome><enderDest><xLgr>Av. Central</xLgr><nro>500</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><xMun>São Paulo</xMun><UF>SP</UF><CEP>01000000</CEP></enderDest><IE>ISENTO</IE></dest>
${o.entrega ? "<entrega><CNPJ>98765432000198</CNPJ><xLgr>Rua do Depósito</xLgr><nro>9</nro><xBairro>Industrial</xBairro><cMun>3509502</cMun><xMun>Campinas</xMun><UF>SP</UF><CEP>13000000</CEP></entrega>" : ""}
<det nItem="1"><prod><cProd>A1</cProd><xProd>Rolamento 6205</xProd><CFOP>5102</CFOP><uCom>CX</uCom><qCom>6.0000</qCom><vProd>100.00</vProd></prod></det>
<det nItem="2"><prod><cProd>A2</cProd><xProd>Retentor</xProd><CFOP>5102</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vProd>50.50</vProd></prod></det>
<total><ICMSTot><vICMS>18.09</vICMS><vST>0.00</vST><vProd>150.50</vProd><vNF>150.50</vNF></ICMSTot></total>
<transp><modFrete>${o.modFrete ?? "0"}</modFrete>${o.transporta === false ? "" : "<transporta><CNPJ>98765432000198</CNPJ><xNome>Transportadora Exemplo</xNome></transporta>"}
<vol><qVol>2</qVol><esp>CAIXA</esp><pesoL>10.000</pesoL><pesoB>12.500</pesoB></vol><vol><qVol>1</qVol><pesoB>3.250</pesoB></vol></transp>
</infNFe></NFe><protNFe/></nfeProc>`;
}

describe("parseNfe", () => {
  const nfe = parseNfe(nfeXml({ numero: "1234" }));

  it("lê identificação, participantes e totais", () => {
    expect(nfe.chave).toHaveLength(44);
    expect(nfe).toMatchObject({
      serie: "1",
      numero: "1234",
      dataEmissao: "2026-10-14",
      dataSaida: "2026-10-15",
      naturezaOperacao: "VENDA DE MERCADORIA",
      modalidadeFrete: "0",
      transportadora: { cnpjCpf: "98765432000198", nome: "Transportadora Exemplo" },
      totais: { valorNota: 150.5, icms: 18.09, icmsSt: 0 },
    });
    expect(nfe.emitente.nome).toBe("Indústria Exemplo & Cia"); // entidade decodificada
    expect(nfe.destinatario.endereco.municipio).toBe("São Paulo");
  });

  it("lê todos os itens e volumes", () => {
    expect(nfe.itens.map((i) => [i.descricao, i.quantidade, i.unidade])).toEqual([
      ["Rolamento 6205", 6, "CX"],
      ["Retentor", 2, "UN"],
    ]);
    expect(nfe.volumes.map((v) => v.pesoBruto)).toEqual([12.5, 3.25]);
  });

  it("rejeita XML que não é NF-e", () => {
    expect(() => parseNfe("<evento/>")).toThrow(/infNFe/);
  });
});

describe("notfisFromNfe", () => {
  it("gera um NOTFIS válido a partir de uma nota", () => {
    const txt = notfisFromNfe(nfeXml({ numero: "1234" }));
    const { ok, issues, data } = parseNotfis(txt);

    expect(ok).toBe(true);
    expect(issues).toEqual([]);
    expect(data.cabecalho?.destinatario).toBe("TRANSPORTADORA EXEMPLO");

    const emb = data.documentos[0]?.embarcadoras[0];
    expect(emb?.cnpj).toBe(EMBARCADORA_CNPJ);
    expect(emb?.dataEmbarque).toBe("2026-10-15");

    const nota = emb?.destinatarios[0]?.notas[0];
    expect(nota).toMatchObject({
      numero: "00001234",
      condicaoFrete: "C",
      especie: "CAIXA",
      volumes: 3,
      peso: 15.75,
      valorTotal: 150.5,
      valorIcms: 18.09,
    });
    expect(nota?.complemento?.cfop).toBe("5102");
    expect(nota?.mercadorias.map((m) => m.mercadoria)).toEqual(["ROLAMENTO 6205", "RETENTOR"]);
  });

  it("agrupa várias notas por destinatário e soma os totais", () => {
    const txt = notfisFromNfe([
      nfeXml({ numero: "1001" }),
      nfeXml({ numero: "1002", dest: DESTINATARIO_CPF, modFrete: "1" }),
      nfeXml({ numero: "1003" }),
    ]);
    const { ok, data } = parseNotfis(txt);

    expect(ok).toBe(true);
    const doc = data.documentos[0];
    expect(doc?.embarcadoras).toHaveLength(1);

    const [cnpj, cpf] = doc?.embarcadoras[0]?.destinatarios ?? [];
    expect(cnpj?.notas.map((n) => n.numero)).toEqual(["00001001", "00001003"]);
    expect(cpf?.tipoIdentificacao).toBe("2");
    expect(cpf?.notas[0]?.condicaoFrete).toBe("F");
    expect(doc?.totais?.valorTotal).toBe(451.5);
  });

  it("usa o local de entrega quando a nota tem <entrega>", () => {
    const input = nfeToNotfisInput(nfeXml({ numero: "1", entrega: true }));
    const dest = input.documentos[0]?.embarcadoras[0]?.destinatarios[0];
    expect(dest).toMatchObject({
      cidade: "Campinas",
      cep: "13000000",
      endereco: "Rua do Depósito, 9",
    });
  });

  it("aplica opções e ajustes por nota", () => {
    const txt = notfisFromNfe(nfeXml({ numero: "1", transporta: false }), {
      destinatario: "Outra Transportadora",
      dataEmbarque: "2026-10-20",
      mercadorias: false,
      nota: (nfe) => ({ tipoIcms: "S", romaneio: `R-${nfe.numero}` }),
    });
    const { data } = parseNotfis(txt);
    const emb = data.documentos[0]?.embarcadoras[0];
    const nota = emb?.destinatarios[0]?.notas[0];

    expect(data.cabecalho?.destinatario).toBe("OUTRA TRANSPORTADORA");
    expect(emb?.dataEmbarque).toBe("2026-10-20");
    expect(nota).toMatchObject({ tipoIcms: "S", romaneio: "R-1", mercadorias: [] });
  });

  it("exige o destinatário quando nenhuma nota informa a transportadora", () => {
    expect(() => notfisFromNfe(nfeXml({ numero: "1", transporta: false }))).toThrow(/destinatario/);
  });

  it("identifica qual NF-e da lista é inválida", () => {
    expect(() => notfisFromNfe([nfeXml({ numero: "1" }), "<x/>"])).toThrow(/NF-e #2/);
  });
});
