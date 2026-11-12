"""Cliente do n8n: dispara workflows por webhook com assinatura HMAC e idempotência."""
import json
import time
import uuid
from datetime import UTC, datetime

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import AutomationLog, Workflow, WorkflowExecution
from ..security import sign


class DuplicateExecution(Exception):
    pass


def trigger(db: Session, wf: Workflow, mode: str, payload: dict, idempotency_key: str | None = None) -> WorkflowExecution:
    """Cria o registro da execução (chave única impede duplicidade) e chama o webhook do n8n."""
    s = get_settings()
    key = idempotency_key or f"{wf.id}:{mode}:{datetime.now(UTC).strftime('%Y%m%d%H%M')}"
    ex = WorkflowExecution(id=uuid.uuid4(), workflow_id=wf.id, idempotency_key=key, mode=mode, status="queued", input=payload)
    db.add(ex)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise DuplicateExecution(key) from e

    if not s.n8n_base_url or not s.n8n_webhook_secret:
        _fail(db, ex, "n8n não configurado (N8N_BASE_URL / N8N_WEBHOOK_SECRET)")
        return ex

    body = json.dumps({"executionId": str(ex.id), "workflowId": str(wf.id), "templateId": wf.template_id, "definition": wf.definition, "input": payload}).encode()
    ts = str(int(time.time()))
    headers = {"Content-Type": "application/json", "X-MPA-Timestamp": ts, "X-MPA-Signature": sign(body, ts, s.n8n_webhook_secret), "Idempotency-Key": key}
    url = f"{s.n8n_base_url.rstrip('/')}/webhook/mpa/{wf.template_id or 'custom'}"
    try:
        r = httpx.post(url, content=body, headers=headers, timeout=s.n8n_timeout_seconds)
        r.raise_for_status()
        ex.status = "running"
        ex.n8n_execution_id = (r.json() or {}).get("executionId") if r.headers.get("content-type", "").startswith("application/json") else None
        db.add(AutomationLog(level="info", workflow_id=wf.id, execution_id=ex.id, message=f"Disparado no n8n ({mode})"))
        db.commit()
    except httpx.HTTPError as e:
        _fail(db, ex, f"Falha ao chamar o n8n: {e}")
    return ex


def _fail(db: Session, ex: WorkflowExecution, msg: str) -> None:
    ex.status = "error"
    ex.error_message = msg
    ex.finished_at = datetime.now(UTC)
    db.add(AutomationLog(level="error", workflow_id=ex.workflow_id, execution_id=ex.id, message=msg))
    db.commit()


def health() -> str:
    s = get_settings()
    if not s.n8n_base_url:
        return "not_configured"
    try:
        r = httpx.get(f"{s.n8n_base_url.rstrip('/')}/healthz", timeout=5)
        return "ok" if r.status_code == 200 else f"http_{r.status_code}"
    except httpx.HTTPError:
        return "unreachable"
