---
title: How to add Society knowledge
type: guide
topics: [society, contributions]
archived: false
---

# How to add Society knowledge

Adding or updating the knowledge library is for UCL AI Society committee members with authorised GitHub repository access only. The public MCP is read-only and open to everyone; connecting to it does not grant editing or publishing permissions. If you are not on the committee, email corrections or suggestions to info@uclai.co.uk.

Authorised committee members can add tutorials, Nexus session notes, FAQs and guides to the `knowledge/` folder in the UCL AI Society website repository. Upload tutorials to `knowledge/tutorials/` and Nexus notes to `knowledge/nexus/`. Review the facts, attribution and permission to publish, then merge to `main`. The configured workflows automatically publish those files as website pages and MCP knowledge, with no separate website edit or manual index refresh.

Tutorials appear in the website tutorial library; Nexus notes appear under session notes on the Nexus Labs page. Markdown, notebooks and PDFs all use the same importer for both services. Drafts and files awaiting review are excluded from both. Removing or withdrawing a document removes it from both outputs after their deployments succeed. FAQs and guides feed the MCP without creating tutorial or Nexus pages.

With the repository open in your agent, attach a PDF or PowerPoint and say “Use tutorial.md and push this” or “Use nexus.md and push this.” The agent prepares faithful notes, records the sequence and pushes through the normal publication route, opening a PR where required. It needs file-reading tools and your authenticated GitHub connection. A raw PowerPoint is not imported directly.

Each lesson or session can carry a record in Markdown front matter, or a matching `.meta.json` file for a PDF/notebook. The academic year, series and explicit lesson/session number determine website order. Duplicate positions within the same year and series fail validation. MCP search ranks relevant passages and returns this sequence metadata alongside them. Notebooks retain cell order without execution outputs; PDF text retains page references. Linked videos and slide decks remain links unless an authorised body or transcript has been imported.

Public GitHub branches are public even when a file is marked as a draft for the MCP. Keep confidential committee material and student personal information out of the public repository.

For missing information, uncertain policies, corrections or questions outside the library, email info@uclai.co.uk. AI answers may be incorrect; check their cited sources and dates.
