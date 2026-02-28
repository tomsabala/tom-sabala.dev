# Adding a Deep-Dive Docs Page to a Project

This guide explains how to wire a separate documentation repository as the
deep-dive page for any portfolio project.

## How it works

1. A separate GitHub repo (e.g. `CGEO-docs`) holds a `deep-dive.md` file.
2. At startup, the backend downloads the repo as a tarball into `backend/docs/<slug>/`.
3. `GET /api/portfolio/<id>/deep-dive` reads `deep-dive.md`, rewrites relative
   image paths to `/api/docs/<slug>/assets/...`, and returns the markdown.
4. The frontend renders it on the project detail page instead of `project.content`.
5. A GitHub webhook triggers a re-download whenever the docs repo is pushed to.

---

## Step-by-step

### 1. Create the docs repo

Create a new GitHub repo named `<ProjectName>-docs` (e.g. `MyProject-docs`).

The expected structure:

```
deep-dive.md          ← main content file
assets/
  screenshots/        ← images referenced in deep-dive.md
README.md             ← optional
```

Reference images in `deep-dive.md` using relative paths:

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

## Naming convention

| Repo name | slug |
|---|---|
| `CGEO-docs` | `cgeo` |
| `MyProject-docs` | `myproject` |
| `Chess-Engine-docs` | `chess-engine-docs` (or rename to match) |

Keep slugs lowercase and hyphen-separated.
