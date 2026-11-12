"""Rotas REST. Todas exigem JWT, exceto /auth/login, /health e o callback assinado do n8n."""
import json
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import AutomationLog, Campaign, Channel, DataImport, FunnelDaily, MarketingMetric, User, Workflow, WorkflowExecution
from ..security import create_token, current_user, require, verify_n8n_signature, verify_password
from ..services import ai, importer, metrics, n8n

router = APIRouter(prefix="/api")


# ------------------------------------------------------------------ health
@router.get("/health")
def health(db: Session = Depends(get_db)):
    s = get_settings()
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # noqa: BLE001
        database = "unreachable"
    return {"version": s.app_version, "database": database, "n8n": n8n.health(), "openai": "configured" if s.openai_api_key else "not_configured"}


# ------------------------------------------------------------------ auth
class LoginIn(BaseModel):
    email: str = Field(pattern=r"^\S+@\S+\.\S+$")
    password: str = Field(min_length=6)


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "E-mail ou senha inválidos")
    return {"access_token": create_token(user), "token_type": "bearer", "user": {"name": user.name, "email": user.email, "role": user.role}}


# ------------------------------------------------------------------ analytics
def _period(start: date | None, end: date | None) -> tuple[date, date]:
    end = end or date.today() - timedelta(days=1)
    start = start or end - timedelta(days=29)
    if start > end:
        raise HTTPException(422, "start deve ser anterior a end")
    return start, end


@router.get("/kpis")
def get_kpis(start: date | None = None, end: date | None = None, group_by: str | None = None, channel: list[str] | None = None, campaign: list[str] | None = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    start, end = _period(start, end)
    margin = get_settings().gross_margin
    return {"period": {"start": start, "end": end}, "margin": margin, "attribution": get_settings().attribution_model, "rows": metrics.kpis(db, start, end, margin, group_by, channel, campaign)}


@router.get("/campaigns")
def list_campaigns(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.scalars(select(Campaign).order_by(Campaign.name)).all()


@router.get("/channels")
def list_channels(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.scalars(select(Channel)).all()


# ------------------------------------------------------------------ AI
class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    start: date | None = None
    end: date | None = None


@router.post("/ai/ask")
def ask(body: AskIn, db: Session = Depends(get_db), _: User = Depends(current_user)):
    start, end = _period(body.start, body.end)
    try:
        return ai.ask(db, body.question, start, end)
    except RuntimeError as e:
        raise HTTPException(503, str(e)) from e


# ------------------------------------------------------------------ workflows
class WorkflowIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = None
    status: str = Field(default="draft", pattern="^(active|paused|draft)$")
    template_id: str | None = None
    definition: dict


@router.get("/workflows")
def list_workflows(db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.scalars(select(Workflow).order_by(Workflow.created_at)).all()


@router.post("/workflows", status_code=201)
def create_workflow(body: WorkflowIn, db: Session = Depends(get_db), user: User = Depends(require("analyst"))):
    _validate_definition(body.definition)
    wf = Workflow(**body.model_dump(), created_by=user.id)
    db.add(wf)
    db.add(AutomationLog(level="info", user_id=user.id, message=f"Workflow criado: {body.name}"))
    db.commit()
    return wf


@router.put("/workflows/{wf_id}")
def update_workflow(wf_id: uuid.UUID, body: WorkflowIn, db: Session = Depends(get_db), user: User = Depends(require("analyst"))):
    wf = db.get(Workflow, wf_id) or _404()
    _validate_definition(body.definition)
    for k, v in body.model_dump().items():
        setattr(wf, k, v)
    db.add(AutomationLog(level="info", workflow_id=wf.id, user_id=user.id, message=f"Workflow atualizado ({wf.status})"))
    db.commit()
    return wf


@router.delete("/workflows/{wf_id}", status_code=204)
def delete_workflow(wf_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require("admin"))):
    wf = db.get(Workflow, wf_id) or _404()
    db.add(AutomationLog(level="warn", user_id=user.id, message=f"Workflow excluído: {wf.name}"))
    db.delete(wf)
    db.commit()


@router.post("/workflows/{wf_id}/trigger", status_code=202)
def trigger_workflow(wf_id: uuid.UUID, mode: str = "manual", db: Session = Depends(get_db), user: User = Depends(require("analyst"))):
    wf = db.get(Workflow, wf_id) or _404()
    if mode not in {"manual", "test"} and wf.status != "active":
        raise HTTPException(409, "Workflow não está ativo")
    try:
        ex = n8n.trigger(db, wf, mode, {"requestedBy": str(user.id), "asOf": str(date.today() - timedelta(days=1))})
    except n8n.DuplicateExecution as e:
        raise HTTPException(409, f"Execução duplicada ignorada ({e})") from e
    return {"executionId": str(ex.id), "status": ex.status, "error": ex.error_message}


@router.get("/workflows/{wf_id}/executions")
def executions(wf_id: uuid.UUID, limit: int = 50, db: Session = Depends(get_db), _: User = Depends(current_user)):
    return db.scalars(select(WorkflowExecution).where(WorkflowExecution.workflow_id == wf_id).order_by(WorkflowExecution.started_at.desc()).limit(min(limit, 200))).all()


def _validate_definition(defn: dict) -> None:
    nodes = defn.get("nodes", [])
    if sum(1 for n in nodes if n.get("data", {}).get("kind") == "trigger") != 1:
        raise HTTPException(422, "O workflow precisa de exatamente um gatilho")
    if not any(n.get("data", {}).get("kind") == "action" for n in nodes):
        raise HTTPException(422, "O workflow precisa de ao menos uma ação")


def _404():
    raise HTTPException(404, "Não encontrado")


# ------------------------------------------------------------------ n8n callbacks
class ExecutionResult(BaseModel):
    executionId: uuid.UUID
    status: str = Field(pattern="^(running|success|error)$")
    result: dict | None = None
    error: str | None = None
    n8nExecutionId: str | None = None
    durationMs: int | None = None


@router.post("/webhooks/n8n/execution-result")
def execution_result(raw: bytes = Depends(verify_n8n_signature), db: Session = Depends(get_db)):
    """Recebido do n8n ao fim (ou falha) de cada execução. Idempotente por executionId."""
    body = ExecutionResult(**json.loads(raw))
    ex = db.get(WorkflowExecution, body.executionId) or _404()
    if ex.status in {"success", "error"} and body.status != "error":
        return {"ok": True, "ignored": "já finalizada"}
    ex.status, ex.result, ex.error_message = body.status, body.result, body.error
    ex.n8n_execution_id = body.n8nExecutionId or ex.n8n_execution_id
    if body.status in {"success", "error"}:
        ex.finished_at = datetime.now(UTC)
        ex.duration_ms = body.durationMs
    db.add(AutomationLog(level="error" if body.status == "error" else "info", workflow_id=ex.workflow_id, execution_id=ex.id, message=body.error or f"Execução {body.status}"))
    db.commit()
    return {"ok": True}


@router.get("/webhooks/n8n/data")
def data_for_n8n(start: date, end: date, group_by: str | None = None, raw: bytes = Depends(verify_n8n_signature), db: Session = Depends(get_db)):
    """Endpoint consultado pelos workflows do n8n para obter KPIs (requisição assinada)."""
    margin = get_settings().gross_margin
    return {"rows": metrics.kpis(db, start, end, margin, group_by)}


# ------------------------------------------------------------------ imports
@router.post("/imports", status_code=201)
async def import_csv(file: UploadFile = File(...), mapping: str = Form(...), missing: str = Form("zero"), dry_run: bool = Form(True), db: Session = Depends(get_db), user: User = Depends(require("analyst"))):
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "Arquivo acima de 10 MB")
    try:
        rep = importer.validate(raw, json.loads(mapping), missing)
    except (ValueError, KeyError) as e:
        raise HTTPException(422, str(e)) from e
    camps = {c.name.lower(): c for c in db.scalars(select(Campaign))}
    existing = {(d, cid) for d, cid in db.execute(select(MarketingMetric.date, MarketingMetric.campaign_id))}
    rows, dup_existing, unknown = [], 0, set()
    for r in rep.valid.to_dict("records"):
        c = camps.get(str(r["campaign"]).strip().lower())
        if not c:
            unknown.add(r["campaign"])
            continue
        if (r["date"], c.id) in existing:
            dup_existing += 1
            continue
        rows.append((r, c))
    summary = {"total": rep.total, "valid": len(rows), "errors": rep.errors[:200], "duplicates": rep.duplicates_in_file + dup_existing, "missing_values": rep.missing_values, "unknown_campaigns": sorted(unknown)}
    if dry_run:
        return {"dry_run": True, **summary}
    imp = DataImport(file_name=file.filename or "upload.csv", user_id=user.id, total_rows=rep.total, inserted_rows=len(rows), duplicate_rows=summary["duplicates"], error_rows=len(rep.errors), mapping=json.loads(mapping))
    db.add(imp)
    db.flush()
    for r, c in rows:
        db.add(MarketingMetric(date=r["date"], campaign_id=c.id, media_spend=r.get("media_spend", 0), other_cost=r.get("other_cost", 0), impressions=int(r.get("impressions", 0)), clicks=int(r.get("clicks", 0)), visitors=int(r.get("visitors", 0)), source="import", import_id=imp.id))
        db.merge(FunnelDaily(date=r["date"], campaign_id=c.id, leads=int(r.get("leads", 0)), opportunities=int(r.get("opportunities", 0)), customers=int(r.get("customers", 0)), orders=int(r.get("orders", 0)), revenue=r.get("revenue", 0)))
    db.add(AutomationLog(level="info", user_id=user.id, message=f"Importação {imp.file_name}: {len(rows)} linhas"))
    db.commit()
    for wf in db.scalars(select(Workflow).where(Workflow.status == "active")):
        if any(n.get("data", {}).get("type") == "data_import" for n in wf.definition.get("nodes", [])):
            try:
                n8n.trigger(db, wf, "event", {"importId": str(imp.id), "rows": len(rows)}, f"{wf.id}:import:{imp.id}")
            except n8n.DuplicateExecution:
                pass
    return {"dry_run": False, "import_id": str(imp.id), **summary}
