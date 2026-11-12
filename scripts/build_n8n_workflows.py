"""Gera os workflows de referência do n8n (n8n/workflows/*.json).

Cada workflow:
  1. é disparado por agendamento (cron) ou pelo webhook /webhook/mpa/<template> chamado pela API;
  2. assina e consulta /api/webhooks/n8n/data (HMAC-SHA256 com N8N_WEBHOOK_SECRET);
  3. avalia as condições em um nó Code;
  4. envia e-mail/Slack quando há itens;
  5. devolve o resultado assinado para /api/webhooks/n8n/execution-result.
Execute: python scripts/build_n8n_workflows.py
"""
import json
import uuid
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "n8n" / "workflows"
OUT.mkdir(parents=True, exist_ok=True)

SIGN_JS = """// Assina a requisição para a API (HMAC-SHA256 de "<timestamp>.<body>")
const crypto = require('crypto');
const ts = Math.floor(Date.now() / 1000).toString();
const body = '';
const sig = 'sha256=' + crypto.createHmac('sha256', $env.N8N_WEBHOOK_SECRET).update(ts + '.' + body).digest('hex');
const input = $input.first().json;
const days = Number($json.lookbackDays ?? %(lookback)d);
const end = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
return [{ json: { ...input, ts, sig, start, end, executionId: input.body?.executionId ?? null } }];"""

RESULT_JS = """// Monta o payload de retorno e assina
const crypto = require('crypto');
const items = $('Avaliar condições').all().map(i => i.json);
const payload = JSON.stringify({ executionId: $('Assinar consulta').first().json.executionId, status: 'success', result: { summary: `${items.length} item(ns) processado(s)`, items }, durationMs: Date.now() - $execution.startedAt?.getTime?.() || null });
const ts = Math.floor(Date.now() / 1000).toString();
const sig = 'sha256=' + crypto.createHmac('sha256', $env.N8N_WEBHOOK_SECRET).update(ts + '.' + payload).digest('hex');
return [{ json: { payload, ts, sig } }];"""

TEMPLATES = {
    "daily-report": ("Daily Marketing Report", {"cron": "0 8 * * *"}, 1, "total", "return [{ json: { ...$json.rows[0], report: true } }];", "email"),
    "high-cac": ("High CAC Alert", {"cron": "0 8 * * *"}, 7, "campaign", "const limit = Number($env.MPA_CAC_LIMIT ?? 300);\nreturn $json.rows.filter(r => (r.cac ?? Infinity) > limit && r.investment > 1000).map(r => ({ json: r }));", "email+slack"),
    "low-roas": ("Low ROAS Alert", {"cron": "0 8 * * *"}, 7, "campaign", "const target = Number($env.MPA_ROAS_TARGET ?? 2.5);\nreturn $json.rows.filter(r => r.roas !== null && r.roas < target).map(r => ({ json: r }));", "slack"),
    "budget-monitoring": ("Budget Monitoring", {"cron": "0 8 * * *"}, 31, "campaign", "// Consumo do mês vs. orçamento planejado (budgets) — retornado pela API em r.budget_used\nreturn $json.rows.filter(r => (r.budget_used ?? 0) >= 80).map(r => ({ json: r }));", "email"),
    "conversion-drop": ("Conversion Drop Alert", {"cron": "0 8 * * *"}, 7, "campaign", "// A API devolve conversion_rate do período; compare com o período anterior armazenado em staticData\nconst prev = $getWorkflowStaticData('global').conv ?? {};\nconst out = $json.rows.filter(r => prev[r.key] && r.conversion_rate < prev[r.key] * 0.8);\n$getWorkflowStaticData('global').conv = Object.fromEntries($json.rows.map(r => [r.key, r.conversion_rate]));\nreturn out.map(r => ({ json: r }));", "slack"),
    "weekly-summary": ("Weekly Performance Summary", {"cron": "0 9 * * 1"}, 7, "channel", "const rows = $json.rows.filter(r => r.roi !== null).sort((a, b) => b.roi - a.roi);\nreturn [{ json: { best: rows[0], worst: rows[rows.length - 1], channels: rows } }];", "email+slack"),
}


def node(name, type_, pos, params, version=1, extra=None):
    n = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, name + type_)), "name": name, "type": type_, "typeVersion": version, "position": pos, "parameters": params}
    if extra:
        n.update(extra)
    return n


for tid, (name, sched, lookback, group, cond_js, delivery) in TEMPLATES.items():
    nodes = [
        node("Agendamento", "n8n-nodes-base.scheduleTrigger", [0, 0], {"rule": {"interval": [{"field": "cronExpression", "expression": sched["cron"]}]}}, 1.2),
        node("Disparo pela API", "n8n-nodes-base.webhook", [0, 200], {"httpMethod": "POST", "path": f"mpa/{tid}", "responseMode": "onReceived", "options": {}}, 2, {"webhookId": str(uuid.uuid5(uuid.NAMESPACE_URL, tid))}),
        node("Validar assinatura", "n8n-nodes-base.code", [220, 200], {"jsCode": "const crypto = require('crypto');\nconst h = $json.headers; const raw = JSON.stringify($json.body);\nconst expected = 'sha256=' + crypto.createHmac('sha256', $env.N8N_WEBHOOK_SECRET).update(h['x-mpa-timestamp'] + '.' + raw).digest('hex');\nif (Math.abs(Date.now() / 1000 - Number(h['x-mpa-timestamp'])) > 300 || expected !== h['x-mpa-signature']) throw new Error('Assinatura inválida');\nreturn [{ json: $json }];"}, 2),
        node("Assinar consulta", "n8n-nodes-base.code", [440, 100], {"jsCode": SIGN_JS % {"lookback": lookback}}, 2),
        node("Consultar KPIs", "n8n-nodes-base.httpRequest", [660, 100], {"method": "GET", "url": "={{$env.MPA_API_URL}}/api/webhooks/n8n/data", "sendQuery": True, "queryParameters": {"parameters": [{"name": "start", "value": "={{$json.start}}"}, {"name": "end", "value": "={{$json.end}}"}, {"name": "group_by", "value": group}]}, "sendHeaders": True, "headerParameters": {"parameters": [{"name": "X-MPA-Timestamp", "value": "={{$json.ts}}"}, {"name": "X-MPA-Signature", "value": "={{$json.sig}}"}]}, "options": {"timeout": 30000, "response": {"response": {"neverError": False}}}}, 4.2, {"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000}),
        node("Avaliar condições", "n8n-nodes-base.code", [880, 100], {"jsCode": cond_js}, 2),
        node("Há itens?", "n8n-nodes-base.if", [1100, 100], {"conditions": {"options": {"caseSensitive": True}, "conditions": [{"leftValue": "={{ $input.all().length }}", "rightValue": 0, "operator": {"type": "number", "operation": "gt"}}], "combinator": "and"}}, 2),
    ]
    conns = {
        "Agendamento": {"main": [[{"node": "Assinar consulta", "type": "main", "index": 0}]]},
        "Disparo pela API": {"main": [[{"node": "Validar assinatura", "type": "main", "index": 0}]]},
        "Validar assinatura": {"main": [[{"node": "Assinar consulta", "type": "main", "index": 0}]]},
        "Assinar consulta": {"main": [[{"node": "Consultar KPIs", "type": "main", "index": 0}]]},
        "Consultar KPIs": {"main": [[{"node": "Avaliar condições", "type": "main", "index": 0}]]},
        "Avaliar condições": {"main": [[{"node": "Há itens?", "type": "main", "index": 0}]]},
        "Há itens?": {"main": [[], [{"node": "Assinar resultado", "type": "main", "index": 0}]]},
    }
    outs = []
    if "email" in delivery:
        nodes.append(node("Enviar e-mail", "n8n-nodes-base.emailSend", [1320, 0], {"fromEmail": "={{$env.MPA_MAIL_FROM}}", "toEmail": "={{$env.MPA_MAIL_TO}}", "subject": f"[MPA] {name}", "emailFormat": "text", "text": "={{ JSON.stringify($input.all().map(i => i.json), null, 2) }}", "options": {}}, 2.1, {"credentials": {"smtp": {"id": "SMTP", "name": "SMTP (configurar no n8n)"}}}))
        outs.append("Enviar e-mail")
    if "slack" in delivery:
        nodes.append(node("Enviar ao Slack", "n8n-nodes-base.slack", [1320, 200], {"select": "channel", "channelId": {"__rl": True, "mode": "name", "value": "={{$env.MPA_SLACK_CHANNEL}}"}, "text": f"=*{name}*\\n{{{{ $input.all().map(i => '• ' + (i.json.key ?? 'total')).join('\\n') }}}}", "otherOptions": {}}, 2.2, {"credentials": {"slackApi": {"id": "SLACK", "name": "Slack (configurar no n8n)"}}}))
        outs.append("Enviar ao Slack")
    conns["Há itens?"]["main"][0] = [{"node": o, "type": "main", "index": 0} for o in outs]
    for o in outs:
        conns[o] = {"main": [[{"node": "Assinar resultado", "type": "main", "index": 0}]]}
    nodes.append(node("Assinar resultado", "n8n-nodes-base.code", [1540, 100], {"jsCode": RESULT_JS}, 2))
    nodes.append(node("Registrar resultado na API", "n8n-nodes-base.httpRequest", [1760, 100], {"method": "POST", "url": "={{$env.MPA_API_URL}}/api/webhooks/n8n/execution-result", "sendHeaders": True, "headerParameters": {"parameters": [{"name": "X-MPA-Timestamp", "value": "={{$json.ts}}"}, {"name": "X-MPA-Signature", "value": "={{$json.sig}}"}, {"name": "Content-Type", "value": "application/json"}]}, "sendBody": True, "contentType": "raw", "rawContentType": "application/json", "body": "={{$json.payload}}", "options": {}}, 4.2, {"retryOnFail": True, "maxTries": 3}))
    conns["Assinar resultado"] = {"main": [[{"node": "Registrar resultado na API", "type": "main", "index": 0}]]}
    wf = {"name": f"MPA — {name}", "nodes": nodes, "connections": conns, "active": False, "settings": {"executionOrder": "v1", "saveDataErrorExecution": "all", "errorWorkflow": ""}, "tags": [{"name": "marketing-performance"}], "meta": {"templateId": tid}}
    (OUT / f"{tid}.json").write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
    print("gerado", tid)
