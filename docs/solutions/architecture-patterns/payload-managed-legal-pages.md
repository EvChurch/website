---
title: Keep editable legal pages in Payload without losing their stable presentation
date: 2026-08-22
category: architecture-patterns
module: Public Pages
problem_type: maintainability
component: payload-pages
symptoms:
  - Legal copy requires a code deployment to change
  - A CMS replacement loses the established narrow legal-page layout
root_cause: route_specific_legal_content
resolution_type: architecture_pattern
severity: low
tags: [payload, legal-pages, privacy, terms, nextjs]
---

# Keep editable legal pages in Payload without losing their stable presentation

## When to apply

Use this pattern for public text-heavy pages that need stable URLs and reviewed CMS editing while retaining a deliberate, shared presentation.

## Pattern

Store each document in the `pages` collection with the `simple-content` template and one Content block per section. The shared `[slug]` route renders that template through `SimpleContentPage`, using the Payload title, document update date and rich-text sections. Keep navigation and sitemap links pointed at the stable slug rather than a route-specific component.

Change existing production copy through the Payload MCP and read it back after saving. Static route files can then be removed once the matching published Payload documents exist. Seed data remains for explicit local or new-environment setup, not production content updates.

## Verification

- Read back the published Payload documents, including template, SEO fields and rich-text layout.
- Test the simple-content renderer, dynamic page branch, footer links, rich-text tables and sitemap output.
- Run the production build, deploy, then verify the public URLs, canonical metadata, header contrast and CMS content independently.
