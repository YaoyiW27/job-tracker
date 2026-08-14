#!/usr/bin/env python3
"""
find_jobs.py  —  Phase 0 of the job-search tool ("Discover" stage)

Pulls new-grad postings from the community-maintained SimplifyJobs/New-Grad-Positions
dataset, tags each posting by how well its location fits your criteria
(Vancouver > Canada-remote > generic-remote > rest-of-Canada > US > other),
sorts them, and writes a CSV you can drag straight into Google Sheets.

Design goals for this first version:
  - No third-party packages. Just `python3 find_jobs.py`.
  - Don't over-filter. You're mass-applying, so we RANK, not exclude — every job
    stays in the CSV, tagged with a bucket + flags so you decide.
  - Schema-tolerant: the dataset occasionally adds/renames fields, so we read
    defensively and print the real field names of the first record on each run.
    (Send me that printout and I'll wire the sponsorship + culture-score filters.)

Next phases (not in this file yet):
  Phase 1 — LLM "fit scorer" that reads each JD and scores it against YOUR
            preferences (AI-forward builder culture, avoid ticket/maintenance roles).
  Phase 2 — shared SQLite store + Gmail-scan status tracking.
"""

import csv
import json
import sys
import urllib.request
from datetime import datetime, timezone

# ─────────────────────────── config (edit these) ───────────────────────────

# 数据源:Simplify 新毕业生岗位仓库里的 listings.json(每天多次自动更新)
# 如果这个 URL 404 了,去仓库里确认 listings.json 的真实路径再改这里。
RAW_URL = (
    "https://raw.githubusercontent.com/SimplifyJobs/"
    "New-Grad-Positions/dev/.github/scripts/listings.json"
)

OUTPUT = "new_grad_jobs.csv"

# 只看还在开放的岗位。想连已关闭的一起导出就把这个设 False。
ONLY_ACTIVE = True

# 大厂:就算在加拿大其它城市 / 美国本土,也值得为它 relocate。用来把它们往上顶。
TOP_TIER = {
    "google", "alphabet", "meta", "facebook", "amazon", "aws", "apple",
    "microsoft", "netflix", "nvidia", "openai", "anthropic", "stripe",
    "databricks", "snowflake", "uber", "airbnb", "coinbase", "figma",
}

# 温哥华都会区关键词(命中即最高优先级)
VANCOUVER_KEYS = {
    "vancouver", "burnaby", "richmond", "surrey", "coquitlam",
    "north vancouver", "west vancouver", "new westminster",
    "british columbia", ", bc", " bc,", " bc ",
}

# 加拿大信号:省份缩写 + "canada" + 主要城市
CANADA_KEYS = {
    "canada", "ontario", "quebec", "alberta", "manitoba", "saskatchewan",
    "nova scotia", "new brunswick", "newfoundland", "prince edward",
    "toronto", "ottawa", "montreal", "montréal", "calgary", "edmonton",
    "winnipeg", "waterloo", "kitchener", "mississauga", "halifax",
    ", on", ", qc", ", ab", ", mb", ", sk", ", ns", ", nb", ", pe", ", nl",
    ", bc",  # BC also counts as Canada (Vancouver check runs first anyway)
}

# ─────────────────────────── location bucketing ────────────────────────────

# 优先级:数字越小越靠前
BUCKET_RANK = {
    "vancouver": 0,       # 本地,最想要
    "canada_remote": 1,   # 加拿大 remote
    "remote_generic": 2,  # 没写国家的 remote(可能可加拿大,人工确认一下)
    "canada_other": 3,    # 加拿大其它城市(通常要 relocate — 除非大厂)
    "us": 4,              # 美国本土(只有大厂才考虑 relocate)
    "other": 5,           # 其它国家
}


def _has(text, keys):
    return any(k in text for k in keys)


def classify_location(locations):
    """Return (bucket, relocation_needed) for a list of location strings."""
    joined = " | ".join(locations).lower()
    is_remote = "remote" in joined

    if _has(joined, VANCOUVER_KEYS):
        return "vancouver", False
    if is_remote and _has(joined, CANADA_KEYS):
        return "canada_remote", False
    if _has(joined, CANADA_KEYS):
        return "canada_other", True
    if is_remote:
        # generic "Remote" with no country — worth checking manually
        return "remote_generic", False
    # crude US detection: 2-letter state-ish or common US markers
    if _has(joined, {", usa", "united states", ", ca", ", ny", ", wa", ", tx",
                     ", ma", ", il", ", wa,", "seattle", "san francisco",
                     "new york", "bellevue", "kirkland", "sunnyvale"}):
        return "us", True
    return "other", True


# ─────────────────────────── field helpers ─────────────────────────────────

def first_present(record, *names, default=""):
    """Return the first field that exists and is non-empty (schema-tolerant)."""
    for n in names:
        if n in record and record[n] not in (None, "", []):
            return record[n]
    return default


def sponsorship_note(record):
    """Best-effort read of any sponsorship/citizenship signal, if present."""
    for key in record:
        lk = key.lower()
        if "sponsor" in lk or "citizen" in lk:
            val = record[key]
            if isinstance(val, bool):
                return f"{key}={val}"
            if val:
                return str(val)
    return ""


def age_days(ts):
    try:
        posted = datetime.fromtimestamp(int(ts), tz=timezone.utc)
        return (datetime.now(timezone.utc) - posted).days
    except (ValueError, TypeError, OSError):
        return ""


# ─────────────────────────── main ──────────────────────────────────────────

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "find-jobs/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    try:
        data = fetch(RAW_URL)
    except Exception as e:  # noqa: BLE001 — first-run friendliness beats precision
        print(f"[!] Could not fetch {RAW_URL}\n    {e}")
        print("    If it's a 404, open the repo and check the real path to "
              "listings.json, then update RAW_URL.")
        sys.exit(1)

    # The file is a list of records. Handle the off chance it's wrapped in a dict.
    records = data if isinstance(data, list) else data.get("listings", [])
    if not records:
        print("[!] No records found — the JSON shape may have changed.")
        sys.exit(1)

    # Show the real schema once so we can wire the next filters correctly.
    print(f"[i] Pulled {len(records)} records.")
    print(f"[i] Fields on first record: {sorted(records[0].keys())}\n")

    rows = []
    for r in records:
        if ONLY_ACTIVE and r.get("active") is False:
            continue
        if r.get("is_visible") is False:
            continue

        locations = first_present(r, "locations", default=[])
        if isinstance(locations, str):
            locations = [locations]
        bucket, relocate = classify_location(locations)
        company = str(first_present(r, "company_name", "company"))
        top = company.lower() in TOP_TIER

        rows.append({
            "bucket": bucket,
            "relocate": "yes" if relocate else "",
            "top_tier": "★" if top else "",
            "company": company,
            "title": str(first_present(r, "title", "role")),
            "location": " | ".join(locations),
            "age_days": age_days(first_present(r, "date_posted", "date_updated")),
            "sponsorship": sponsorship_note(r),
            "url": str(first_present(r, "url", "company_url")),
        })

    # Sort: location bucket first, but a top-tier company jumps one bucket up
    # (worth relocating for). Then newest first.
    def sort_key(row):
        rank = BUCKET_RANK.get(row["bucket"], 9)
        if row["top_tier"] and rank >= 3:
            rank -= 1
        age = row["age_days"] if isinstance(row["age_days"], int) else 9999
        return (rank, age)

    rows.sort(key=sort_key)

    fields = ["bucket", "relocate", "top_tier", "company", "title",
              "location", "age_days", "sponsorship", "url"]
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    # Quick summary to the terminal
    counts = {}
    for row in rows:
        counts[row["bucket"]] = counts.get(row["bucket"], 0) + 1
    print(f"[✓] Wrote {len(rows)} jobs to {OUTPUT}")
    for b in BUCKET_RANK:
        if b in counts:
            print(f"      {b:<15} {counts[b]}")


if __name__ == "__main__":
    main()
