# Project decisions

Use this file for decisions that a future collaborator or AI needs to understand. Keep each entry brief: context, decision, reason and the next review point.

## 2026-09-11 — Establish a single production source

**Context:** Several local folders existed for the same PDF Metadata Remover site, with different revisions.

**Decision:** `pdf-metadata-worker-analytics-release` is the sole production source of truth because it contains the deployed Cloudflare Web Analytics version.

**Reason:** Prevents accidentally deploying an older visual or analytics-free version.

**Effect:** Historical folders remain read-only backups. All future edits start here.

## 2026-09-11 — Freeze core SEO content during the initial observation period

**Context:** The site is new; Google Search Console and Bing Webmaster Tools have both been configured and the sitemap has been submitted.

**Decision:** Do not change the homepage title, meta description, H1, core copy, URL structure or schema merely to chase early rankings.

**Reason:** We need a stable baseline to learn how search engines index and rank the page.

**Review point:** Review search-impression data after roughly two weeks. Make changes only from evidence.

## 2026-09-11 — Privacy-first analytics

**Context:** The product promise is local processing and no file upload.

**Decision:** Use Cloudflare Web Analytics only for aggregate, cookieless measurement.

**Reason:** It is consistent with the product's privacy promise. Do not add trackers that inspect PDF contents or follow users across sites.

## 2026-09-11 — GitHub is code memory, not a CRM

**Context:** The project needs durable cross-session context for people and AI.

**Decision:** Store code, product decisions and discrete work items in a private GitHub repository. Store contacts, business conversations and confidential data in the team's CRM or database instead.

**Reason:** Git history is excellent for reproducible product decisions, but inappropriate for sensitive relationship data.
