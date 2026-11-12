"""AI Marketing Analyst: envia à OpenAI somente agregados calculados em SQL.

O modelo recebe uma instrução explícita para não inventar números nem afirmar
causalidade; a resposta cita os indicadores fornecidos no contexto.
"""
import json
from datetime import date, timedelta

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from .metrics import kpis

SYSTEM_PROMPT = """Você é um analista de marketing sênior. Responda em português do Brasil.
Regras obrigatórias:
1. Use APENAS os números presentes no JSON de contexto. Nunca invente métricas, valores ou campanhas.
2. Se o contexto não tiver dados para responder, diga isso claramente.
3. Não afirme causalidade sem evidência: descreva associações e sugira o que investigar.
4. ROAS = receita/mídia; ROI usa lucro bruto (receita × margem) contra investimento total. Receita não é lucro.
5. Seja objetivo: resposta direta, números de apoio e até 3 recomendações práticas."""


def build_context(db: Session, start: date, end: date, margin: float) -> dict:
    days = (end - start).days + 1
    pstart, pend = start - timedelta(days=days), start - timedelta(days=1)
    return {
        "periodo": {"inicio": str(start), "fim": str(end), "margem_bruta": margin, "atribuicao": get_settings().attribution_model},
        "total": kpis(db, start, end, margin),
        "total_periodo_anterior": kpis(db, pstart, pend, margin),
        "por_canal": kpis(db, start, end, margin, group_by="channel"),
        "por_canal_periodo_anterior": kpis(db, pstart, pend, margin, group_by="channel"),
        "por_campanha": kpis(db, start, end, margin, group_by="campaign"),
    }


def ask(db: Session, question: str, start: date, end: date) -> dict:
    s = get_settings()
    if not s.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY não configurada no backend")
    ctx = build_context(db, start, end, s.gross_margin)
    r = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {s.openai_api_key}"},
        json={
            "model": s.openai_model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Contexto (JSON):\n{json.dumps(ctx, default=str, ensure_ascii=False)}\n\nPergunta: {question}"},
            ],
        },
        timeout=45,
    )
    r.raise_for_status()
    return {"answer": r.json()["choices"][0]["message"]["content"], "model": s.openai_model, "period": {"start": str(start), "end": str(end)}}
