/**
 * Exemplo: gerar um NOTFIS 3.1 a partir do XML de uma NF-e.
 * Rode com: npx tsx examples/nfe-para-notfis.ts examples/notafiscal.xml > examples/notfis-gerado.txt
 *
 * Leitura de XML propositalmente simples (sem dependências): suficiente para NF-e,
 * que não tem atributos relevantes nem tags repetidas fora de <det> e <vol>.
 */
import { readFileSync } from "node:fs";
import { generateNotfis } from "../src/index.js";

const file = process.argv[2] ?? "examples/notafiscal.xml";
const xml = readFileSync(file, "utf8");

/** Conteúdo da primeira ocorrência de `<tag>` dentro de `src`. */
const tag = (src: string, name: string): string =>
  src.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? "";
/** Conteúdo de todas as ocorrências de `<tag>`. */
const tags = (src: string, name: string): string[] =>
  [...src.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "g"))].map((m) => m[1]);
const cut = (s: string, n: number) => s.slice(0, n);

const ide = tag(xml, "ide");
const emit = tag(xml, "emit");
const enderEmit = tag(emit, "enderEmit");
const dest = tag(xml, "dest");
const enderDest = tag(dest, "enderDest");
const transp = tag(xml, "transp");
const icmsTot = tag(xml, "ICMSTot");
const vols = tags(transp, "vol");
const prods = tags(xml, "det").map((d) => tag(d, "prod"));

const destDoc = tag(dest, "CNPJ") || tag(dest, "CPF");
const sum = (key: string) => vols.reduce((acc, v) => acc + Number(tag(v, key) || 0), 0);

const txt = generateNotfis({
  cabecalho: {
    remetente: cut(tag(emit, "xNome"), 35),
    destinatario: cut(tag(tag(transp, "transporta"), "xNome") || "TRANSPORTADORA", 35),
  },
  documentos: [
    {
      embarcadoras: [
        {
          cnpj: tag(emit, "CNPJ"),
          razaoSocial: cut(tag(emit, "xNome"), 40),
          inscricaoEstadual: tag(emit, "IE"),
          endereco: cut(`${tag(enderEmit, "xLgr")}, ${tag(enderEmit, "nro")}`, 40),
          cidade: cut(tag(enderEmit, "xMun"), 35),
          cep: tag(enderEmit, "CEP"),
          uf: tag(enderEmit, "UF"),
          dataEmbarque: (tag(ide, "dhSaiEnt") || tag(ide, "dhEmi")).slice(0, 10),
          destinatarios: [
            {
              cnpjCpf: destDoc,
              tipoIdentificacao: destDoc.length === 14 ? "1" : "2",
              razaoSocial: cut(tag(dest, "xNome"), 40),
              inscricaoEstadual: tag(dest, "IE"),
              endereco: cut(`${tag(enderDest, "xLgr")}, ${tag(enderDest, "nro")}`, 40),
              bairro: cut(tag(enderDest, "xBairro"), 20),
              cidade: cut(tag(enderDest, "xMun"), 35),
              codigoMunicipio: tag(enderDest, "cMun"),
              cep: tag(enderDest, "CEP"),
              uf: tag(enderDest, "UF"),
              notas: [
                {
                  serie: tag(ide, "serie"),
                  numero: tag(ide, "nNF"),
                  dataEmissao: tag(ide, "dhEmi").slice(0, 10),
                  natureza: cut(tag(ide, "natOp"), 15),
                  // modFrete: 0 = por conta do remetente (CIF), 1 = do destinatário (FOB)
                  condicaoFrete: tag(transp, "modFrete") === "1" ? "F" : "C",
                  especie: cut(tag(vols[0] ?? "", "esp") || "VOLUMES", 15),
                  volumes: sum("qVol") || 1,
                  peso: sum("pesoB"),
                  valorTotal: Number(tag(icmsTot, "vNF")),
                  valorIcms: Number(tag(icmsTot, "vICMS")),
                  valorIcmsRetido: Number(tag(icmsTot, "vST")),
                  tipoIcms: "N",
                  seguroEfetuado: "N",
                  acao: "I",
                  complemento: {
                    cfop: tag(prods[0] ?? "", "CFOP"),
                    tipoPeriodoEntrega: 0,
                    freteDiferenciado: "N",
                  },
                  mercadorias: prods.map((p) => ({
                    volumes: Number(tag(p, "qCom")),
                    especie: cut(tag(p, "uCom"), 15),
                    mercadoria: cut(tag(p, "xProd"), 30),
                  })),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

process.stdout.write(txt);
