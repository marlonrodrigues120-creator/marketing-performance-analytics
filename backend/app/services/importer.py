"""Validação de CSV com pandas: mapeamento, tipos, negativos, duplicidades e ausentes."""
import io
import re
from dataclasses import dataclass, field

import pandas as pd

NUMERIC = ["media_spend", "other_cost", "impressions", "clicks", "visitors", "leads", "opportunities", "customers", "orders", "revenue"]
REQUIRED = ["date", "campaign"]


@dataclass
class ValidationReport:
    total: int
    valid: pd.DataFrame
    errors: list[dict] = field(default_factory=list)
    duplicates_in_file: int = 0
    missing_values: int = 0


def parse_number(v) -> float | None:
    """Aceita formatos brasileiro (1.234,56) e internacional (1,234.56)."""
    if v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip() == "":
        return None
    s = re.sub(r"[R$\s%]", "", str(v).strip())
    dot, comma = s.rfind("."), s.rfind(",")
    if dot >= 0 and comma >= 0:
        s = s.replace(".", "").replace(",", ".") if comma > dot else s.replace(",", "")
    elif comma >= 0:
        s = s.replace(",", "") if re.fullmatch(r"-?\d{1,3}(,\d{3})+", s) else s.replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return float("nan")


def validate(raw: bytes, mapping: dict[str, str], missing: str = "zero") -> ValidationReport:
    df = pd.read_csv(io.BytesIO(raw), sep=None, engine="python", dtype=str, encoding="utf-8-sig")
    rep = ValidationReport(total=len(df), valid=pd.DataFrame())
    out = pd.DataFrame(index=df.index)
    for target, source in mapping.items():
        out[target] = df[source].astype(object) if source in df.columns else None
    for col in REQUIRED:
        if col not in out:
            raise ValueError(f"Campo obrigatório não mapeado: {col}")
    out["date"] = pd.to_datetime(out["date"], errors="coerce", dayfirst=True, format="mixed").dt.date
    bad = pd.Series(False, index=out.index)
    for i, row in out.iterrows():
        errs = []
        if pd.isna(row["date"]):
            errs.append("data inválida")
        if not str(row.get("campaign") or "").strip():
            errs.append("campanha ausente")
        for c in NUMERIC:
            if c not in out:
                continue
            v = parse_number(row[c])
            if v is None:
                rep.missing_values += 1
                if missing == "skip":
                    errs.append(f"{c} ausente")
                v = 0.0
            elif v != v:  # NaN
                errs.append(f"{c} não numérico")
            elif v < 0:
                errs.append(f"{c} negativo")
            out.at[i, c] = v
        if errs:
            bad[i] = True
            rep.errors.append({"line": int(i) + 2, "errors": errs})
    valid = out[~bad].copy()
    dup = valid.duplicated(subset=["date", "campaign"], keep="first")
    rep.duplicates_in_file = int(dup.sum())
    rep.valid = valid[~dup]
    return rep
