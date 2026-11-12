"""Fórmulas oficiais — mesmas regras do frontend (src/lib/metrics.ts).

Divisões por zero retornam None (exibido como "—"); receita nunca é tratada como lucro.
"""
from dataclasses import dataclass


def safe_div(a: float, b: float) -> float | None:
    return a / b if b else None


@dataclass
class Totals:
    media_spend: float = 0
    other_cost: float = 0
    impressions: int = 0
    clicks: int = 0
    paid_clicks: int = 0
    visitors: int = 0
    leads: int = 0
    opportunities: int = 0
    customers: int = 0
    orders: int = 0
    revenue: float = 0

    @property
    def investment(self) -> float:
        return self.media_spend + self.other_cost


def derive(t: Totals, margin: float) -> dict[str, float | None]:
    gross_profit = t.revenue * margin
    roi = safe_div(gross_profit - t.investment, t.investment)
    ctr = safe_div(t.clicks, t.impressions)
    conv = safe_div(t.customers, t.clicks)
    return {
        "investment": t.investment,
        "media_spend": t.media_spend,
        "other_cost": t.other_cost,
        "revenue": t.revenue,
        "leads": t.leads,
        "customers": t.customers,
        "cac": safe_div(t.investment, t.customers),  # investimento total / novos clientes
        "cpl": safe_div(t.investment, t.leads),  # investimento total / leads
        "roas": safe_div(t.revenue, t.media_spend),  # receita atribuída / mídia
        "roi": None if roi is None else roi * 100,  # (lucro bruto - investimento) / investimento
        "ctr": None if ctr is None else ctr * 100,
        "cpc": safe_div(t.media_spend, t.paid_clicks) if t.media_spend else None,
        "conversion_rate": None if conv is None else conv * 100,
        "aov": safe_div(t.revenue, t.orders),
        "gross_profit": gross_profit,
        "estimated_profit": gross_profit - t.investment,
    }
