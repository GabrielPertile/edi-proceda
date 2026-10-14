import type { NotfisInput } from "../src/index.js";

/**
 * Dados 100% fictícios. Os CNPJs/CPF são exemplos clássicos de documentos válidos
 * usados em material didático, não pertencem a empresas reais.
 */
export const EMBARCADORA_CNPJ = "11222333000181";
export const DESTINATARIO_CNPJ = "98765432000198";
export const DESTINATARIO_CPF = "52998224725";

export const sample: NotfisInput = {
  cabecalho: {
    remetente: "EMBARCADORA EXEMPLO",
    destinatario: "TRANSPORTADORA EXEMPLO",
    data: "2026-10-14",
    hora: "13:57",
    intercambio: "NOT141013570",
  },
  documentos: [
    {
      documento: "NOTFI141013570",
      embarcadoras: [
        {
          cnpj: EMBARCADORA_CNPJ,
          inscricaoEstadual: "1234567890",
          endereco: "Rua das Araucárias, 100",
          cidade: "Curitiba",
          cep: "80000-000",
          uf: "PR",
          dataEmbarque: "2026-10-15",
          razaoSocial: "Indústria Exemplo Ltda",
          destinatarios: [
            {
              razaoSocial: "Comércio Fictício S.A.",
              cnpjCpf: DESTINATARIO_CPF,
              tipoIdentificacao: "2",
              endereco: "Av. Central, 500",
              bairro: "Centro",
              cidade: "São Paulo",
              cep: "01000-000",
              uf: "SP",
              notas: [
                {
                  romaneio: "ROM-001",
                  meioTransporte: 1,
                  tipoTransporte: 2,
                  tipoCarga: 2,
                  condicaoFrete: "C",
                  serie: "1",
                  numero: "1234",
                  dataEmissao: "2026-10-14",
                  natureza: "Peças",
                  especie: "Caixas",
                  volumes: 10,
                  valorTotal: 15432.1,
                  peso: 250.5,
                  pesoCubado: 1.25,
                  tipoIcms: "S",
                  seguroEfetuado: "N",
                  acao: "I",
                  valorIcms: 1851.85,
                  bonificacao: "N",
                  complemento: {
                    cfop: "5102",
                    tipoPeriodoEntrega: 4,
                    dataInicialEntrega: "2026-10-16",
                    horaInicialEntrega: "08:00",
                    dataFinalEntrega: "2026-10-17",
                    horaFinalEntrega: "18:00",
                    localDesembarque: "DOCA 3",
                    freteDiferenciado: "N",
                    tipoVeiculo: "BR06",
                    entregasCasadas: [{ cnpj: "011222333000181", serie: "2", numero: "777" }],
                  },
                  mercadorias: [
                    { volumes: 6, especie: "Caixas", mercadoria: "Rolamento 6205" },
                    { volumes: 2, especie: "Caixas", mercadoria: "Retentor" },
                    { volumes: 1, especie: "Fardo", mercadoria: "Correia" },
                    { volumes: 1, especie: "Palete", mercadoria: "Engrenagem" },
                    { volumes: 0.5, especie: "Avulso", mercadoria: "Parafusos" },
                  ],
                },
              ],
            },
            {
              razaoSocial: "Distribuidora Modelo",
              cnpjCpf: DESTINATARIO_CNPJ,
              tipoIdentificacao: "1",
              cidade: "Joinville",
              cep: "89200-000",
              uf: "SC",
              notas: [
                {
                  condicaoFrete: "F",
                  serie: "1",
                  numero: "1235",
                  dataEmissao: "2026-10-14",
                  natureza: "Peças",
                  especie: "Caixas",
                  volumes: 3,
                  valorTotal: 899.9,
                  peso: 42,
                  tipoIcms: "S",
                  seguroEfetuado: "S",
                  valorSeguro: 12.5,
                  responsavelFrete: {
                    razaoSocial: "Distribuidora Modelo",
                    cnpj: EMBARCADORA_CNPJ,
                    endereco: "Rua B, 20",
                    cidade: "Joinville",
                    cep: "89200-000",
                    uf: "SC",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
