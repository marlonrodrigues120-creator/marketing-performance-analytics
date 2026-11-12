import clsx from 'clsx'
import { CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import type { Execution } from '../automation/types'
import { Badge, Modal } from './ui'
import { dateTimeBR } from '../lib/format'

export function StatusBadge({ s }: { s: Execution['status'] }) {
  const map = { success: ['green', 'Sucesso'], error: ['red', 'Erro'], running: ['blue', 'Executando'], skipped: ['gray', 'Ignorada'] } as const
  return <Badge tone={map[s][0]}>{map[s][1]}</Badge>
}

export const MODE_LABEL = { schedule: 'Agendada', event: 'Evento', manual: 'Manual', test: 'Teste' }

export default function ExecutionDetail({ ex, onClose }: { ex: Execution | null; onClose: () => void }) {
  return (
    <Modal open={!!ex} onClose={onClose} title="Detalhes da execução" size="lg">
      {ex && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['ID', <code key="i" className="text-[11px]">{ex.id}</code>],
              ['Workflow', ex.workflowName],
              ['Status', <StatusBadge key="s" s={ex.status} />],
              ['Modo', `${MODE_LABEL[ex.mode]} · ${ex.engine === 'n8n' ? 'n8n' : 'motor demo'}`],
              ['Início', dateTimeBR(ex.startedAt)],
              ['Fim', dateTimeBR(ex.finishedAt)],
              ['Duração', `${(ex.durationMs / 1000).toFixed(2)} s`],
              ['Chave de idempotência', <code key="k" className="break-all text-[11px]">{ex.idempotencyKey}</code>],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <div className="text-[11px] muted">{k}</div>
                <div className="font-medium">{v}</div>
              </div>
            ))}
          </div>
          {ex.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"><b>Erro:</b> {ex.error}</div>}
          {ex.result && <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5"><b>Resultado:</b> {ex.result.summary}</div>}
          {ex.steps.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold">Etapas</div>
              <ol className="space-y-2">
                {ex.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className={clsx('mt-0.5', s.status === 'success' ? 'text-good' : s.status === 'error' ? 'text-bad' : 'text-slate-400')}>{s.status === 'success' ? <CheckCircle2 size={15} /> : s.status === 'error' ? <XCircle size={15} /> : <CircleSlash size={15} />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-xs"><span className="font-medium">{s.label} <span className="font-normal muted">· {s.kind}</span></span><span className="tabular-nums muted">{s.ms} ms</span></div>
                      <div className="text-xs muted">{s.output}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {ex.result?.outputs?.map((o, i) => (
            <div key={i}>
              <div className="mb-1 text-xs font-semibold">Saída · {o.action}</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{o.content}</pre>
            </div>
          ))}
          <details>
            <summary className="cursor-pointer text-xs font-semibold">Dados de entrada</summary>
            <pre className="mt-1 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] dark:bg-white/5">{JSON.stringify(ex.input, null, 2)}</pre>
          </details>
        </div>
      )}
    </Modal>
  )
}
