# Importing and updating society knowledge

The importer reads the existing Docusaurus portal, all five public society tutorial repositories, the local Journal Club slides, and the public AgentVerse FAQ page. It creates a complete local corpus and a separate public bootstrap corpus. It never executes notebooks, MDX, React components, downloaded Python, embedded PDF actions, or links discovered in documents.

## Run

From `services/knowledge`, after installing its dependencies:

```sh
KNOWLEDGE_PYTHON=/path/to/python-with-pypdf npm run ingest
npm run ingest -- --offline
npm run ingest -- --offline --ocr
```

Python needs the pinned parser: `python -m pip install -r requirements-pdf.txt`. Set `KNOWLEDGE_PYTHON` to that Python executable if it is not your default `python3`. The offline command uses the last downloaded source snapshots; it does not make old event data fresh again. Recognisable credentials in teaching text/code are redacted, retaining notebook cell order and recording the redaction in source metadata. Publication validation rejects remaining credential-like content.

Outputs:

- `data/corpus.json`: comprehensive local corpus, including bodies awaiting rights review. Ignored by Git.
- `data/raw/`: downloaded source cache. Ignored by Git; treat it as untrusted source material. Notebook outputs and malformed upstream files can contain data that must not be published.
- `data/bootstrap-corpus.json`: approved public bodies only, plus source metadata and gaps. Suitable for an initial staged release.
- `data/inventory.json`: every discovered source URL, its state, revision and related document IDs. Contains no downloaded bodies.
- `data/inventory.md`: import coverage, failures and source licence notices.

Repository source URLs are pinned to commit SHAs and every downloaded blob is checked against its Git hash. A re-run downloads changed commits and reuses immutable cached blobs. Missing or blocked sources remain visible in the inventory; the script exits with code 2 if an entire tutorial repository could not be read. Individual failures are reported in the inventory and do not disguise partial coverage as a complete import.

## What is approved

Existing public society portal copy and the public AgentVerse page are approved for this project. Tutorial repositories with a recognised MIT licence preserve the licence and author attribution. Sources without a recognised licence can be downloaded and parsed locally, but their bodies are excluded from the bootstrap public corpus until an authorised publisher reviews them. A public GitHub repository or Canva sharing link alone is not treated as permission to republish its contents.

Canva decks, YouTube/Zoom recordings and external citations remain link-only unless an accessible approved original is imported. Request an owner-exported PDF or authorised transcript rather than bypassing access restrictions. Example CSV datasets and images are attachments, not teaching prose. The corpus preserves year and archive status; the portal currently publishes no 2026/27 tutorial series.

PDFs have a 64 MiB input cap, 500-page cap, 8 MiB extracted-text cap and a 45-second text-parser timeout. Other remote source files have a 32 MiB cap. For an image-only PDF, `--ocr` optionally uses macOS Vision when Command Line Tools are already installed. It checks `xcode-select -p` and never installs system software or opens a prompt. The fallback allows at most 100 pages, four million pixels per page, eight MiB of text and three minutes of OCR time. OCR output is cached by the original PDF hash and remains review-required, including when the original has an open licence. Formulae, diagrams and reading order need checking against the original. Subsequent imports can reuse that cached OCR without `--ocr`.

The PDF text helper bounds expansion inside pypdf's codecs before text extraction: eight MiB per stream, 64 MiB total decoded streams, at most four chained filters, one MiB per predictor row and 64 KiB of malformed-zlib recovery input. It accepts only Flate, LZW, ASCIIHex, ASCII85 and RunLength text-stream filters; image, crypt and unsupported filters are refused by the text decoder. Image-only originals can still use the separate reviewed OCR route. The subprocess has a 20-second CPU soft limit, a 25-second CPU hard limit and a 256-MiB resident-memory watchdog checked every 20 ms. Linux additionally enforces 256-MiB data-segment and 512-MiB address-space limits. macOS does not reliably implement those kernel memory ceilings, so its memory protection uses the resident-memory watchdog plus bounded codecs and inputs. Parser failures use fixed diagnostics and suppress source-containing third-party logs.

One legacy `.ipynb` is actually an HTML snapshot of an older GitHub page; it is deliberately blocked rather than indexing GitHub account/session markup as teaching material. Its underlying A2C lesson exists in Season 2.

## Continuous updates through the authenticated MCP

Normal editor changes use the private MCP's draft tools, followed by publisher review and publication. For refreshing original sources, re-run the importer, stage the resulting corpus through the private import tool, inspect its conflict report and candidate diff, then publish the reviewed candidate. Keep the full file in upload tooling instead of pasting megabytes of corpus text into a chat.

For small maintenance batches, the authenticated `refresh_sources` capability accepts up to five existing canonical single-document GitHub source IDs. It resolves the latest allowlisted branch, verifies the exact Git blob and current MIT licence, and stages a partial import; it never publishes. Notebooks, Markdown and teaching Python up to four MiB are supported. PDFs, slide services, recordings and larger files must use the offline importer. Licence removal or a previously unestablished licence always returns the refreshed body for review. Source failures are returned as blocked records with explicit reasons, not as successful updates. The source-status tool exposes these recorded gaps and import states without reading raw cache bodies.

Imported documents carry `origin: imported` and an `importedContentHash`. Editing a document through the private MCP marks it `curated`. `reconcileImport(active, incoming)` preserves curated documents and documents whose body differs from the stored import baseline, reports upstream conflicts, and retains missing upstream documents for a deliberate deletion decision. Explicit curator deletions are retained in `curatedDeletions`; subsequent imports cannot restore those IDs. Restoration requires an explicit curated upsert. Learning paths with existing IDs are retained, with deleted or unavailable steps removed. Public approval is retained for an unchanged text/licence baseline only; a new source requiring rights review cannot inherit approval from a different earlier version.

To add another automatic source, a maintainer must change the source registry in code. Import URLs are not arbitrary user-supplied fetch instructions. Requests allow only selected HTTPS GitHub endpoints, pinned raw files in approved repositories, and the exact AgentVerse root page. Redirects, credentials, private addresses, unexpected hosts, traversal paths and repository symlinks are refused. Newly discovered links are catalogued without being followed.

The event snapshot expires 24 hours after retrieval. Schedule imports at least daily before relying on event answers. Failed refreshes keep the last body and its original expiry when the offline cache is used; they do not manufacture a new retrieval time. For accurate application status changes, use a structured event source or publish a committee correction through the private MCP.

Upcoming Luma calendar events use a separate live read adapter, not those imported snapshots. It fetches only the approved public calendar subscription, caches selected published fields for the advertised 12 hours, and returns provenance/expiry. It never queries private guests or registrations. A failed live refresh reports unavailable information rather than returning expired events as current. Event changes on Luma do not require a knowledge-release publication; they are identified by their own source version.

## Verification

`npm test -- tests/ingestion.test.ts` checks URL/redirect boundaries, streaming size enforcement, invalid encodings, path and symlink containment, passive notebook/MDX/JSX parsing, exclusion of notebook outputs, rights-gated public snapshots, and preservation of curated corrections during re-import.

`python -m unittest discover -s tests -p 'test_pdf_*.py' -v` uses the actual pinned pypdf library to check a compressed PDF bomb, aggregate expansion, chained filters, giant predictor-row allocation, input limits, diagnostic sanitisation and a valid compressed text document. The CI workflow installs the pinned Python dependency and runs these separately from the TypeScript tests. HTTP tests also use real gzip streams to verify that limits count decoded bytes rather than compressed Content-Length.

Check the inventory after every import. The presence of a `link-only`, `blocked` or `review-required` source is an explicit coverage limit, not a successful content import.
