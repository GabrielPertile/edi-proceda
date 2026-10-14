/**
 * Leitura dos dados de uma NF-e (modelo 55, leiaute 4.00) relevantes para o transporte.
 *
 * O XML da NF-e tem estrutura fixa, sem atributos relevantes e com poucas tags
 * repetidas (`det`, `vol`), então um leitor por expressões regulares basta e mantém
 * a biblioteca sem dependências em runtime.
 */

export interface NfeEndereco {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
}

export interface NfeParticipante {
  /** CNPJ ou CPF, só dígitos (ou alfanumérico, no novo CNPJ). */
  cnpjCpf: string;
  nome: string;
  inscricaoEstadual: string;
  endereco: NfeEndereco;
}

export interface NfeVolume {
  quantidade: number;
  especie: string;
  pesoLiquido: number;
  pesoBruto: number;
}

export interface NfeItem {
  codigo: string;
  descricao: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor: number;
}

export interface Nfe {
  /** Chave de acesso de 44 dígitos. */
  chave: string;
  serie: string;
  numero: string;
  /** ISO `YYYY-MM-DD`, na data local do emitente. */
  dataEmissao: string;
  /** ISO `YYYY-MM-DD` de saída/entrada, quando informada. */
  dataSaida: string | null;
  naturezaOperacao: string;
  /**
   * `modFrete`: 0 por conta do remetente (CIF), 1 do destinatário (FOB), 2 de terceiros,
   * 3 próprio do remetente, 4 próprio do destinatário, 9 sem frete.
   */
  modalidadeFrete: string;
  emitente: NfeParticipante;
  destinatario: NfeParticipante;
  /** Local de entrega diferente do endereço do destinatário (`<entrega>`), se houver. */
  entrega: NfeEndereco | null;
  transportadora: { cnpjCpf: string; nome: string } | null;
  volumes: NfeVolume[];
  itens: NfeItem[];
  totais: { valorNota: number; valorProdutos: number; icms: number; icmsSt: number };
}

/**
 * Lê o XML de uma NF-e, com ou sem o envelope `<nfeProc>`.
 * Lança `Error` se o conteúdo não tiver o grupo `<infNFe>`.
 */
export function parseNfe(xml: string): Nfe {
  const inf = group(xml, "infNFe");
  if (!inf) throw new Error("O XML informado não é uma NF-e: grupo <infNFe> não encontrado.");

  const ide = group(inf, "ide");
  const emit = group(inf, "emit");
  const dest = group(inf, "dest");
  const entrega = group(inf, "entrega");
  const transp = group(inf, "transp");
  const transporta = group(transp, "transporta");
  const icmsTot = group(inf, "ICMSTot");

  const id = /<(?:\w+:)?infNFe\b[^>]*\bId="NFe(\d{44})"/.exec(xml)?.[1];

  return {
    chave: id ?? tag(xml, "chNFe"),
    serie: tag(ide, "serie"),
    numero: tag(ide, "nNF"),
    dataEmissao: (tag(ide, "dhEmi") || tag(ide, "dEmi")).slice(0, 10),
    dataSaida: (tag(ide, "dhSaiEnt") || tag(ide, "dSaiEnt")).slice(0, 10) || null,
    naturezaOperacao: tag(ide, "natOp"),
    modalidadeFrete: tag(transp, "modFrete"),
    emitente: participante(emit, "enderEmit"),
    destinatario: participante(dest, "enderDest"),
    entrega: entrega ? endereco(entrega) : null,
    transportadora: transporta
      ? { cnpjCpf: documento(transporta), nome: tag(transporta, "xNome") }
      : null,
    volumes: tags(transp, "vol").map((v) => ({
      quantidade: num(tag(v, "qVol")),
      especie: tag(v, "esp"),
      pesoLiquido: num(tag(v, "pesoL")),
      pesoBruto: num(tag(v, "pesoB")),
    })),
    itens: tags(inf, "det").map((det) => {
      const prod = group(det, "prod");
      return {
        codigo: tag(prod, "cProd"),
        descricao: tag(prod, "xProd"),
        cfop: tag(prod, "CFOP"),
        unidade: tag(prod, "uCom"),
        quantidade: num(tag(prod, "qCom")),
        valor: num(tag(prod, "vProd")),
      };
    }),
    totais: {
      valorNota: num(tag(icmsTot, "vNF")),
      valorProdutos: num(tag(icmsTot, "vProd")),
      icms: num(tag(icmsTot, "vICMS")),
      icmsSt: num(tag(icmsTot, "vST")),
    },
  };
}

function participante(src: string, enderecoTag: string): NfeParticipante {
  return {
    cnpjCpf: documento(src),
    nome: tag(src, "xNome"),
    inscricaoEstadual: tag(src, "IE"),
    endereco: endereco(group(src, enderecoTag)),
  };
}

function endereco(src: string): NfeEndereco {
  return {
    logradouro: tag(src, "xLgr"),
    numero: tag(src, "nro"),
    complemento: tag(src, "xCpl"),
    bairro: tag(src, "xBairro"),
    codigoMunicipio: tag(src, "cMun"),
    municipio: tag(src, "xMun"),
    uf: tag(src, "UF"),
    cep: tag(src, "CEP"),
  };
}

const documento = (src: string) => tag(src, "CNPJ") || tag(src, "CPF");
const num = (s: string) => (s === "" ? 0 : Number(s));

const pattern = (name: string, flags = "") =>
  new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`, flags);

/** XML interno (bruto) da primeira ocorrência de `<name>`, ou `""`. */
function group(src: string, name: string): string {
  return pattern(name).exec(src)?.[1] ?? "";
}

/** Valor de texto (com entidades decodificadas) da primeira ocorrência de `<name>`, ou `""`. */
const tag = (src: string, name: string) => decode(group(src, name));

/** Conteúdo bruto de todas as ocorrências de `<name>`. */
function tags(src: string, name: string): string[] {
  return [...src.matchAll(pattern(name, "g"))].map((m) => m[1] ?? "");
}

function decode(s: string): string {
  return s
    .trim()
    .replace(/&(lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (_, e: string) => {
      const named: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'" };
      if (named[e]) return named[e];
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return String.fromCodePoint(code);
    })
    .replace(/&amp;/g, "&");
}
