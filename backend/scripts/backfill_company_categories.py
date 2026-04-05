"""
One-time migration script: backfill AI-generated categories for all companies
that currently have no categories (NULL or empty list).

This script makes a SINGLE Anthropic API call covering all uncategorized companies,
which is cost-efficient compared to per-company calls.

It is safe to re-run: companies that already have categories are skipped automatically.

Usage (from backend/ directory, with venv active):
    python scripts/backfill_company_categories.py [--dry-run]

Options:
    --dry-run   Show what categories would be assigned without saving to the database.
"""

import sys
import os
import json
import re
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import Company
from app.dao.company_dao import _normalizeCategories


def buildPrompt(companies):
    lines = []
    for c in companies:
        line = f"{c.id}. {c.name}"
        if c.url:
            line += f" ({c.url})"
        if c.notes:
            line += f" — {c.notes}"
        lines.append(line)
    companies_text = "\n".join(lines)

    return (
        "You are a job tracker assistant classifying companies for a software engineer's job search.\n"
        "For each company below, provide exactly 2-3 concise lowercase tags that best describe "
        "their core industry or technology domain.\n"
        "Rules:\n"
        "- Be specific (e.g. 'robotics', 'fintech', 'autonomous-vehicles', 'defense', 'saas', 'biotech', 'cloud-infrastructure')\n"
        "- Do NOT use generic tags: 'technology', 'software', 'company', 'startup', 'tech'\n"
        "- Use single words or hyphenated phrases only\n"
        "- Return ONLY a raw JSON object mapping the company ID (as string key) to its array of tags\n"
        "- No explanation, no markdown, no code fences\n\n"
        f"Companies:\n{companies_text}"
    )


def parseResponse(raw, expectedIds):
    """Parse Anthropic response into {company_id: [tags]} dict."""
    # Strip markdown fences if present
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object, got {type(data)}")

    result = {}
    for key, tags in data.items():
        try:
            cid = int(key)
        except (ValueError, TypeError):
            continue
        if cid not in expectedIds:
            print(f"  Warning: unexpected company ID {cid} in response, skipping")
            continue
        normalized = _normalizeCategories(tags if isinstance(tags, list) else [])
        result[cid] = normalized

    return result


def run(dryRun=False):
    app = create_app()

    with app.app_context():
        apiKey = os.getenv('ANTHROPIC_API_KEY')
        if not apiKey:
            print("ERROR: ANTHROPIC_API_KEY is not set. Aborting.")
            sys.exit(1)

        # Find companies with no categories
        allCompanies = db.session.query(Company).order_by(Company.id.asc()).all()
        uncategorized = [
            c for c in allCompanies
            if not c.categories  # covers None, [], and null
        ]

        if not uncategorized:
            print(f"All {len(allCompanies)} companies already have categories. Nothing to do.")
            return

        print(f"Found {len(uncategorized)} companies without categories (out of {len(allCompanies)} total):")
        for c in uncategorized:
            print(f"  [{c.id}] {c.name}")

        print(f"\nSending {len(uncategorized)} companies to Anthropic in a single API call...")

        import anthropic
        client = anthropic.Anthropic(api_key=apiKey)

        prompt = buildPrompt(uncategorized)
        expectedIds = {c.id for c in uncategorized}

        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            temperature=0,
            system=(
                "You are a precise JSON-only API. You output nothing except valid JSON. "
                "No explanations, no markdown, no code fences."
            ),
            messages=[
                {"role": "user", "content": prompt},
                {"role": "assistant", "content": "{"},
            ],
        )

        raw = "{" + message.content[0].text.strip()
        print(f"\nRaw API response:\n{raw}\n")

        try:
            categoryMap = parseResponse(raw, expectedIds)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"ERROR: Failed to parse API response: {e}")
            print("Run with --dry-run to inspect the response without saving.")
            sys.exit(1)

        # Report results
        print("Parsed categories:")
        for c in uncategorized:
            tags = categoryMap.get(c.id, [])
            status = "(not in response — will be skipped)" if c.id not in categoryMap else ""
            print(f"  [{c.id}] {c.name}: {tags} {status}")

        missingIds = expectedIds - set(categoryMap.keys())
        if missingIds:
            missingNames = [c.name for c in uncategorized if c.id in missingIds]
            print(f"\nWarning: {len(missingIds)} companies missing from API response: {missingNames}")
            print("These will retain empty categories. You can re-run to retry them.")

        if dryRun:
            print("\n[DRY RUN] No changes saved.")
            return

        # Save to DB
        updated = 0
        for c in uncategorized:
            if c.id in categoryMap and categoryMap[c.id]:
                c.categories = categoryMap[c.id]
                updated += 1

        db.session.commit()
        print(f"\nDone. Updated {updated}/{len(uncategorized)} companies.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Backfill AI categories for companies with none.')
    parser.add_argument('--dry-run', action='store_true', help='Show results without saving')
    args = parser.parse_args()
    run(dryRun=args.dry_run)
