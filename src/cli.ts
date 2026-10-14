import { readFileSync, writeFileSync } from "node:fs";
import type { Issue } from "./core/issues.js";
import { notfisFromNfe } from "./nfe/to-notfis.js";
import { parseNotfis } from "./notfis/parse.js";

const HELP = `Uso:
  edi-proceda notfis <arquivo> [opções]
  edi-proceda nfe2notfis <nota.xml...> [opções]

notfis       Lê um arquivo NOTFIS 3.1, imprime o JSON em stdout e os problemas em stderr.
             Sai com código 1 se houver erros.
  --issues          mostra apenas os problemas encontrados
  --encoding <e>    encoding do arquivo (padrão: latin1)

nfe2notfis   Gera um NOTFIS 3.1 a partir de um ou mais XMLs de NF-e, agrupando as notas
             por emitente e destinatário, e valida o resultado.
  -o, --output <arquivo>     grava no arquivo em vez de stdout
  --destinatario <nome>      transportadora no registro 000 (padrão: <transporta> do XML)
  --remetente <nome>         remetente no registro 000 (padrão: emitente da primeira nota)
  --data-embarque <AAAA-MM-DD>  data de embarque (padrão: data de saída da nota)
  --sem-mercadorias          não gera os registros 314 com os itens da nota

  -h, --help        mostra esta ajuda`;

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") {
    console.log(HELP);
    return 0;
  }
  if (command === "notfis" && rest[0]) return notfis(rest[0], rest.slice(1));
  if (command === "nfe2notfis") return nfe2notfis(rest);
  console.error(HELP);
  return 2;
}

function notfis(file: string, rest: string[]): number {
  const encIndex = rest.indexOf("--encoding");
  const encoding = (encIndex >= 0 ? rest[encIndex + 1] : "latin1") as BufferEncoding;
  const onlyIssues = rest.includes("--issues");

  const result = parseNotfis(readFileSync(file, { encoding }));

  printIssues(result.issues);
  if (!onlyIssues) console.log(JSON.stringify(result.data, null, 2));
  if (onlyIssues && result.issues.length === 0) console.error("Nenhum problema encontrado.");

  return result.ok ? 0 : 1;
}

function nfe2notfis(args: string[]): number {
  const files: string[] = [];
  const opts: Record<string, string> = {};
  const withValue = new Set(["-o", "--output", "--destinatario", "--remetente", "--data-embarque"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (withValue.has(arg)) {
      const value = args[++i];
      if (value === undefined) {
        console.error(`Faltou o valor de ${arg}.`);
        return 2;
      }
      opts[arg === "-o" ? "--output" : arg] = value;
    } else if (arg === "--sem-mercadorias") {
      opts[arg] = "1";
    } else if (arg.startsWith("-")) {
      console.error(`Opção desconhecida: ${arg}\n\n${HELP}`);
      return 2;
    } else {
      files.push(arg);
    }
  }
  if (files.length === 0) {
    console.error(HELP);
    return 2;
  }

  let txt: string;
  try {
    const xmls = files.map((f) => readFileSync(f, "utf8"));
    txt = notfisFromNfe(xmls, {
      destinatario: opts["--destinatario"],
      remetente: opts["--remetente"],
      dataEmbarque: opts["--data-embarque"],
      mercadorias: !opts["--sem-mercadorias"],
    });
  } catch (e) {
    // As mensagens citam "NF-e #n": troca pelo nome do arquivo.
    const msg = (e as Error).message.replace(/^NF-e #(\d+)/, (_, n) => files[Number(n) - 1] ?? _);
    console.error(`ERRO  ${msg}`);
    return 1;
  }

  const result = parseNotfis(txt);
  printIssues(result.issues);

  const output = opts["--output"];
  if (output) {
    writeFileSync(output, txt, "latin1");
    console.error(`${files.length} nota(s) → ${output}`);
  } else {
    process.stdout.write(Buffer.from(txt, "latin1"));
  }
  return result.ok ? 0 : 1;
}

function printIssues(issues: Issue[]): void {
  for (const i of issues) {
    const where = [i.line && `linha ${i.line}`, i.record && `reg. ${i.record}`, i.field]
      .filter(Boolean)
      .join(", ");
    console.error(
      `${i.severity === "error" ? "ERRO " : "AVISO"} [${i.code}] ${where}: ${i.message}`,
    );
  }
}

process.exitCode = main(process.argv.slice(2));
