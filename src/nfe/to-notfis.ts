import { type GenerateNotfisOptions, generateNotfis } from "../notfis/generate.js";
import type {
  NotfisInput,
  NotfisInvoiceInput,
  NotfisRecipientInput,
  NotfisShipperInput,
} from "../notfis/types.js";
import { type Nfe, type NfeEndereco, parseNfe } from "./parse.js";

export interface NfeToNotfisOptions {
  /** Registro 000, remetente do intercâmbio. @default razão social do emitente da primeira nota */
  remetente?: string;
  /**
   * Registro 000, destinatário do intercâmbio (a transportadora).
   * @default nome da transportadora (`<transporta>`) da primeira nota que tiver uma
   */
  destinatario?: string;
  /**
   * Data de embarque (311), ISO `YYYY-MM-DD`, para todas as embarcadoras.
   * @default data de saída da primeira nota de cada emitente, ou a de emissão
   */
  dataEmbarque?: string;
  /** Gera os registros 314 com os itens da nota. @default true */
  mercadorias?: boolean;
  /**
   * Ajustes por nota, aplicados por cima dos valores tirados do XML. Use para os campos
   * que a NF-e não tem e que a transportadora exige (`tipoIcms`, `seguroEfetuado`,
   * `tipoTransporte`, `romaneio`...).
   */
  nota?: (nfe: Nfe) => Partial<NotfisInvoiceInput>;
}

type NfeSource = string | Nfe;

/**
 * Converte uma ou mais NF-e (XML ou já lidas com `parseNfe`) na estrutura de entrada do
 * NOTFIS, agrupando as notas por emitente (311) e por destinatário/local de entrega (312).
 * Útil para revisar ou completar os dados antes de chamar `generateNotfis`.
 */
export function nfeToNotfisInput(
  nfes: NfeSource | readonly NfeSource[],
  options: NfeToNotfisOptions = {},
): NotfisInput {
  const list = (Array.isArray(nfes) ? nfes : [nfes]) as NfeSource[];
  if (list.length === 0) throw new Error("Informe ao menos uma NF-e.");

  const notas = list.map((n, i) => {
    if (typeof n !== "string") return n;
    try {
      return parseNfe(n);
    } catch (e) {
      throw new Error(`NF-e #${i + 1}: ${(e as Error).message}`);
    }
  });

  const destinatario =
    options.destinatario ?? notas.find((n) => n.transportadora?.nome)?.transportadora?.nome;
  if (!destinatario) {
    throw new Error(
      "Nenhuma NF-e informa a transportadora (<transporta>). Passe a opção `destinatario`.",
    );
  }

  const embarcadoras = new Map<string, NotfisShipperInput>();
  const destinatarios = new Map<string, NotfisRecipientInput>();

  for (const nfe of notas) {
    const { emitente: emit, destinatario: dest } = nfe;

    let shipper = embarcadoras.get(emit.cnpjCpf);
    if (!shipper) {
      shipper = {
        cnpj: emit.cnpjCpf,
        razaoSocial: emit.nome,
        inscricaoEstadual: emit.inscricaoEstadual,
        endereco: logradouro(emit.endereco),
        cidade: emit.endereco.municipio,
        cep: emit.endereco.cep,
        uf: emit.endereco.uf,
        dataEmbarque: options.dataEmbarque ?? nfe.dataSaida ?? nfe.dataEmissao,
        destinatarios: [],
      };
      embarcadoras.set(emit.cnpjCpf, shipper);
    }

    // O 312 descreve onde a mercadoria será entregue: usa o grupo <entrega> quando existe.
    const local = nfe.entrega ?? dest.endereco;
    const key = [emit.cnpjCpf, dest.cnpjCpf, local.cep, logradouro(local)].join("|");
    let recipient = destinatarios.get(key);
    if (!recipient) {
      recipient = {
        razaoSocial: dest.nome,
        cnpjCpf: dest.cnpjCpf,
        tipoIdentificacao: dest.cnpjCpf.length === 11 ? "2" : "1",
        inscricaoEstadual: dest.inscricaoEstadual,
        endereco: logradouro(local),
        bairro: local.bairro,
        cidade: local.municipio,
        codigoMunicipio: local.codigoMunicipio,
        cep: local.cep,
        uf: local.uf,
        notas: [],
      };
      destinatarios.set(key, recipient);
      shipper.destinatarios.push(recipient);
    }

    recipient.notas.push({ ...toInvoice(nfe, options), ...options.nota?.(nfe) });
  }

  return {
    cabecalho: {
      remetente: options.remetente ?? notas[0]?.emitente.nome,
      destinatario,
    },
    documentos: [{ embarcadoras: [...embarcadoras.values()] }],
  };
}

/**
 * Gera um arquivo NOTFIS 3.1 a partir de uma ou mais NF-e.
 *
 * ```ts
 * const txt = notfisFromNfe(xmls, { nota: () => ({ tipoIcms: "S" }) });
 * ```
 */
export function notfisFromNfe(
  nfes: NfeSource | readonly NfeSource[],
  options: NfeToNotfisOptions & GenerateNotfisOptions = {},
): string {
  return generateNotfis(nfeToNotfisInput(nfes, options), options);
}

function toInvoice(nfe: Nfe, options: NfeToNotfisOptions): NotfisInvoiceInput {
  const sum = (pick: (v: Nfe["volumes"][number]) => number) =>
    nfe.volumes.reduce((acc, v) => acc + pick(v), 0);

  return {
    serie: nfe.serie,
    numero: nfe.numero,
    dataEmissao: nfe.dataEmissao,
    natureza: nfe.naturezaOperacao,
    // 1 = destinatário e 4 = próprio do destinatário pagam o frete (FOB); o resto é CIF.
    condicaoFrete: nfe.modalidadeFrete === "1" || nfe.modalidadeFrete === "4" ? "F" : "C",
    especie: nfe.volumes.find((v) => v.especie)?.especie || "VOLUMES",
    volumes: sum((v) => v.quantidade),
    peso: sum((v) => v.pesoBruto || v.pesoLiquido),
    valorTotal: nfe.totais.valorNota,
    valorIcms: nfe.totais.icms,
    valorIcmsRetido: nfe.totais.icmsSt,
    tipoIcms: "N",
    seguroEfetuado: "N",
    acao: "I",
    complemento: {
      cfop: nfe.itens[0]?.cfop,
      tipoPeriodoEntrega: 0,
      freteDiferenciado: "N",
    },
    mercadorias:
      options.mercadorias === false
        ? []
        : nfe.itens.map((item) => ({
            volumes: item.quantidade,
            especie: item.unidade,
            mercadoria: item.descricao,
          })),
  };
}

function logradouro(e: NfeEndereco): string {
  return [e.logradouro, e.numero].filter(Boolean).join(", ");
}
