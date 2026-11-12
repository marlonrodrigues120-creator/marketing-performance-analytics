import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Award, Download, SlidersHorizontal, TrendingDown } from 'lucide-react'
import { useAnalytics } from '../store/useAnalytics'
import { useStore } from '../store/AppStore'
import { Badge, Card, DataTable, DemoBadge, EmptyState, PageHeader, Segmented, type Column } from '../components/ui'
import { ScorePill } from '../components/score'
import { campaignStats, type CampaignStat } from '../lib/query'
import { scoreCampaign, type CampaignScore } from '../lib/score'
import { money, num, percent, ratio } from '../lib/format'
import clsx from 'clsx'

type Row = CampaignStat & { score: CampaignScore; rank: 'top' | 'bottom' | null }

export function exportCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => (v === null ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : `"${String(v).replace(/"/g, '""')}"`)
  const csv = '﻿' + [header.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Campaigns() {
  const a = useAnalytics()
  const { settings, channels, tags } = useStore()
  const nav = useNavigate()
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [view, setView] = useState<'all' | 'paid' | 'organic'>('all')

  const rows: Row[] = useMemo(() => {
    const stats = campaignStats(a.campaigns, channels, a.rows, a.margin).map((s) => ({ ...s, score: scoreCampaign(s.campaign, s.d, settings), rank: null as Row['rank'] }))
    const scored = stats.filter((s) => s.score.score !== null).sort((x, y) => y.score.score! - x.score.score!)
    scored.slice(0, 3).forEach((s) => (s.rank = 'top'))
    scored.slice(-3).forEach((s) => (s.rank = s.rank ?? 'bottom'))
    return stats
  }, [a, channels, settings])

  const shown = rows.filter((r) => (channelFilter === 'all' || r.channel.id === channelFilter) && (view === 'all' || (view === 'paid' ? r.d.mediaSpend > 0 : r.d.mediaSpend === 0)))
  const best = rows.filter((r) => r.rank === 'top').sort((x, y) => y.score.score! - x.score.score!)
  const worst = rows.filter((r) => r.rank === 'bottom').sort((x, y) => x.score.score! - y.score.score!)

  const cols: Column<Row>[] = [
    {
      key: 'name',
      header: 'Campanha',
      sticky: true,
      value: (r) => r.campaign.name,
      render: (r) => (
        <div className="flex max-w-[260px] items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.channel.color }} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium">{r.campaign.name}</span>
              {r.rank === 'top' && <Award size={13} className="shrink-0 text-good" aria-label="Melhor performance" />}
              {r.rank === 'bottom' && <TrendingDown size={13} className="shrink-0 text-bad" aria-label="Pior performance" />}
            </div>
            <div className="flex items-center gap-1 text-[11px] muted">
              {r.campaign.status !== 'Ativa' && <span>{r.campaign.status} ·</span>}
              {r.campaign.objective}
              {tags[r.campaign.id]?.map((t) => <Badge key={t} tone="purple" className="ml-1 !py-0">#{t}</Badge>)}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'channel', header: 'Canal', value: (r) => r.channel.name },
    { key: 'platform', header: 'Plataforma', value: (r) => r.campaign.platform },
    { key: 'inv', header: 'Investimento', align: 'right', value: (r) => r.d.investment, render: (r) => money(r.d.investment) },
    { key: 'imp', header: 'Impressões', align: 'right', value: (r) => r.d.impressions, render: (r) => num(r.d.impressions) },
    { key: 'clk', header: 'Cliques', align: 'right', value: (r) => r.d.clicks, render: (r) => num(r.d.clicks) },
    { key: 'ctr', header: 'CTR', align: 'right', value: (r) => r.d.ctr, render: (r) => percent(r.d.ctr) },
    { key: 'cpc', header: 'CPC', align: 'right', value: (r) => r.d.cpc, render: (r) => money(r.d.cpc) },
    { key: 'leads', header: 'Leads', align: 'right', value: (r) => r.d.leads, render: (r) => num(r.d.leads) },
    { key: 'conv', header: 'Conversões', align: 'right', value: (r) => r.d.customers, render: (r) => num(r.d.customers) },
    { key: 'cpl', header: 'CPL', align: 'right', value: (r) => r.d.cpl, render: (r) => <span className={clsx(r.d.cpl !== null && r.d.cpl > settings.cplLimit && 'text-bad')}>{money(r.d.cpl)}</span> },
    { key: 'cac', header: 'CAC', align: 'right', value: (r) => r.d.cac, render: (r) => <span className={clsx(r.d.cac !== null && r.d.cac > settings.cacLimit && 'text-bad')}>{money(r.d.cac)}</span> },
    { key: 'rev', header: 'Receita atribuída', align: 'right', value: (r) => r.d.revenue, render: (r) => money(r.d.revenue) },
    { key: 'roas', header: 'ROAS', align: 'right', value: (r) => r.d.roas, render: (r) => <span className={clsx('font-medium', r.d.roas !== null && (r.d.roas >= settings.roasTarget ? 'text-good-ink dark:text-good' : 'text-bad'))}>{ratio(r.d.roas)}</span> },
    { key: 'roi', header: 'ROI', align: 'right', value: (r) => r.d.roi, render: (r) => <span className={clsx('font-medium', r.d.roi !== null && (r.d.roi >= 0 ? 'text-good-ink dark:text-good' : 'text-bad'))}>{percent(r.d.roi, 1)}</span> },
    { key: 'score', header: 'Score', align: 'center', value: (r) => r.score.score, render: (r) => <ScorePill s={r.score} /> },
  ]

  const download = () =>
    exportCsv(
      `campanhas_${a.range.start}_${a.range.end}.csv`,
      ['Campanha', 'Canal', 'Plataforma', 'Investimento', 'Impressões', 'Cliques', 'CTR %', 'CPC', 'Leads', 'Conversões', 'CPL', 'CAC', 'Receita', 'ROAS', 'ROI %', 'Score'],
      shown.map((r) => [r.campaign.name, r.channel.name, r.campaign.platform, r.d.investment, r.d.impressions, r.d.clicks, r.d.ctr, r.d.cpc, r.d.leads, r.d.customers, r.d.cpl, r.d.cac, r.d.revenue, r.d.roas, r.d.roi, r.score.score]),
    )

  return (
    <>
      <PageHeader title="Campaign Analytics" description="Acompanhamento individual das campanhas. Valores em vermelho excedem os limites de CAC/CPL ou ficam abaixo da meta de ROAS configurados em Settings." badge={<DemoBadge />} actions={<><Link to="/settings#score" className="btn-secondary"><SlidersHorizontal size={14} /> Metas e pesos do score</Link><button className="btn-secondary" onClick={download} disabled={!shown.length}><Download size={14} /> Exportar CSV</button></>} />
      {rows.length === 0 ? (
        <div className="card"><EmptyState title="Nenhuma campanha com dados no período" description="Ajuste os filtros globais." /></div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <HighlightList title="Melhor performance" subtitle="Maiores scores no período" rows={best} tone="good" onOpen={(id) => nav(`/campaigns/${id}`)} />
            <HighlightList title="Pior performance" subtitle="Menores scores — priorize a revisão" rows={worst} tone="bad" onOpen={(id) => nav(`/campaigns/${id}`)} />
          </div>
          <Card title={`${shown.length} campanhas`} subtitle="Clique em uma linha para ver o detalhamento">
            <DataTable
              rows={shown}
              columns={cols}
              rowKey={(r) => r.campaign.id}
              search={(r) => `${r.campaign.name} ${r.channel.name} ${r.campaign.platform}`}
              searchPlaceholder="Pesquisar campanha…"
              initialSort={{ key: 'inv', dir: 'desc' }}
              onRowClick={(r) => nav(`/campaigns/${r.campaign.id}`)}
              toolbar={
                <>
                  <select className="input w-auto py-2 text-xs dark:[color-scheme:dark]" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} aria-label="Filtrar por canal">
                    <option value="all">Todos os canais</option>
                    {a.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Segmented value={view} onChange={setView} options={[{ value: 'all', label: 'Todas' }, { value: 'paid', label: 'Mídia paga' }, { value: 'organic', label: 'Sem mídia' }]} />
                </>
              }
            />
          </Card>
        </>
      )}
    </>
  )
}

function HighlightList({ title, subtitle, rows, tone, onOpen }: { title: string; subtitle: string; rows: Row[]; tone: 'good' | 'bad'; onOpen: (id: string) => void }) {
  return (
    <Card title={<span className="flex items-center gap-1.5">{tone === 'good' ? <Award size={15} className="text-good" /> : <TrendingDown size={15} className="text-bad" />}{title}</span>} subtitle={subtitle}>
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {rows.map((r) => (
          <button key={r.campaign.id} onClick={() => onOpen(r.campaign.id)} className="flex w-full items-center gap-3 py-2 text-left hover:opacity-80">
            <ScorePill s={r.score} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.campaign.name}</div>
              <div className="text-[11px] muted">{r.score.explanation.split('. ').slice(1, 3).join('. ')}</div>
            </div>
            <div className="text-right text-xs tabular-nums">
              <div>ROI {percent(r.d.roi, 0)}</div>
              <div className="muted">CAC {money(r.d.cac)}</div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
