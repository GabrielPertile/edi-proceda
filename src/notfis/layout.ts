/**
 * NOTFIS 3.1 (PROCEDA, revisão de 28/03/2000). Registros de 240 posições.
 *
 * Posições, tamanhos e obrigatoriedade transcritos do manual oficial. Os nomes dos
 * campos seguem a nomenclatura do manual, em camelCase. O teste
 * `layout.test.ts` garante que os campos de cada registro são contíguos e somam 240.
 */
import {
  date,
  date6,
  decimal,
  defineRecord,
  digits,
  filler,
  int,
  text,
  time,
} from "../core/fields.js";

const LENGTH = 240;
const M = { required: true } as const;

/** 000 – UNB: cabeçalho de intercâmbio. Um por arquivo. */
export const R000 = defineRecord({
  id: "000",
  name: "Cabeçalho de intercâmbio",
  length: LENGTH,
  fields: [
    text("remetente", 4, 35, M),
    text("destinatario", 39, 35, M),
    date6("data", 74, M),
    time("hora", 80, M),
    text("intercambio", 84, 12, M),
    filler(96, 145),
  ],
});

/** 310 – UNH: cabeçalho de documento. Até 200 por arquivo. */
export const R310 = defineRecord({
  id: "310",
  name: "Cabeçalho de documento",
  length: LENGTH,
  fields: [text("documento", 4, 14, M), filler(18, 223)],
});

/** 311 – DEM: dados da embarcadora. Até 10 por 310. */
export const R311 = defineRecord({
  id: "311",
  name: "Dados da embarcadora",
  length: LENGTH,
  fields: [
    digits("cnpj", 4, 14, M),
    text("inscricaoEstadual", 18, 15),
    text("endereco", 33, 40),
    text("cidade", 73, 35),
    text("cep", 108, 9),
    text("uf", 117, 9),
    date("dataEmbarque", 126, M),
    text("razaoSocial", 134, 40),
    filler(174, 67),
  ],
});

/** 312 – DES: destinatário da mercadoria. Até 500 por 311. */
export const R312 = defineRecord({
  id: "312",
  name: "Dados do destinatário",
  length: LENGTH,
  fields: [
    text("razaoSocial", 4, 40),
    digits("cnpjCpf", 44, 14, M),
    text("inscricaoEstadual", 58, 15),
    text("endereco", 73, 40),
    text("bairro", 113, 20),
    text("cidade", 133, 35),
    text("cep", 168, 9, M),
    text("codigoMunicipio", 177, 9),
    text("uf", 186, 9),
    text("areaFrete", 195, 4),
    text("comunicacao", 199, 35),
    /** 1 = CNPJ, 2 = CPF */
    text("tipoIdentificacao", 234, 1),
    filler(235, 6),
  ],
});

/** 313 – DNF: dados da nota fiscal. Até 40 por 312. */
export const R313 = defineRecord({
  id: "313",
  name: "Dados da nota fiscal",
  length: LENGTH,
  fields: [
    text("romaneio", 4, 15),
    text("codigoRota", 19, 7),
    /** 1 rodoviário, 2 aéreo, 3 marítimo, 4 fluvial, 5 ferroviário */
    int("meioTransporte", 26, 1),
    /** 1 carga fechada, 2 carga fracionada */
    int("tipoTransporte", 27, 1),
    /** 1 fria, 2 seca, 3 mista */
    int("tipoCarga", 28, 1),
    /** C = CIF, F = FOB */
    text("condicaoFrete", 29, 1, M),
    text("serie", 30, 3),
    digits("numero", 33, 8, M),
    date("dataEmissao", 41, M),
    text("natureza", 49, 15, M),
    text("especie", 64, 15, M),
    decimal("volumes", 79, 5, 2, M),
    decimal("valorTotal", 86, 13, 2, M),
    decimal("peso", 101, 5, 2, M),
    decimal("pesoCubado", 108, 3, 2),
    /** D, R, P, T, S ou N */
    text("tipoIcms", 113, 1, M),
    /** S / N */
    text("seguroEfetuado", 114, 1, M),
    decimal("valorSeguro", 115, 13, 2),
    decimal("valorCobrado", 130, 13, 2),
    text("placa", 145, 7),
    text("planoCargaRapida", 152, 1),
    decimal("fretePesoVolume", 153, 13, 2),
    decimal("adValorem", 168, 13, 2),
    decimal("totalTaxas", 183, 13, 2),
    decimal("totalFrete", 198, 13, 2),
    /** I = inclusão, E = exclusão/cancelamento */
    text("acao", 213, 1),
    decimal("valorIcms", 214, 10, 2),
    decimal("valorIcmsRetido", 226, 10, 2),
    text("bonificacao", 238, 1),
    filler(239, 2),
  ],
});

/** 333 – DCN: dados complementares da nota fiscal. Até 1 por 313. */
export const R333 = defineRecord({
  id: "333",
  name: "Dados complementares da nota fiscal",
  length: LENGTH,
  fields: [
    digits("cfop", 4, 4, M),
    /** 0 sem data, 1 na data, 2 até a data, 3 a partir da data, 4 no período */
    int("tipoPeriodoEntrega", 8, 1, M),
    date("dataInicialEntrega", 9),
    time("horaInicialEntrega", 17),
    date("dataFinalEntrega", 21),
    time("horaFinalEntrega", 29),
    text("localDesembarque", 33, 15),
    text("freteDiferenciado", 48, 1, M),
    text("tabelaFrete", 49, 10),
    digits("entrega1Cnpj", 59, 15),
    text("entrega1Serie", 74, 3),
    digits("entrega1Numero", 77, 8),
    digits("entrega2Cnpj", 85, 15),
    text("entrega2Serie", 100, 3),
    digits("entrega2Numero", 103, 8),
    digits("entrega3Cnpj", 111, 15),
    text("entrega3Serie", 126, 3),
    digits("entrega3Numero", 129, 8),
    digits("entrega4Cnpj", 137, 15),
    text("entrega4Serie", 152, 3),
    digits("entrega4Numero", 155, 8),
    digits("entrega5Cnpj", 163, 15),
    text("entrega5Serie", 178, 3),
    digits("entrega5Numero", 181, 8),
    decimal("despesasAdicionais", 189, 13, 2),
    text("tipoVeiculo", 204, 5),
    text("filialConhecimento", 209, 10),
    text("serieConhecimento", 219, 5),
    text("numeroConhecimento", 224, 12),
    filler(236, 5),
  ],
});

/** 314 – MNF: mercadorias da nota fiscal, até 4 por linha. */
export const R314 = defineRecord({
  id: "314",
  name: "Mercadoria da nota fiscal",
  length: LENGTH,
  fields: [
    decimal("volumes1", 4, 5, 2, M),
    text("especie1", 11, 15, M),
    text("mercadoria1", 26, 30, M),
    decimal("volumes2", 56, 5, 2),
    text("especie2", 63, 15),
    text("mercadoria2", 78, 30),
    decimal("volumes3", 108, 5, 2),
    text("especie3", 115, 15),
    text("mercadoria3", 130, 30),
    decimal("volumes4", 160, 5, 2),
    // O manual marca este campo como "N 15", mas o conteúdo (fardos, caixas...) é texto.
    text("especie4", 167, 15),
    text("mercadoria4", 182, 30),
    filler(212, 29),
  ],
});

const partyFields = (opts: { requireAddress: boolean }) => {
  const R = { required: opts.requireAddress } as const;
  return [
    text("razaoSocial", 4, 40, M),
    digits("cnpj", 44, 14, M),
    text("inscricaoEstadual", 58, 15),
    text("endereco", 73, 40, R),
    text("bairro", 113, 20),
    text("cidade", 133, 35, R),
    text("cep", 168, 9, M),
    text("codigoMunicipio", 177, 9),
    text("uf", 186, 9, R),
  ] as const;
};

/** 315 – CON: consignatário da mercadoria. */
export const R315 = defineRecord({
  id: "315",
  name: "Dados do consignatário",
  length: LENGTH,
  fields: [...partyFields({ requireAddress: true }), text("comunicacao", 195, 35), filler(230, 11)],
});

/** 316 – RED: dados para redespacho. */
export const R316 = defineRecord({
  id: "316",
  name: "Dados para redespacho",
  length: LENGTH,
  fields: [
    ...partyFields({ requireAddress: true }),
    text("areaFrete", 195, 4),
    text("comunicacao", 199, 35),
    filler(234, 7),
  ],
});

/** 317 – RPF: responsável pelo frete. */
export const R317 = defineRecord({
  id: "317",
  name: "Responsável pelo frete",
  length: LENGTH,
  fields: [...partyFields({ requireAddress: true }), text("comunicacao", 195, 35), filler(230, 11)],
});

/** 318 – TOT: valores totais do documento. Um por 310. */
export const R318 = defineRecord({
  id: "318",
  name: "Valores totais do documento",
  length: LENGTH,
  fields: [
    decimal("valorTotal", 4, 13, 2, M),
    decimal("pesoTotal", 19, 13, 2, M),
    decimal("pesoCubadoTotal", 34, 13, 2),
    decimal("volumesTotal", 49, 13, 2, M),
    decimal("valorCobradoTotal", 64, 13, 2),
    decimal("valorSeguroTotal", 79, 13, 2),
    filler(94, 147),
  ],
});

export const NOTFIS_31 = {
  version: "3.1",
  recordLength: LENGTH,
  records: { R000, R310, R311, R312, R313, R333, R314, R315, R316, R317, R318 },
} as const;
