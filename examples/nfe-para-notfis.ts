/**
 * Exemplo: gerar um NOTFIS 3.1 a partir de um ou mais XMLs de NF-e.
 * Rode com: npx tsx examples/nfe-para-notfis.ts nota1.xml nota2.xml > NOTFIS.TXT
 *
 * A CLI faz o mesmo: npx edi-proceda nfe2notfis nota1.xml nota2.xml -o NOTFIS.TXT
 */
import { readFileSync } from "node:fs";
import { notfisFromNfe } from "../src/index.js";

const xmls = process.argv.slice(2).map((file) => readFileSync(file, "utf8"));

const txt = notfisFromNfe(xmls, {
  // Ajuste aqui os campos que a NF-e não tem e a transportadora exige.
  nota: () => ({ tipoIcms: "N", seguroEfetuado: "N" }),
});

process.stdout.write(Buffer.from(txt, "latin1"));
