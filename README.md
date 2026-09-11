# PDF Metadata Remover

Production site: https://pdfmetadataremover.com/

A free, browser-local tool for viewing and removing common PDF metadata before a file is shared. PDFs are processed in the visitor's browser and are not uploaded by this site.

## Production source of truth

This folder is the only production source for the website. It includes the live Cloudflare Web Analytics version.

Other nearby `pdf-metadata-*` folders are historical working copies. Do not deploy from them.

## Deployment

Hosting: Cloudflare Workers static-file upload.

To publish a change, upload the files in this folder through the existing Cloudflare Worker named `pdfmetadataremover`, then verify:

1. `https://pdfmetadataremover.com/` loads successfully.
2. `http://pdfmetadataremover.com/` redirects to HTTPS.
3. `https://pdfmetadataremover.com/sitemap.xml` loads.
4. The upload tool is still local-browser processing.

## Operating rules

- Keep the homepage title, description, H1 and core SEO copy frozen while the new site gathers search data.
- Use `docs/DECISIONS.md` for durable decisions and their reasons.
- Use GitHub Issues for discrete, verifiable work—not for chat logs or contact lists.
- Never store passwords, API keys, private customer information, or brand/contact databases in this repository.

## Current monitoring

- Google Search Console: submitted and monitoring indexing/search performance.
- Bing Webmaster Tools: sitemap submitted.
- Cloudflare Web Analytics: enabled; cookieless aggregate analytics only.
