# Repository status

Updated: 29 October 2026 (Australia/Melbourne).

## Completed documentation

- [G3 simulator implementation plan](G3-simulator-plan.md), revised after three independent agent reviews.
- [Programmatic trading review](reviews/G3-trading-review.md).
- [Software engineering review](reviews/G3-engineering-review.md).
- [Investor usability review](reviews/G3-investor-review.md).
- [Self-contained, printer-friendly HTML review](../output/html/G3-review.html), including all four documents.
- [PDF review bundle](../output/pdf/G3-simulator-plan-and-reviews.pdf), including all four documents.

The reviews are analytical agent assessments through the requested perspectives, not professional endorsements. The original document and export dates are retained. Conditional roadmap dates have not been rebaselined and are not evidence that scheduled milestones were completed.

## Implementation readiness

The repository remains a strategy research/specification project. There is no implemented or accepted five-stage simulator, trading engine, live broker integration or verified profitability. The current strategy authority remains v3 and `model/parameters.json`.

Next steps are to approve the unresolved G1 rule decisions and independently calculated fixtures, establish the G2 point-in-time data contract and readiness report, then build the bounded G3 replay core. The plan's four-development-week estimate remains conditional on approved rules and usable data; it excludes historical-data procurement, realistic broker execution constraints and the separately estimated browser interface.

## Publication and download status

No public live URL for the G3 HTML review has been verified. The HTML and PDF are prepared files, not proof of hosting. The current session has no callable site-publishing capability; a GitHub Pages API discovery request was blocked by the network proxy. This does not establish whether Pages is enabled or disabled on GitHub.

After these files are pushed, use the GitHub repository branch containing them. For the PDF, open `output/pdf/G3-simulator-plan-and-reviews.pdf` and choose **Download raw file**. For offline browser review, download `output/html/G3-review.html` and open it locally, then use **Print / Save as PDF** if desired. All document content and styling are embedded in that HTML; external repository source links require connectivity.

Publishing an actual live review page still requires a supported hosting connection or GitHub Pages access. No localhost address, speculative hostname or file-browser link is presented as a live site.

## Verification evidence

Earlier validation confirmed Python 3.12, a successful local HTTP response for the original static website, and offline reproduction of all 20 saved symbol/session RR results and event logs. This was a check of the existing assumed research model, not the proposed v3 simulator. The G3 HTML was separately checked in Chromium for four document sections, internal navigation, tables, mobile width and print rendering. The PDF was checked for all four document titles.

These are recorded checks from the prior preparation/export work, not claims of a new clean-environment simulator test. Repository source code, strategy parameters and historical research results remain unchanged by this documentation update.
