# Society knowledge: add a file, review, merge

This folder is the editable source for the public knowledge MCP. The build combines it with the approved portal/tutorial archive in `services/knowledge/data/bootstrap-corpus.json`. Changes merged to `main` are built and deployed automatically **once the Cloudflare Free deployment secrets and variables below are configured**. Pull requests validate and preview the build without deploying.

## Add material

Add a Markdown file anywhere below this folder, for example:

```text
knowledge/
  tutorials/intro-to-python.md
  nexus/evaluation-session.md
  faqs/getting-involved.md
  guides/your-guide.md
```

Nested folders work too. A heading and normal Markdown are sufficient. By merging material here, maintainers approve its publication and confirm that its attribution, facts and redistribution permissions have been reviewed.

Optional flat front matter adds useful metadata:

```markdown
---
title: Evaluating an AI system
type: nexus-session
topics: [evaluation, ai-safety]
year: 2026/27
date: 2026-10-29
archived: true
attribution: UCL AI Society
---

# Evaluating an AI system

Write the session notes, exercises and source links here.

## Exercise

Keep exercises, hints and solutions under separate headings.
```

Front matter supports `id`, `title`, `type`, `topics`, `year`, `date`, `archived`, `status`, `source`, `attribution`, `license`, `start`, `end` and `expiresAt`. It intentionally accepts only flat values and a comma-separated topic list. Dates use `YYYY-MM-DD`; event timestamps use UTC ISO format such as `2026-11-03T18:00:00Z`. No YAML objects, tags, aliases or executable MDX are evaluated.

- **Tutorials and Nexus notes default to archived learning material**, so a session write-up does not become an upcoming event. Live events still come from Luma. Explicit `start`/`end` timestamps can describe an upcoming session; it expires at its end (or start if no end is supplied).
- `status: draft` and `status: review-required` exclude a file from the MCP build. **They do not make a file private in GitHub.** Confidential drafts belong in a private repository, and credentials/student personal data must never be committed here.
- `source` is an optional HTTPS citation. Otherwise the build cites the exact GitHub file and commit.
- `id` is optional. Generated IDs follow `knowledge:tutorials/intro-to-python.md`. A deliberate `id` matching an archive document overrides that document through the reviewed GitHub change. Removing an override restores the archive body; use withdrawal for removal.
- Put materials in the folder that describes them. Any new subfolder is supported; `type` can name a more specific material category.

Notebook (`.ipynb`), PDF (`.pdf`) and Python teaching (`.py`) files are also supported. Put optional metadata in a JSON file with the same basename, e.g. `session.ipynb` plus `session.meta.json`. The JSON keys match the Markdown fields. Notebook outputs are discarded; notebook/Python code is never run. PDF text has page locators; image-only slides need an authorised text export or the separate local OCR importer. External URLs are retained as links, never crawled or represented as imported bodies automatically.

`_templates/`, hidden files and `README.md` files are excluded from retrieval. Other unsupported formats appear as build warnings.

## Publish and update

1. Add or edit files, preferably through a pull request. Your assistant can prepare the change through your existing authenticated GitHub tools.
2. Review the content and checks, then merge to `main`. Pushes to `main` have the same publication effect, so configure branch protection to require review and passing knowledge checks.
3. The knowledge workflow builds the release and deploys the one read-only Worker. A member query cannot trigger a build, write to GitHub or publish anything.

The archive stays pinned until a maintainer runs the existing importer and reviews its updated bootstrap. Adding files here does not silently refresh the five external tutorial repositories or override curated files.

To remove a folder-only document, remove its file. For an urgent withdrawal or an archive document, add its document ID to `withdrawn.json`; the new build removes its body and learning-path references, and also denies listed live Luma IDs. The MCP serves only its current bundled release. A request pinned to a retired version fails rather than returning content from a different release. Git history and material already downloaded by others retain earlier copies; deletion is not erasure. Rollback must retain the current withdrawal list.

Curated paths can be added in `learning-paths.json`, using the existing schema: `id`, `title`, `description`, `prerequisites` and ordered `steps` containing `documentId` and optional `note`. Unknown document IDs fail validation.

## Check locally

From `services/knowledge`:

```sh
pnpm knowledge:build
pnpm typecheck
pnpm test
pnpm build:bundled
```

The generated `.generated/build-report.json` lists counts, the release ID, excluded drafts and unsupported-file warnings. Generated output is ignored by Git. Known credential formats, unsafe paths/symlinks, malformed metadata, invalid references and oversized bundles fail the build. These checks supplement content review; they cannot identify every possible secret or private fact.

## One-time deployment setup

Use a Cloudflare account on **Workers Free**, with no paid add-ons. The GitHub environment `knowledge-staging` needs:

- Secret `CLOUDFLARE_API_TOKEN`: Worker deployment permission and **Billing Read** to inspect account subscriptions, scoped to the society account.
- Variable `CLOUDFLARE_ACCOUNT_ID`.
- Variable `KNOWLEDGE_PUBLIC_MCP_URL`: the staging Worker's exact HTTPS URL ending in `/mcp`.

Set the **repository variable** `KNOWLEDGE_DEPLOY_ENABLED` to `true` only when the account and URL have been verified. It is intentionally checked before the environment deployment job starts. Leave it unset to run checks without deploying.

The deployment preflight checks subscription information and refuses any active paid/trial subscription or an unrecognised response. The public deployment has no R2, D1, KV, paid model or writable storage binding. It uses a bundled immutable release and the approved public Luma feed. Free quotas can stop service; the workflow never upgrades a plan. Cloudflare's actual deployed startup and request CPU still require staging verification.

The existing custom editor/auth/R2 prototype is retained in `services/knowledge` for reference. The GitHub workflow does **not** deploy those services. GitHub repository permissions and review replace that hosted editing/publishing interface for this lightweight route.
