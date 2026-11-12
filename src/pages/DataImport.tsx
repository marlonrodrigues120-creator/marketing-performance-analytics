import { useMemo, useRef, useState, type DragEvent } from 'react'
import Papa from 'papaparse'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, RotateCcw, Upload, X } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Badge, Card, DataTable, EmptyState, Modal, PageHeader, Segmented, toast, type Column } from '../components/ui'
import type { Campaign, DailyMetric } from '../data/types'
import { dateTimeBR, money, num } from '../lib/format'
import { isoDate } from '../data/seed'

const FIELDS = [
  { key: 'date', label: 'Data', required: true, syn: ['date', 'data', 'dia', 'day'] },
  { key: 'campaign', label: 'Campanha', required: true, syn: ['campaign', 'campanha', 'campaign_name', 'nome da campanha'] },
  { key: 'channel', label: 'Canal', required: false, syn: ['channel', 'canal', 'source', 'origem'] },
  { key: 'platform', label: 'Plataforma', required: false, syn: ['platform', 'plataforma'] },
  { key: 'mediaSpend', label: 'Investimento em mídia', required: false, syn: ['spend', 'cost', 'custo', 'investimento', 'media_spend', 'valor gasto', 'amount_spent'] },
  { key: 'otherCost', label: 'Outros custos', required: false, syn: ['other_cost', 'outros custos', 'outros_custos', 'other costs'] },
  { key: 'impressions', label: 'Impressões', required: false, syn: ['impressions', 'impressoes', 'impressões', 'impr'] },
  { key: 'clicks', label: 'Cliques', required: false, syn: ['clicks', 'cliques', 'link_clicks'] },
  { key: 'visitors', label: 'Visitantes', required: false, syn: ['visitors', 'visitantes', 'sessions', 'sessoes', 'sessões'] },
  { key: 'leads', label: 'Leads', required: false, syn: ['leads', 'lead'] },
  { key: 'opportunities', label: 'Oportunidades', required: false, syn: ['opportunities', 'oportunidades', 'sql'] },
  { key: 'customers', label: 'Conversões (clientes)', required: false, syn: ['conversions', 'conversoes', 'conversões', 'customers', 'clientes'] },
  { key: 'orders', label: 'Pedidos', required: false, syn: ['orders', 'pedidos', 'purchases', 'compras'] },
  { key: 'revenue', label: 'Receita', required: false, syn: ['revenue', 'receita', 'conversion_value', 'valor de conversao', 'valor'] },
] as const
type FieldKey = (typeof FIELDS)[number]['key']
const NUMERIC: FieldKey[] = ['mediaSpend', 'otherCost', 'impressions', 'clicks', 'visitors', 'leads', 'opportunities', 'customers', 'orders', 'revenue']

const normH = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 _]/g, '').trim()

function parseNum(v: string | undefined): number | null {
  if (v === undefined || v === null) return null
  let s = String(v).trim().replace(/[R$\s%]/g, '')
  if (!s) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (lastComma >= 0) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return isFinite(n) ? n : NaN
}
function parseDate(v: string | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return valid(+m[3], +m[2], +m[1])
  return null
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(y, mo - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? isoDate(dt) : null
}

interface Checked {
  line: number
  raw: Record<string, string>
  row: Partial<DailyMetric> & { campaignName?: string; channelName?: string; platform?: string }
  errors: string[]
  warnings: string[]
  duplicate: 'file' | 'existing' | null
  isNewCampaign: boolean
}

export default function DataImport() {
  const s = useStore()
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [map, setMap] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>)
  const [missing, setMissing] = useState<'zero' | 'skip'>('zero')
  const [dupPolicy, setDupPolicy] = useState<'skip' | 'keep'>('skip')
  const [step, setStep] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = (f: File) => {
    if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') return toast.error('Envie um arquivo .csv.')
    if (f.size > 10 * 1024 * 1024) return toast.error('Arquivo acima de 10 MB.')
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const headers = r.meta.fields ?? []
        if (!headers.length || !r.data.length) return toast.error('Não encontrei cabeçalho ou linhas no arquivo.')
        const auto = {} as Record<FieldKey, string>
        for (const fd of FIELDS) {
          const h = headers.find((x) => (fd.syn as readonly string[]).includes(normH(x)))
          if (h) auto[fd.key] = h
        }
        setFile({ name: f.name, headers, rows: r.data })
        setMap(auto)
        setStep(2)
        toast.success(`${r.data.length} linhas lidas · ${Object.keys(auto).length} colunas identificadas automaticamente.`)
      },
      error: (e) => toast.error(`Falha ao ler CSV: ${e.message}`),
    })
  }

  const checked: Checked[] = useMemo(() => {
    if (!file) return []
    const existingKeys = new Set(s.metrics.map((m) => `${m.date}|${m.campaignId}`))
    const seen = new Set<string>()
    const byName = new Map(s.campaigns.map((c) => [c.name.toLowerCase(), c]))
    return file.rows.map((raw, i) => {
      const errors: string[] = []
      const warnings: string[] = []
      const get = (k: FieldKey) => (map[k] ? raw[map[k]] : undefined)
      const date = parseDate(get('date'))
      if (!get('date')) errors.push('Data ausente')
      else if (!date) errors.push(`Data inválida "${get('date')}"`)
      const name = (get('campaign') ?? '').trim()
      if (!name) errors.push('Campanha ausente')
      const camp = byName.get(name.toLowerCase()) ?? s.campaigns.find((c) => c.id === name)
      const row: Checked['row'] = { date: date ?? undefined, campaignName: name, channelName: get('channel')?.trim(), platform: get('platform')?.trim() }
      for (const k of NUMERIC) {
        const v = parseNum(get(k))
        if (v === null) {
          if (map[k]) warnings.push(`${FIELDS.find((f) => f.key === k)!.label} vazio`)
          ;(row as Record<string, number>)[k] = 0
        } else if (isNaN(v)) errors.push(`${FIELDS.find((f) => f.key === k)!.label} não numérico ("${get(k)}")`)
        else if (v < 0) errors.push(`${FIELDS.find((f) => f.key === k)!.label} negativo`)
        else (row as Record<string, number>)[k] = v
      }
      const r = row as Record<string, number>
      if (r.clicks > r.impressions && r.impressions > 0) warnings.push('Cliques maiores que impressões')
      if (r.customers > r.leads && r.leads > 0) warnings.push('Conversões maiores que leads')
      if (r.orders < r.customers) r.orders = r.customers
      if (!r.visitors && r.clicks) r.visitors = r.clicks
      if (!camp && name && !row.channelName) warnings.push('Campanha nova sem canal → "Outros canais"')
      const key = `${date}|${camp?.id ?? 'new:' + name.toLowerCase()}`
      let duplicate: Checked['duplicate'] = null
      if (date && name) {
        if (seen.has(key)) duplicate = 'file'
        else if (camp && existingKeys.has(key)) duplicate = 'existing'
        seen.add(key)
      }
      return { line: i + 2, raw, row, errors, warnings, duplicate, isNewCampaign: !!name && !camp }
    })
  }, [file, map, s.metrics, s.campaigns])

  const stats = useMemo(() => {
    const err = checked.filter((c) => c.errors.length)
    const dup = checked.filter((c) => !c.errors.length && c.duplicate)
    const warnOnly = checked.filter((c) => !c.errors.length && c.warnings.some((w) => w.endsWith('vazio')))
    const importable = checked.filter((c) => !c.errors.length && (dupPolicy === 'keep' ? c.duplicate !== 'file' : !c.duplicate) && !(missing === 'skip' && c.warnings.some((w) => w.endsWith('vazio'))))
    return { err, dup, warnOnly, importable, newCamps: Array.from(new Set(importable.filter((c) => c.isNewCampaign).map((c) => c.row.campaignName!))) }
  }, [checked, missing, dupPolicy])

  const requiredOk = FIELDS.filter((f) => f.required).every((f) => map[f.key])

  const commit = () => {
    const newCamps: Campaign[] = stats.newCamps.map((name, i) => {
      const sample = stats.importable.find((c) => c.row.campaignName === name)!
      const ch = s.channels.find((c) => c.name.toLowerCase() === sample.row.channelName?.toLowerCase() || c.id === sample.row.channelName?.toLowerCase()) ?? s.channels.find((c) => c.id === 'other')!
      return { id: `imp_${Date.now().toString(36)}_${i}`, name, channelId: ch.id, platform: sample.row.platform || ch.name, objective: 'Vendas', conversionType: 'Compra', status: 'Ativa', startDate: sample.row.date!, endDate: null, monthlyBudget: 0, owner: s.user?.name ?? '—' }
    })
    const idOf = (name: string) => s.campaigns.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? s.campaigns.find((c) => c.id === name)?.id ?? newCamps.find((c) => c.name === name)!.id
    const rows: DailyMetric[] = stats.importable.map((c) => {
      const r = c.row as Record<string, number>
      return { date: c.row.date!, campaignId: idOf(c.row.campaignName!), mediaSpend: r.mediaSpend, otherCost: r.otherCost, impressions: r.impressions, clicks: r.clicks, visitors: r.visitors, leads: r.leads, opportunities: r.opportunities, customers: r.customers, orders: r.orders, revenue: r.revenue, source: 'import' }
    })
    s.commitImport(file!.name, rows, newCamps, { duplicates: stats.dup.length, skipped: checked.length - rows.length - stats.dup.length, total: checked.length })
    toast.success(`${rows.length} linhas importadas. Indicadores, gráficos e insights já refletem os novos dados.`)
    setConfirmOpen(false)
    setFile(null)
    setStep(1)
  }

  const sampleCsv = () => {
    const today = isoDate(new Date())
    const y = s.dataEnd.split('-').reverse().join('/')
    const csv = [
      'data;campanha;canal;plataforma;investimento;outros_custos;impressoes;cliques;visitantes;leads;oportunidades;conversoes;pedidos;receita',
      `${today};Google Search — Marca;Google Ads;Google Ads;712,40;38,00;6.120;531;478;49;24;11;12;6.410,90`,
      `${today};Meta — Remarketing Dinâmico;Meta Ads;Meta Ads;598,10;40,00;31.200;502;430;40;19;9;10;3.522,00`,
      `${today};Pinterest — Teste de Criativos;Outros canais;Pinterest Ads;250,00;20,00;48.000;390;300;12;4;1;1;289,90`,
      `${today};SEO — Blog & Conteúdo;Organic Search;Orgânico;;395,00;27.300;955;910;29;10;3;3;1.240,00`,
      `${y};Google Search — Marca;Google Ads;Google Ads;650,00;35,00;6.000;500;450;45;22;10;11;5.700,00`,
      `${today};Google Search — Marca;Google Ads;Google Ads;712,40;38,00;6.120;531;478;49;24;11;12;6.410,90`,
      `31/02/2026;TikTok — Spark Ads Conversão;TikTok Ads;TikTok Ads;-50;0;1000;10;8;1;0;0;0;0`,
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'exemplo_importacao_marketing.csv'
    a.click()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) load(f)
  }

  const histCols: Column<(typeof s.imports)[number]>[] = [
    { key: 'at', header: 'Data', value: (r) => r.at, render: (r) => dateTimeBR(r.at) },
    { key: 'file', header: 'Arquivo', value: (r) => r.fileName },
    { key: 'user', header: 'Usuário', value: (r) => r.user },
    { key: 'rows', header: 'Linhas', align: 'right', value: (r) => r.rows },
    { key: 'ins', header: 'Inseridas', align: 'right', value: (r) => r.inserted },
    { key: 'dup', header: 'Duplicadas', align: 'right', value: (r) => r.duplicates },
    { key: 'skip', header: 'Ignoradas', align: 'right', value: (r) => r.skipped },
    { key: 'nc', header: 'Novas campanhas', align: 'right', value: (r) => r.newCampaigns },
    { key: 'st', header: 'Status', value: (r) => r.status, render: (r) => <Badge tone={r.status === 'Concluída' ? 'green' : 'gray'}>{r.status}</Badge> },
    { key: 'act', header: '', sortable: false, render: (r) => r.status === 'Concluída' && s.can('admin') ? <button className="btn-ghost btn-sm" onClick={() => { s.revertImport(r.id); toast.success('Importação revertida.') }}><RotateCcw size={12} /> Reverter</button> : null },
  ]

  return (
    <>
      <PageHeader title="Data Import" description="Importe dados de campanhas via CSV com mapeamento de colunas, validação, detecção de duplicidades e confirmação. A arquitetura está preparada para conectores de API." actions={<button className="btn-secondary" onClick={sampleCsv}><Download size={14} /> CSV de exemplo</button>} />
      <div className="mb-4 flex items-center gap-2 text-xs">
        {['Upload', 'Mapeamento', 'Validação', 'Confirmação'].map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold', step > i + 1 ? 'bg-good text-white' : step === i + 1 ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-white/10')}>{step > i + 1 ? <CheckCircle2 size={13} /> : i + 1}</span>
            <span className={clsx('hidden sm:inline', step === i + 1 ? 'font-semibold' : 'muted')}>{l}</span>
            {i < 3 && <span className="h-px w-6 bg-slate-300 dark:bg-white/15 sm:w-10" />}
          </div>
        ))}
      </div>

      {!s.can('edit') ? (
        <div className="card"><EmptyState title="Perfil somente leitura" description="Importações exigem perfil Analista ou Administrador." /></div>
      ) : !file ? (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => input.current?.click()} className={clsx('card flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-14 text-center transition', drag ? 'border-brand-400 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:border-brand-300 dark:border-white/10')}>
          <div className="rounded-full bg-brand-50 p-3 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Upload size={22} /></div>
          <p className="mt-3 text-sm font-medium">Arraste um arquivo CSV ou clique para selecionar</p>
          <p className="mt-1 text-xs muted">Separador vírgula ou ponto e vírgula · datas AAAA-MM-DD ou DD/MM/AAAA · números em formato brasileiro ou internacional · até 10 MB</p>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = '' }} />
        </div>
      ) : (
        <>
          <Card title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} /> {file.name}</span>} subtitle={`${file.rows.length} linhas · ${file.headers.length} colunas`} actions={<button className="btn-ghost btn-sm" onClick={() => { setFile(null); setStep(1) }}><X size={13} /> Descartar</button>}>
            <div className="mb-2 text-xs font-semibold">Pré-visualização (5 primeiras linhas)</div>
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-max text-xs">
                <thead><tr>{file.headers.map((h) => <th key={h} className="th border-b border-slate-100 first:pl-5 dark:border-white/5">{h}</th>)}</tr></thead>
                <tbody>{file.rows.slice(0, 5).map((r, i) => <tr key={i}>{file.headers.map((h) => <td key={h} className="td border-b border-slate-50 text-xs first:pl-5 dark:border-white/5">{r[h] || <span className="text-amber-600">vazio</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-4" title="Mapeamento de campos" subtitle="Colunas identificadas automaticamente por nome; ajuste se necessário. Campos com * são obrigatórios.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="label">{f.label}{f.required && ' *'}</span>
                  <select className={clsx('input py-1.5 text-xs dark:[color-scheme:dark]', f.required && !map[f.key] && 'border-red-300')} value={map[f.key] ?? ''} onChange={(e) => { setMap({ ...map, [f.key]: e.target.value }); setStep(2) }}>
                    <option value="">— não importar —</option>
                    {file.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" disabled={!requiredOk} onClick={() => setStep(3)}>{requiredOk ? 'Validar dados' : 'Mapeie Data e Campanha'}</button>
            </div>
          </Card>

          {step >= 3 && (
            <Card className="mt-4" title="Validação" subtitle="Revise erros, duplicidades e valores ausentes antes de importar">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { l: 'Linhas lidas', v: checked.length },
                  { l: 'Com erro (ignoradas)', v: stats.err.length, c: 'text-bad' },
                  { l: 'Duplicadas', v: stats.dup.length, c: 'text-amber-600' },
                  { l: 'Com valores ausentes', v: stats.warnOnly.length, c: 'text-amber-600' },
                  { l: 'Serão importadas', v: stats.importable.length, c: 'text-good-ink dark:text-good' },
                ].map((k) => <div key={k.l} className="rounded-lg bg-slate-50 p-3 dark:bg-white/5"><div className="text-[11px] muted">{k.l}</div><div className={clsx('text-xl font-semibold', k.c)}>{k.v}</div></div>)}
              </div>
              <div className="mt-4 flex flex-wrap gap-6 text-xs">
                <div><div className="label">Valores numéricos ausentes</div><Segmented size="sm" value={missing} onChange={setMissing} options={[{ value: 'zero', label: 'Tratar como zero' }, { value: 'skip', label: 'Ignorar a linha' }]} /></div>
                <div><div className="label">Linhas que já existem na base (data + campanha)</div><Segmented size="sm" value={dupPolicy} onChange={setDupPolicy} options={[{ value: 'skip', label: 'Ignorar' }, { value: 'keep', label: 'Somar como novo registro' }]} /></div>
              </div>
              {stats.newCamps.length > 0 && <p className="mt-3 rounded-lg bg-brand-50 p-2.5 text-xs text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">Novas campanhas serão criadas: <b>{stats.newCamps.join(', ')}</b></p>}
              <div className="-mx-4 mt-4 max-h-80 overflow-auto sm:-mx-5">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="sticky top-0 bg-white dark:bg-[#121722]"><tr>{['Linha', 'Data', 'Campanha', 'Investimento', 'Leads', 'Conversões', 'Receita', 'Situação'].map((h, i) => <th key={h} className={clsx('th border-b border-slate-100 dark:border-white/5', i === 0 && 'pl-5')}>{h}</th>)}</tr></thead>
                  <tbody>
                    {checked.map((c) => (
                      <tr key={c.line} className={clsx(c.errors.length ? 'bg-red-50/60 dark:bg-red-500/5' : c.duplicate ? 'bg-amber-50/60 dark:bg-amber-500/5' : '')}>
                        <td className="td pl-5 text-xs">{c.line}</td>
                        <td className="td text-xs">{c.row.date ?? '—'}</td>
                        <td className="td max-w-[220px] truncate text-xs">{c.row.campaignName} {c.isNewCampaign && <Badge tone="blue">nova</Badge>}</td>
                        <td className="td text-xs">{money((c.row as Record<string, number>).mediaSpend)}</td>
                        <td className="td text-xs">{num((c.row as Record<string, number>).leads)}</td>
                        <td className="td text-xs">{num((c.row as Record<string, number>).customers)}</td>
                        <td className="td text-xs">{money((c.row as Record<string, number>).revenue)}</td>
                        <td className="td whitespace-normal text-xs">
                          {c.errors.length ? <span className="text-bad">{c.errors.join('; ')}</span> : c.duplicate ? <span className="text-amber-700 dark:text-amber-300">Duplicada ({c.duplicate === 'file' ? 'repetida no arquivo' : 'já existe na base'})</span> : c.warnings.length ? <span className="text-amber-700 dark:text-amber-300">{c.warnings.join('; ')}</span> : <span className="text-good-ink dark:text-good">OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn-primary" disabled={!stats.importable.length} onClick={() => { setStep(4); setConfirmOpen(true) }}>Importar {stats.importable.length} linhas</button>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="mt-4" title="Histórico de importações">
        <DataTable rows={s.imports} columns={histCols} rowKey={(r) => r.id} empty={<EmptyState icon={<Database size={20} />} title="Nenhuma importação ainda" description="Baixe o CSV de exemplo para testar o fluxo completo (inclui duplicidade, valor ausente, data inválida e campanha nova)." />} />
      </Card>

      <Card className="mt-4" title="Integrações de dados (próximas fases)" subtitle="Conectores já previstos na arquitetura do backend (app/connectors). Credenciais OAuth ficam no servidor.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Google Ads API', 'Campanhas, custo, cliques e conversões diárias (GAQL).'],
            ['Meta Marketing API', 'Insights por campanha/conjunto (Facebook e Instagram).'],
            ['Google Analytics 4', 'Sessões, eventos de lead e receita por origem/mídia.'],
            ['LinkedIn Ads', 'Campanhas B2B, leads de formulário nativo.'],
            ['TikTok Ads', 'Relatórios de campanha e conversões.'],
            ['CRMs externos', 'HubSpot, RD Station, Pipedrive: oportunidades e vendas.'],
          ].map(([n, d]) => (
            <div key={n} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="text-xs">
                <div className="flex items-center gap-2 text-sm font-medium">{n} <Badge>Não configurado</Badge></div>
                <p className="mt-0.5 muted">{d}</p>
                <p className="mt-1 muted">Configure as credenciais no <code>.env</code> do backend e habilite o conector — veja o README.</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={confirmOpen} onClose={() => { setConfirmOpen(false); setStep(3) }} title="Confirmar importação" footer={<><button className="btn-secondary" onClick={() => { setConfirmOpen(false); setStep(3) }}>Voltar</button><button className="btn-primary" onClick={commit}>Confirmar e importar</button></>}>
        <ul className="space-y-1.5 text-sm">
          <li><b>{stats.importable.length}</b> linhas serão inseridas na tabela <code>marketing_metrics</code>.</li>
          <li><b>{stats.err.length}</b> linhas com erro e <b>{stats.dup.length}</b> duplicadas não serão {dupPolicy === 'skip' ? 'importadas' : 'importadas se repetidas no arquivo'}.</li>
          <li><b>{stats.newCamps.length}</b> nova(s) campanha(s) serão criadas.</li>
          <li>Investimento total importado: <b>{money(stats.importable.reduce((a, c) => a + ((c.row as Record<string, number>).mediaSpend ?? 0) + ((c.row as Record<string, number>).otherCost ?? 0), 0))}</b> · receita: <b>{money(stats.importable.reduce((a, c) => a + ((c.row as Record<string, number>).revenue ?? 0), 0))}</b>.</li>
          <li className="text-xs muted">Workflows ativos com o gatilho “Importação de novos dados” serão disparados. A importação pode ser revertida pelo histórico.</li>
        </ul>
      </Modal>
    </>
  )
}
