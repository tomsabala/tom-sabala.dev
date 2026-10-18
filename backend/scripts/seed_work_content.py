"""
Seed the five redesign projects with their detail-page content.

Idempotent: matches an existing row by slug first, then by TITLE_ALIASES (so
rows created before the redesign are adopted rather than duplicated), and only
inserts when neither matches. Re-running updates in place — never duplicates.

Content is transcribed verbatim from the design prototypes:
  Project Detail.dc.html  → lede, facts, about, tags, steps, rulesTitle, rules, code
  Portfolio Home.dc.html  → field, desc, tags, access (→ accessLabel), glyph (→ specimen)

Projects already in the database that are not in this set keep their visibility
and are pushed to display_order 6+; every new field is optional at render time,
so they degrade to hero + what they have.

Usage (from backend/ directory, with venv active):
    python scripts/seed_work_content.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import Project

# Pre-redesign titles that are the same project under a different name.
TITLE_ALIASES = {
    'CGEO - Computational Geometry Library': 'cgeo',
    'MLMP - Multi-Level Motion Planning': 'mlmp',
    'Chess Engine': 'chess',
}

PROJECTS = [
    {
        'slug': 'mlmp',
        'title': 'MLMP',
        'field': 'Motion planning',
        'specimen': 'chain',
        'accessLabel': 'public repo',
        'githubUrl': 'https://github.com/tomsabala/MLMP',
        'description': 'A new extension to the Multi-Level Motion Planner family, built on OMPL and the fiber-bundle formulation. Includes a framework to race QRRT, QRRT*, QMP, QMP* and BiQRRT on 2D kinematic-chain robots across custom scenes.',
        'lede': 'A new extension to the Multi-Level Motion Planner family, built on OMPL, plus a framework that races planners against each other on 2D kinematic-chain robots.',
        'technologies': ['C++', 'OMPL', 'Python', 'Docker'],
        'facts': [
            {'k': 'Planners', 'v': '7'},
            {'k': 'Robots', 'v': '2D chains'},
            {'k': 'Default', 'v': 'BiQRRT'},
            {'k': 'Repo', 'v': 'Public'},
        ],
        'aboutParagraphs': [
            'Based on the article “Multilevel motion planning: A fiber bundle formulation” by Andreas Orthey, Sohaib Akbar and Marc Toussaint. Multi-level planners solve a simplified version of the robot first, then use that solution to guide the search in the full configuration space.',
            'The project adds a new algorithm to that family and a harness to compare it with QRRT, QRRT*, QMP and QMP* across a set of custom scenes and time limits.',
        ],
        'steps': [
            {'t': 'Describe a scene', 'd': 'Scenes are JSON input files. The repo ships several custom ones for 2D kinematic-chain robots.'},
            {'t': 'Pick a planner', 'd': 'RRT*, PRM*, QRRT, BiQRRT, QMP or QMP*, chosen with --algo and bounded by --time-limit.'},
            {'t': 'Run the experiment', 'd': 'A Python tool sweeps algorithms across scenes and time limits and collects performance metrics.'},
            {'t': 'Pin the toolchain', 'd': 'Everything builds inside a Docker image, so OMPL versions stay aligned.'},
        ],
        'rulesTitle': 'PLANNERS IN THE RING',
        'rules': [
            'RRT* · single-level baseline',
            'PRM* · roadmap baseline',
            'QRRT / QRRT* · multi-level trees',
            'QMP / QMP* · multi-level roadmaps',
            'BiQRRT · the new contender',
        ],
        'runCode': './build_image.sh && ./run_container.sh && ./shell_container.sh\ncd ~/../home/mlmp/mlmp && ./compile\n\n./mlmp --input-file ./inputs/experiment/scene4.json \\\n       --time-limit 5 --verbose 1 --algo BiQRRT',
    },
    {
        'slug': 'cgeo',
        'title': 'CGEO',
        'field': 'Computational geometry',
        'specimen': 'hull',
        'accessLabel': 'public repo',
        'githubUrl': 'https://github.com/tomsabala/CGEO',
        'description': 'A computational geometry algorithms and application toolkit. Written in C++ and wrapped with PyBind11 for use in Python.',
        'lede': 'A computational geometry algorithms and application toolkit. Written in C++ and wrapped with PyBind11 for use in Python.',
        'technologies': ['C++', 'PyBind11', 'Python'],
        'facts': [
            {'k': 'Core', 'v': 'C++'},
            {'k': 'Binding', 'v': 'pybind11'},
            {'k': 'License', 'v': 'GPL-3.0'},
            {'k': 'Status', 'v': 'Ongoing'},
        ],
        'aboutParagraphs': [
            'A collection of performance-oriented algorithms and data structures from computational geometry, built for quick use from any Python program.',
            'Everything is implemented in C++ and exposed as a Python extension, with runnable examples for each class and algorithm.',
        ],
        'steps': [
            {'t': 'Shapes first', 'd': '2D primitives: Point, Line, Segment and Polygon.'},
            {'t': 'Algorithms on top', 'd': 'Convex hull, segment intersection, polygon triangulation and smallest enclosing disc.'},
            {'t': 'Structures underneath', 'd': 'A balanced binary segment tree supports the sweep-based algorithms.'},
            {'t': 'Use it from Python', 'd': 'Build with run.sh, then import libGeo_2D like any module.'},
        ],
        'rulesTitle': 'IN THE TOOLKIT',
        'rules': [
            'Convex hull · gift-wrapping (Jarvis march)',
            'Convex hull · Graham scan',
            'Convex hull · divide & conquer',
            'Segment intersection',
            'Polygon triangulation',
            'Smallest enclosing disc',
        ],
        'runCode': 'git submodule add https://github.com/tomsabala/CGEO\ncd CGEO && git submodule update --init && ./run.sh\n\n# in your program\nfrom CGEO.build import libGeo_2D',
    },
    {
        'slug': 'nomic',
        'title': 'nomic',
        'field': 'Autonomous agents',
        'specimen': 'equity',
        'accessLabel': 'private · case study',
        'githubUrl': '',
        'description': 'A platform for hosting AI agents that run paper-trading experiments under deterministic risk controls. No LLM sits in the enforcement path, and every decision leaves a readable trace.',
        'lede': 'A platform for hosting AI agents that run trading experiments under restricted rules. Configure an agent, launch it as a scheduled paper-trading run, and read a complete trace of every decision it made and why.',
        'technologies': ['Rust', 'axum', 'tokio', 'Next.js', 'Postgres 16'],
        'facts': [
            {'k': 'Engine', 'v': 'Rust'},
            {'k': 'Web', 'v': 'Next.js 16'},
            {'k': 'Universe', 'v': '533 symbols'},
            {'k': 'Money', 'v': 'Paper only'},
        ],
        'aboutParagraphs': [
            'The product is the deterministic guardrail layer between an agent and a market. No LLM sits anywhere in the enforcement path, so even a fully prompt-injected agent can only propose market orders inside the approved universe, position caps, trade limits and budget.',
            'Every run is reported against two buy-and-hold baskets, SPY and equal-weight of the universe, and can be shared as a read-only trace.',
        ],
        'steps': [
            {'t': 'api', 'd': 'HTTP, JWT-verified against Supabase JWKS, every route workspace-scoped.'},
            {'t': 'worker', 'd': 'A tokio scheduler that claims due ticks and runs the decision pipeline; a second loop drains the notification outbox.'},
            {'t': 'risk', 'd': 'Pure rule evaluation, auto-stops and budget projection. Every figure is computed in checked Decimal arithmetic.'},
            {'t': 'Postgres', 'd': 'Scheduling is DB-driven. Mutual exclusion per experiment is a transaction-scoped advisory lock.'},
        ],
        'rulesTitle': 'HARD RULES',
        'rules': [
            'No LLM in the enforcement path',
            'Paper trading only. The platform never holds funds',
            'A human is a veto or a proposer, never a grant',
            'Sealed runs never change configuration, enforced by a trigger',
            'Every intervention is an append-only event',
            'Provider keys are bring-your-own, sealed with AES-256-GCM',
        ],
        'runCode': '',
    },
    {
        'slug': 'nudge',
        'title': 'nudge',
        'field': 'Agent memory',
        'specimen': 'graph',
        'accessLabel': 'private · case study',
        'githubUrl': '',
        'description': 'A persistent personal memory model plus a reasoning agent. Facts are subject/predicate/object triples with confidence and provenance, and nothing is remembered without a human confirming it.',
        'lede': 'A persistent personal memory model plus a reasoning agent. The memory is built properly: explicit facts with confidence and real provenance, never prompt-stuffing.',
        'technologies': ['Rust', 'TypeScript', 'Fastify', 'Postgres', 'pgvector'],
        'facts': [
            {'k': 'Agent', 'v': 'Rust · axum'},
            {'k': 'Platform', 'v': 'Fastify 5'},
            {'k': 'Store', 'v': 'pgvector'},
            {'k': 'Deploy', 'v': 'Local-only'},
        ],
        'aboutParagraphs': [
            'Facts are subject/predicate/object triples with a natural-language statement, a category, a confidence, and a link back to the exact excerpt that produced them.',
            'Repeats reinforce an existing fact instead of duplicating it. Contradictions supersede it and keep the chain readable. Nothing enters durable memory without an explicit human confirmation.',
        ],
        'steps': [
            {'t': 'agent-core', 'd': 'The reasoning loop: provider calls, fact extraction, dedup and contradiction classification, retrieval. Sole writer to facts.'},
            {'t': 'web-platform', 'd': 'The external API, the auth boundary, and the inspection and correction UI.'},
            {'t': 'Postgres + pgvector', 'd': 'One database for structured facts and semantic search, because provenance and correction are natively relational.'},
            {'t': 'Separate credentials', 'd': 'Session cookie for the browser, bearer tokens for unattended callers, an internal token between services.'},
        ],
        'rulesTitle': 'HARD CONSTRAINTS',
        'rules': [
            'Confirm before persist',
            'Forget is a soft-delete. No runtime role holds DELETE',
            'No external actions: no email, calendar, or sending',
            'Provider-agnostic: chat and embeddings are separate slots',
            'Memory quality is core: dedup and supersede, not a later cleanup',
        ],
        'runCode': '',
    },
    {
        'slug': 'chess',
        'title': 'ChessEngine',
        'field': 'Search',
        'specimen': 'board',
        'accessLabel': 'public repo',
        'githubUrl': 'https://github.com/tomsabala/ChessEngine',
        'description': 'A simple chess engine program.',
        'lede': 'A self-study challenge: a playable chess engine in Python, with opponent levels from a random mover up to four moves of look-ahead.',
        'technologies': ['Python', 'NumPy', 'Pygame', 'Game-tree search'],
        'facts': [
            {'k': 'Language', 'v': 'Python'},
            {'k': 'Libraries', 'v': 'NumPy · Pygame'},
            {'k': 'Levels', 'v': '0 – 4'},
            {'k': 'Repo', 'v': 'Public'},
        ],
        'aboutParagraphs': [
            'Started after running into chess programming from several directions, and built with the help of two step-by-step guides and the chess programming wiki.',
            'You play one-on-one against the engine and choose its rank. Level 0 plays random moves; each level above computes one more step ahead.',
        ],
        'steps': [
            {'t': 'Generate moves', 'd': 'Every legal move from the current position becomes a branch.'},
            {'t': 'Look ahead', 'd': 'The engine searches as many plies deep as the chosen level allows.'},
            {'t': 'Evaluate', 'd': 'Leaf positions are scored and the best line propagates back up the tree.'},
            {'t': 'Play', 'd': 'Pygame renders the board and takes your moves.'},
        ],
        'rulesTitle': 'NEXT ON THE BOARD',
        'rules': [
            'Keep thinking between turns',
            'A more efficient search',
            'Strategy terms in position evaluation',
            'Animation and a more detailed interface',
        ],
        'runCode': 'python3 -m pip install -U pygame numpy --user\nexport PYTHONPATH=.\npython3 Chess/ChessGame.py',
    },
]

SEEDED_SLUGS = [p['slug'] for p in PROJECTS]


def findExisting(session, payload):
    """Slug first, then the pre-redesign title alias. Never guesses."""
    project = session.query(Project).filter_by(slug=payload['slug']).first()
    if project:
        return project, 'slug'
    aliasTitles = [t for t, s in TITLE_ALIASES.items() if s == payload['slug']]
    if aliasTitles:
        project = session.query(Project).filter(Project.title.in_(aliasTitles)).first()
        if project:
            return project, 'title alias'
    return None, None


def applyPayload(project, payload, displayOrder):
    project.slug = payload['slug']
    project.title = payload['title']
    project.description = payload['description']
    project.technologies = payload['technologies']
    project.githubUrl = payload['githubUrl'] or None
    project.field = payload['field']
    project.lede = payload['lede']
    project.facts = payload['facts']
    project.aboutParagraphs = payload['aboutParagraphs']
    project.steps = payload['steps']
    project.rulesTitle = payload['rulesTitle']
    project.rules = payload['rules']
    project.runCode = payload['runCode']
    project.specimen = payload['specimen']
    project.accessLabel = payload['accessLabel']
    project.displayOrder = displayOrder


def reorderRemainder(session):
    """Pre-existing projects keep their relative order, starting at 6."""
    others = session.query(Project) \
        .filter(~Project.slug.in_(SEEDED_SLUGS)) \
        .order_by(Project.displayOrder.asc(), Project.id.asc()) \
        .all()
    for offset, project in enumerate(others):
        project.displayOrder = len(PROJECTS) + 1 + offset
    return len(others)


def main():
    app = create_app()
    with app.app_context():
        inserted = updated = 0
        for index, payload in enumerate(PROJECTS):
            project, matchedBy = findExisting(db.session, payload)
            if project:
                applyPayload(project, payload, index + 1)
                updated += 1
                print(f"  update  {payload['slug']:<8} (matched by {matchedBy}, id={project.id})")
            else:
                project = Project(isVisible=True, isInProgress=False)
                applyPayload(project, payload, index + 1)
                db.session.add(project)
                inserted += 1
                print(f"  insert  {payload['slug']:<8}")
        db.session.flush()
        moved = reorderRemainder(db.session)
        db.session.commit()
        print(f"\n{inserted} inserted, {updated} updated, {moved} pre-existing project(s) moved to display_order {len(PROJECTS) + 1}+")


if __name__ == '__main__':
    main()
