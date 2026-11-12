import type { Derived } from '../data/types'
import type { KpiKey } from './kpis'
import { money, num } from './format'

const n2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Frase em linguagem simples para o valor atual de um indicador. */
export function plain(k: KpiKey, d: Derived): string | null {
  const v = d[k as keyof Derived] as number | null
  if (v === null || v === undefined || !isFinite(v)) {
    if (k === 'roas' || k === 'cpc') return 'Sem investimento em anúncios no recorte, então não se aplica.'
    return 'Sem dados suficientes para calcular no recorte atual.'
  }
  switch (k) {
    case 'investment': return `Soma de anúncios (${money(d.mediaSpend, { compact: true })}) e de produção, ferramentas e agência (${money(d.otherCost, { compact: true })}).`
    case 'revenue': return 'Vendas atribuídas ao último clique antes da compra. Ainda não descontou custos: não é lucro.'
    case 'cac': return `Em média, foram gastos ${money(v)} para conquistar cada cliente novo.`
    case 'roas': return `Cada R$ 1 em anúncios trouxe R$ ${n2(v)} em receita.`
    case 'roi': return v >= 0 ? `Depois de pagar produtos e marketing, sobraram R$ ${n2(v / 100)} para cada R$ 1 investido.` : `Depois de pagar produtos e marketing, cada R$ 1 investido deu prejuízo de R$ ${n2(-v / 100)}.`
    case 'leads': return `${num(v)} pessoas deixaram contato e demonstraram interesse.`
    case 'customers': return `${num(v)} pessoas viraram clientes no período.`
    case 'cpl': return `Cada contato interessado custou ${money(v)}.`
    case 'ctr': return `De cada 100 pessoas que viram um anúncio, ${n2(v)} clicaram.`
    case 'cpc': return `Cada clique em anúncio custou ${money(v)}.`
    case 'convRate': return `De cada 100 cliques, ${n2(v)} terminaram em um cliente novo.`
    case 'aov': return `Cada pedido vale, em média, ${money(v)}.`
    case 'profit': return v >= 0 ? `Sobrou ${money(v, { compact: true })} depois de descontar custo dos produtos e todo o marketing.` : `Faltaram ${money(-v, { compact: true })} para cobrir o custo dos produtos e o marketing.`
    case 'revPerCustomer': return `Cada cliente novo gerou, em média, ${money(v)} em receita.`
    case 'otherCost': return 'Custos que não são anúncio: produção de conteúdo, ferramentas, comissões e agência.'
    default: return null
  }
}

export interface GlossaryEntry {
  key: KpiKey
  name: string
  full: string
  what: string
  formula: string
  read: string
  good: string
  pitfall: string
  where: string
}

export const GLOSSARY: GlossaryEntry[] = [
  { key: 'investment', name: 'Investimento total', full: 'Total Invested', what: 'Tudo o que a empresa gastou com marketing no período.', formula: 'Mídia (anúncios) + custos não-mídia (produção, ferramentas, comissões, agência)', read: 'É a base de CAC, CPL e ROI. Compare sempre com o que ele trouxe de volta.', good: 'Não existe valor bom sozinho: avalie junto com receita e lucro.', pitfall: 'Olhar só o gasto com anúncios esconde custos que pesam no resultado real.', where: '/financial' },
  { key: 'revenue', name: 'Receita atribuída', full: 'Revenue Generated', what: 'Valor das vendas que o modelo de atribuição credita às campanhas.', formula: 'Soma dos pedidos atribuídos (modelo last-click: último clique antes da compra)', read: 'Mostra o tamanho do resultado comercial ligado ao marketing.', good: 'Crescendo mais rápido que o investimento.', pitfall: 'Receita não é lucro. Uma campanha pode vender muito e ainda dar prejuízo.', where: '/financial' },
  { key: 'cac', name: 'CAC', full: 'Customer Acquisition Cost — custo de aquisição de cliente', what: 'Quanto custa, em média, conquistar um cliente novo.', formula: 'Investimento total ÷ novos clientes', read: 'Quanto menor, melhor — desde que a qualidade dos clientes se mantenha.', good: 'Bem abaixo do lucro que cada cliente gera. Para vendas B2B de ticket alto, CAC maior é aceitável.', pitfall: 'Comparar o CAC de um canal B2B com o de um e-commerce. Compare dentro do mesmo objetivo.', where: '/campaigns' },
  { key: 'roas', name: 'ROAS', full: 'Return on Ad Spend — retorno sobre o gasto com anúncios', what: 'Quanto de receita volta para cada R$ 1 investido em anúncios.', formula: 'Receita atribuída ÷ investimento em anúncios', read: 'ROAS de 3x significa R$ 3 de receita para cada R$ 1 em anúncio.', good: 'Acima da meta definida em Configurações e acima do ponto de equilíbrio da margem.', pitfall: 'ROAS acima de 1 pode dar prejuízo: ele ignora o custo do produto e os custos não-mídia.', where: '/financial' },
  { key: 'roi', name: 'ROI', full: 'Return on Investment — retorno sobre o investimento', what: 'Quanto sobrou de dinheiro, em proporção ao que foi investido, depois de pagar produtos e marketing.', formula: '((Receita × margem − Investimento total) ÷ Investimento total) × 100', read: 'ROI de 80% significa R$ 0,80 de lucro para cada R$ 1 investido. ROI negativo significa prejuízo.', good: 'Positivo e estável. É o indicador mais próximo do resultado financeiro real.', pitfall: 'Confundir com ROAS. O ROI considera margem e todos os custos; o ROAS não.', where: '/financial' },
  { key: 'leads', name: 'Leads', full: 'Total Leads', what: 'Pessoas que deixaram contato: preencheram formulário, se cadastraram ou pediram demonstração.', formula: 'Contagem de cadastros no período', read: 'Mostra o volume de interessados no topo do funil.', good: 'Crescendo sem que o custo por lead dispare.', pitfall: 'Volume alto de leads de baixa qualidade infla o funil e não vira venda.', where: '/funnel' },
  { key: 'customers', name: 'Conversões', full: 'Total Conversions', what: 'Pessoas que viraram clientes (compra, assinatura ou contrato).', formula: 'Contagem de novos clientes no período', read: 'É o resultado final do funil.', good: 'Crescendo proporcionalmente ao investimento.', pitfall: 'Contar o mesmo cliente duas vezes em canais diferentes. Aqui cada venda tem um único canal (last-click).', where: '/funnel' },
  { key: 'cpl', name: 'CPL', full: 'Cost per Lead — custo por lead', what: 'Quanto custa gerar um contato interessado.', formula: 'Investimento total ÷ leads', read: 'Ajuda a comparar a eficiência dos canais no topo do funil.', good: 'Abaixo do limite definido em Configurações, com taxa de conversão saudável depois.', pitfall: 'CPL baixo com leads que nunca compram é economia falsa.', where: '/channels' },
  { key: 'ctr', name: 'CTR', full: 'Click Through Rate — taxa de cliques', what: 'Percentual de pessoas que clicaram depois de ver um anúncio.', formula: '(Cliques ÷ Impressões) × 100', read: 'Mede o quanto o anúncio chama atenção do público certo.', good: 'Varia por formato: busca costuma ter CTR bem maior que display ou vídeo.', pitfall: 'CTR alto com conversão baixa indica anúncio atrativo e página ou oferta fraca.', where: '/campaigns' },
  { key: 'cpc', name: 'CPC', full: 'Cost per Click — custo por clique', what: 'Quanto cada clique em anúncio custou.', formula: 'Investimento em anúncios ÷ cliques pagos', read: 'Sobe quando a concorrência no leilão aumenta ou o anúncio perde relevância.', good: 'Estável ou caindo, sem perder qualidade do tráfego.', pitfall: 'Comemorar CPC baixo de cliques que não convertem.', where: '/performance' },
  { key: 'convRate', name: 'Taxa de conversão', full: 'Conversion Rate', what: 'Percentual de cliques que viraram clientes.', formula: '(Conversões ÷ Cliques) × 100', read: 'Resume a eficiência de todo o caminho do clique até a compra.', good: 'Estável ou subindo. Quedas bruscas costumam indicar problema na página, oferta ou rastreamento.', pitfall: 'Comparar canais com intenções diferentes (busca de marca converte muito mais que vídeo).', where: '/funnel' },
  { key: 'aov', name: 'Ticket médio', full: 'Average Order Value', what: 'Valor médio de cada pedido.', formula: 'Receita ÷ número de pedidos', read: 'Ticket maior permite pagar um CAC maior.', good: 'Crescendo com promoções de combo, upsell e frete mínimo.', pitfall: 'Média esconde extremos: poucos pedidos grandes distorcem o valor.', where: '/financial' },
  { key: 'profit', name: 'Lucro estimado', full: 'Estimated Profit', what: 'O que sobra depois de descontar o custo dos produtos e todo o marketing.', formula: 'Receita × margem bruta − Investimento total', read: 'É a resposta para "o marketing se pagou?".', good: 'Positivo. Campanhas com lucro negativo são candidatas a ajuste ou corte.', pitfall: 'Esquecer que a margem é uma estimativa configurada em Configurações.', where: '/financial' },
]

export interface PageGuideData {
  title: string
  answers: string[]
  steps: string[]
  inspired?: string
}

export const PAGE_GUIDES: Record<string, PageGuideData> = {
  overview: { title: 'Como usar o Overview', answers: ['O marketing está dando lucro?', 'O que mudou em relação ao período anterior?', 'Para onde está indo o dinheiro?'], steps: ['Comece pelo resumo em frases: ele traduz os números principais.', 'Nos cartões, a seta verde indica melhora e a vermelha, piora — considerando se o indicador deve subir ou cair.', 'Use os filtros do topo para recortar por período, canal ou campanha. Tudo na tela se atualiza junto.'], inspired: 'Inspirado no painel de resumo do Triple Whale e no Reports snapshot do GA4.' },
  campaigns: { title: 'Como usar Campanhas', answers: ['Quais campanhas dão mais retorno?', 'Quais estão desperdiçando verba?', 'Como cada campanha se compara à média?'], steps: ['Os destaques mostram as 3 melhores e as 3 piores pela nota (Campaign Score).', 'Clique no título de uma coluna para ordenar. Valores em vermelho passaram do limite de CAC ou CPL, ou ficaram abaixo da meta de ROAS.', 'Clique em uma campanha para ver a evolução e os alertas dela.'] },
  channels: { title: 'Como usar Canais', answers: ['Qual canal traz clientes mais baratos?', 'Qual canal tem o melhor retorno?', 'Como dois canais se comparam lado a lado?'], steps: ['Os cartões do topo mostram o líder em cada indicador.', 'O ranking de eficiência combina ROI, CAC, CPL, conversão e ROAS numa nota de 0 a 100.', 'Use "Comparar canais" para ver dois ou mais canais lado a lado.'], inspired: 'Inspirado na visão por canal do Northbeam e do HubSpot.' },
  funnel: { title: 'Como usar o Funil', answers: ['Em que etapa perdemos mais pessoas?', 'Qual canal tem o funil mais eficiente?', 'O que fazer para converter mais?'], steps: ['Cada barra é uma etapa; entre elas aparece quantas pessoas avançam.', 'O gargalo é a etapa mais abaixo da referência de mercado.', 'A tabela por canal destaca em vermelho as etapas com problema.'] },
  financial: { title: 'Como usar a Análise financeira', answers: ['Quanto sobrou depois de pagar o marketing?', 'Quais canais dão lucro e quais dão prejuízo?', 'Qual a diferença entre ROAS e ROI?'], steps: ['A cascata mostra o caminho da receita até o lucro estimado.', 'Barras vermelhas no gráfico de lucro indicam prejuízo.', 'A tabela de fórmulas mostra cada conta com os números do período.'] },
  performance: { title: 'Como usar a Evolução', answers: ['Os indicadores estão melhorando ou piorando?', 'Houve algum pico ou queda fora do normal?'], steps: ['Troque entre diário, semanal e mensal no canto superior.', 'A linha tracejada cinza é o período anterior, para comparação.', 'A etiqueta no canto de cada gráfico resume a tendência.'] },
  insights: { title: 'Como usar os Insights', answers: ['O que precisa de atenção agora?', 'Onde estão as oportunidades?', 'Como explicar os números em linguagem simples?'], steps: ['Os insights são gerados por regras a partir dos seus dados, sempre com as evidências.', 'Na aba do analista, faça perguntas em português, como "qual canal tem o menor CAC?".', 'O gerador de relatório monta um resumo executivo pronto para compartilhar.'], inspired: 'Inspirado nos Insights automáticos do GA4 e no assistente Moby do Triple Whale.' },
  simulator: { title: 'Como usar o Simulador', answers: ['O que acontece se eu mudar o orçamento de um canal?', 'Qual distribuição traz mais clientes pelo mesmo valor?'], steps: ['Mova os controles de cada canal; os resultados à direita são projeções.', 'A elasticidade define quanto o resultado cresce quando a verba cresce (abaixo de 1 = retornos decrescentes).', 'Salve cenários para comparar. Nada é alterado nas plataformas de anúncio.'] },
  automation: { title: 'Como usar as Automações', answers: ['Quais alertas e relatórios rodam sozinhos?', 'Alguma automação falhou?'], steps: ['Cada automação tem um gatilho (quando roda), condições (filtro) e ações (o que faz).', 'Use "Executar teste" para ver o resultado sem esperar o horário.', 'Comece por um modelo pronto e ajuste no editor visual.'], inspired: 'Editor visual inspirado no n8n, Make e Zapier.' },
  import: { title: 'Como importar dados', answers: ['Como trazer dados de uma planilha?', 'O que acontece com linhas repetidas ou com erro?'], steps: ['Baixe o CSV de exemplo para ver o formato.', 'Confira se as colunas foram reconhecidas e ajuste o que faltar.', 'Revise a validação e confirme. Dá para desfazer pelo histórico.'] },
}
