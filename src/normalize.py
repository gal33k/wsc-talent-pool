"""Stage 4: title canonicalisation, seniority tier, employer tokenisation.

Every rule here reads from taxonomy.yaml / scoring.yaml. To teach the system a
new role family, synonym or generic-employer token, edit the YAML and re-run.
"""
from .config import scoring, taxonomy


def _lower(s) -> str:
    return (s or "").lower()


def classify_family(title: str) -> str:
    """First-match-wins over role_families in the declared order."""
    tax = taxonomy()
    t = _lower(title)
    for family_block in tax["role_families"]:
        for pattern in family_block["title_patterns"]:
            if pattern.lower() in t:
                return family_block["family"]
    return "unknown"


def title_tier(title: str) -> float:
    """Highest tier keyword hit wins. Default = engineer/mid (3)."""
    cfg = scoring()
    t = _lower(title)
    best = 3.0
    for keyword, tier in cfg["title_tiers"].items():
        if keyword in t and tier > best:
            best = float(tier)
    return best


def canonical_employer(name: str) -> str:
    """Alias-normalised employer name; unchanged if not in the alias map."""
    tax = taxonomy()
    n = name.strip()
    for canonical, aliases in (tax.get("company_aliases") or {}).items():
        for alias in aliases:
            if alias.lower() == n.lower():
                return canonical
    return n


def is_generic_employer(name: str) -> bool:
    tax = taxonomy()
    n = name.strip().lower()
    return any(g.strip().lower() == n for g in tax["generic_employer_stoplist"])


def normalise(rows: list[dict]) -> list[dict]:
    for r in rows:
        title = r.get("current_title") or r.get("title") or ""
        r["title_norm"] = _lower(title)
        r["role_family"] = classify_family(title)
        r["seniority_tier"] = title_tier(title)

        raw_employers: list[str] = []
        cc = r.get("current_company") or ""
        if cc:
            raw_employers.append(cc)
        raw_employers.extend(r.get("past_companies") or [])

        tokens: list[str] = []
        seen: set[str] = set()
        for e in raw_employers:
            if not e:
                continue
            # Filter stoplist on both raw name and canonical form
            if is_generic_employer(e):
                continue
            canon = canonical_employer(e)
            if is_generic_employer(canon):
                continue
            if canon in seen:
                continue
            seen.add(canon)
            tokens.append(canon)
        r["employer_tokens"] = tokens
    return rows
