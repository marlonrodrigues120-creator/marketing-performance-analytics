"""Consultas analíticas em SQL sobre a view vw_campaign_daily."""
from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from .kpis import Totals, derive

DIMENSIONS = {"campaign": "campaign_id", "channel": "channel_id", "platform": "platform", "day": "date"}


def kpis(db: Session, start: date, end: date, margin: float, group_by: str | None = None, channels: list[str] | None = None, campaigns: list[str] | None = None) -> list[dict]:
    dim = DIMENSIONS.get(group_by or "", None)
    where = ["date BETWEEN :start AND :end"]
    params: dict = {"start": start, "end": end}
    if channels:
        where.append("channel_id = ANY(:channels)")
        params["channels"] = channels
    if campaigns:
        where.append("campaign_id = ANY(:campaigns)")
        params["campaigns"] = campaigns
    select_dim = f"{dim} AS key," if dim else "'total' AS key,"
    group = f"GROUP BY {dim} ORDER BY {dim}" if dim else ""
    sql = text(
        f"""
        SELECT {select_dim}
               SUM(media_spend) media_spend, SUM(other_cost) other_cost, SUM(impressions) impressions,
               SUM(clicks) clicks, SUM(paid_clicks) paid_clicks, SUM(visitors) visitors, SUM(leads) leads,
               SUM(opportunities) opportunities, SUM(customers) customers, SUM(orders) orders, SUM(revenue) revenue
        FROM vw_campaign_daily
        WHERE {' AND '.join(where)}
        {group}
        """
    )
    out = []
    for row in db.execute(sql, params).mappings():
        t = Totals(**{k: float(row[k] or 0) for k in Totals.__dataclass_fields__})
        out.append({"key": str(row["key"]), **derive(t, margin)})
    return out
