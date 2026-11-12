"""Carrega a base demonstrativa (fictícia) no PostgreSQL.

Uso: python -m app.seed
Os dados vêm de seed/demo.json.gz, exportado pelo mesmo gerador do frontend
(npm run export:demo), e são deslocados para terminar no dia de ontem.
"""
import gzip
import json
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import text

from .db import SessionLocal
from .models import Budget, Campaign, Channel, FunnelDaily, MarketingMetric, User
from .security import hash_password

SEED = Path(__file__).resolve().parent.parent / "seed" / "demo.json.gz"
USERS = [("Administrador Demo", "admin@demo.com", "admin"), ("Analista de Marketing", "analista@demo.com", "analyst"), ("Diretoria (leitura)", "leitor@demo.com", "viewer")]


def main() -> None:
    data = json.loads(gzip.decompress(SEED.read_bytes()))
    last = max(date.fromisoformat(m["date"]) for m in data["metrics"])
    shift = (date.today() - timedelta(days=1)) - last
    d = lambda s: date.fromisoformat(s) + shift  # noqa: E731
    with SessionLocal() as db:
        db.execute(text("TRUNCATE funnel_daily, marketing_metrics, budgets, campaigns, marketing_channels RESTART IDENTITY CASCADE"))
        for name, email, role in USERS:
            if not db.execute(text("SELECT 1 FROM users WHERE email = :e"), {"e": email}).first():
                db.add(User(name=name, email=email, role=role, password_hash=hash_password("demo123")))
        db.add_all(Channel(id=c["id"], name=c["name"], kind=c["kind"], color=c["color"]) for c in data["channels"])
        db.flush()
        for c in data["campaigns"]:
            db.add(Campaign(id=c["id"], name=c["name"], channel_id=c["channelId"], platform=c["platform"], objective=c["objective"], conversion_type=c["conversionType"], status=c["status"], start_date=d(c["startDate"]), end_date=d(c["endDate"]) if c["endDate"] else None, owner=c["owner"], tags=[]))
        db.flush()
        months = sorted({d(m["date"]).replace(day=1) for m in data["metrics"]})
        for c in data["campaigns"]:
            for mo in months:
                db.add(Budget(campaign_id=c["id"], month=mo, planned=c["monthlyBudget"]))
        for m in data["metrics"]:
            day = d(m["date"])
            db.add(MarketingMetric(date=day, campaign_id=m["campaignId"], media_spend=m["mediaSpend"], other_cost=m["otherCost"], impressions=m["impressions"], clicks=m["clicks"], visitors=m["visitors"], source="demo"))
            db.add(FunnelDaily(date=day, campaign_id=m["campaignId"], leads=m["leads"], opportunities=m["opportunities"], customers=m["customers"], orders=m["orders"], revenue=m["revenue"]))
        db.commit()
    print(f"Seed concluído: {len(data['campaigns'])} campanhas, {len(data['metrics'])} linhas diárias (dados fictícios).")


if __name__ == "__main__":
    main()
