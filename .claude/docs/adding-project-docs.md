# Adding a Deep-Dive Docs Page to a Project

This guide explains how to wire a separate documentation repository as the
deep-dive page for any portfolio project.

## How it works

1. A separate GitHub repo (e.g. `CGEO-docs`) holds a `deep-dive.md` file with
   YAML frontmatter that defines the table of contents.
2. At startup, the backend downloads the repo as a tarball into `backend/docs/<slug>/`.
3. `GET /api/portfolio/<id>/deep-dive` reads `deep-dive.md`, strips the YAML
   frontmatter, rewrites relative image paths to `/api/docs/<slug>/assets/...`,
   and returns `{ success, content, toc }`.
4. The frontend renders the markdown on the project detail page and populates
   the left sidebar "On this page" TOC automatically from the `toc` field.
5. A GitHub webhook triggers a re-download whenever the docs repo is pushed to.

---

## Step-by-step

### 1. Create the docs repo

Create a new GitHub repo named `<ProjectName>-docs` (e.g. `MyProject-docs`).

The expected structure:

```
deep-dive.md          ← main content file (with YAML frontmatter)
assets/
  screenshots/        ← images referenced in deep-dive.md
README.md             ← optional
```

### 1a. Write the YAML frontmatter

`deep-dive.md` **must** start with a YAML frontmatter block that defines the
table of contents. The backend parses this and returns it as structured data —
no client-side markdown parsing is involved.

```markdown
---
toc:
  - id: overview
    label: Overview
  - id: architecture
    label: Architecture
    children:
      - id: backend
        label: Backend
      - id: frontend
        label: Frontend
  - id: getting-started
    label: Getting Started
---

# My Project Deep Dive

...content here...
```

**TOC field rules:**
- `id` — must match the `id` attribute on the corresponding heading. Use
  `rehype-slug` conventions: lowercase, spaces → hyphens (e.g. heading
  `## Getting Started` → id `getting-started`).
- `label` — display text shown in the sidebar.
- `children` — optional array of nested items (same shape, rendered indented).

Reference images using relative paths:

```markdown
![Alt text](assets/screenshots/my-image.png)
```

The backend rewrites these to absolute API URLs automatically.

---

### 2. Register the slug in the backend

Open `backend/scripts/setup_docs.py` and add an entry to the `DOCS` list:

```python
DOCS = [
    {
        'slug': 'cgeo',
        'repo': 'tomsabala/CGEO-docs',
        'branch': 'main',
    },
    {
        'slug': 'myproject',           # ← add this
        'repo': 'tomsabala/MyProject-docs',
        'branch': 'main',
    },
]
```

Then add the same slug to `REPO_MAP` in `backend/app/routes/docs_routes.py`:

```python
REPO_MAP = {
    'cgeo': 'tomsabala/CGEO-docs',
    'myproject': 'tomsabala/MyProject-docs',   # ← add this
}
```

The slug is derived from the repo name: `MyProject-docs` → `myproject`.
The webhook handler does this automatically, so the slug in `REPO_MAP` must
match what the webhook sends (`repoName.replace('-docs','').lower()`).

---

### 3. Set the docsSlug on the project

In the portfolio admin UI, open the project's edit modal and set the
**Docs Slug** field to the slug you chose (e.g. `myproject`). Save.

---

### 4. Configure the GitHub webhook on the docs repo

In the docs repo on GitHub: **Settings → Webhooks → Add webhook**

| Field | Value |
|---|---|
| Payload URL | `https://api.tom-sabala.dev/api/docs/webhook` |
| Content type | `application/json` |
| Secret | value of `DOCS_WEBHOOK_SECRET` env var on Railway |
| Events | Just the push event |

Every push to the docs repo will now trigger a re-download and the live site
will serve the updated content within seconds.

---

### 5. Ensure GITHUB_TOKEN has access

If the docs repo is **private**, the `GITHUB_TOKEN` env var on Railway must
belong to a GitHub account (or fine-grained PAT) that has at least **read
Contents** access to the new repo.

If the repo is **public**, no token changes are needed.

---

## API response shape

`GET /api/portfolio/<id>/deep-dive` returns:

```json
{
  "success": true,
  "content": "# My Project\n\n...",
  "toc": [
    { "id": "overview", "label": "Overview" },
    {
      "id": "architecture",
      "label": "Architecture",
      "children": [
        { "id": "backend", "label": "Backend" },
        { "id": "frontend", "label": "Frontend" }
      ]
    }
  ]
}
```

- `content` — markdown body with frontmatter stripped and image paths rewritten.
- `toc` — nested array parsed from the `toc` key in the frontmatter. The
  frontend passes this directly to `TocContext` and the sidebar renders it
  recursively without any client-side heading parsing.

---

## Naming convention

| Repo name | slug |
|---|---|
| `CGEO-docs` | `cgeo` |
| `MyProject-docs` | `myproject` |
| `Chess-Engine-docs` | `chess-engine-docs` (or rename to match) |

Keep slugs lowercase and hyphen-separated.
