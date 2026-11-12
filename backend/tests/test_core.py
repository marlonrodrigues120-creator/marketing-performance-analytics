import time

import pytest

from app.security import sign
from app.services.importer import parse_number, validate
from app.services.kpis import Totals, derive, safe_div


def test_safe_div_handles_zero():
    assert safe_div(10, 0) is None
    assert safe_div(10, 4) == 2.5


def test_formulas_match_definitions():
    t = Totals(media_spend=1000, other_cost=200, impressions=100_000, clicks=2_000, paid_clicks=2_000, visitors=1_800, leads=100, customers=20, orders=22, revenue=6_000)
    k = derive(t, margin=0.5)
    assert k["cac"] == pytest.approx(1200 / 20)
    assert k["cpl"] == pytest.approx(1200 / 100)
    assert k["roas"] == pytest.approx(6000 / 1000)  # só mídia
    assert k["roi"] == pytest.approx((3000 - 1200) / 1200 * 100)  # lucro bruto, não receita
    assert k["ctr"] == pytest.approx(2.0)
    assert k["cpc"] == pytest.approx(0.5)
    assert k["conversion_rate"] == pytest.approx(1.0)
    assert k["aov"] == pytest.approx(6000 / 22)


def test_no_media_means_no_roas_or_cpc():
    k = derive(Totals(other_cost=300, clicks=500, customers=5, revenue=2000), margin=0.5)
    assert k["roas"] is None and k["cpc"] is None
    assert k["cac"] == pytest.approx(60)


def test_roas_above_one_can_still_lose_money():
    k = derive(Totals(media_spend=1000, other_cost=100, revenue=1500), margin=0.4)
    assert k["roas"] == pytest.approx(1.5)
    assert k["roi"] < 0


@pytest.mark.parametrize("raw,expected", [("1.234,56", 1234.56), ("1,234.56", 1234.56), ("6.120", 6120), ("712,40", 712.4), ("R$ 50", 50), ("", None)])
def test_parse_number(raw, expected):
    assert parse_number(raw) == expected


def test_validate_detects_errors_and_duplicates():
    csv = "data;campanha;investimento\n2026-11-01;A;100\n2026-11-01;A;100\n31/02/2026;B;10\n2026-11-02;C;-5\n2026-11-03;D;\n".encode()
    rep = validate(csv, {"date": "data", "campaign": "campanha", "media_spend": "investimento"})
    assert rep.total == 5
    assert rep.duplicates_in_file == 1
    assert len(rep.errors) == 2
    assert rep.missing_values == 1
    assert len(rep.valid) == 2


def test_hmac_signature_is_deterministic_and_secret_bound():
    ts = str(int(time.time()))
    assert sign(b"{}", ts, "s1") == sign(b"{}", ts, "s1")
    assert sign(b"{}", ts, "s1") != sign(b"{}", ts, "s2")
