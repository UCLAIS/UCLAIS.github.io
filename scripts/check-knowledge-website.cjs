// Integration trial in an isolated temporary workspace. It cannot contaminate a
// real local build/deployment with its tutorial, notebook, PDF or Nexus fixtures.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync } = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const checkout = path.resolve(__dirname, '..')
const root = mkdtempSync(path.join(os.tmpdir(), 'uclai-website-check-'))
const marker = 'publication-check-' + randomUUID()
const tutorialDir = path.join(root, 'knowledge/tutorials', marker)
const nexusDir = path.join(root, 'knowledge/nexus', marker)
const output = path.join(root, 'publication-output')
function pdf() {
  const stream = 'BT /F1 12 Tf 20 100 Td (PDF_SYNC_SENTINEL) Tj ET'
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let result = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const start = Buffer.byteLength(result)
  result += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${start}\n%%EOF\n`
  return result
}
try {
  // Copy only website sources and the approved importer input, never .env,
  // private raw imports, generated releases, credentials or deployment state.
  for (const relative of ['docusaurus.config.js', 'package.json', 'sidebars.js', 'src', 'static', 'blog', 'our-initiatives', 'knowledge', 'plugins', 'scripts/preview-config.cjs', 'services/knowledge/package.json', 'services/knowledge/src', 'services/knowledge/scripts/build-knowledge.ts', 'services/knowledge/data/bootstrap-corpus.json']) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    cpSync(path.join(checkout, relative), path.join(root, relative), { recursive: true, filter: source => !/^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.wrangler|\.generated|secrets|credentials)$/.test(path.basename(source)) && !/\.(?:pem|key|p12|pfx)$/.test(source) })
  }
  symlinkSync(path.join(checkout, 'node_modules'), path.join(root, 'node_modules'), 'dir')
  symlinkSync(path.join(checkout, 'services/knowledge/node_modules'), path.join(root, 'services/knowledge/node_modules'), 'dir')
  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: checkout, encoding: 'utf8' }).trim()
  writeFileSync(path.join(root, '.git'), `gitdir: ${gitDir}\n`)
  mkdirSync(tutorialDir, { recursive: true }); mkdirSync(nexusDir, { recursive: true })
  writeFileSync(path.join(tutorialDir, 'lesson.mdx'), '---\nyear: 2026/27\nseries: Publication check series\norder: 3\n---\n# Website publication check\n\nTUTORIAL_SYNC_SENTINEL\n\n## Exercise\nTry the exercise.\n\n## Hint\nCheck the labels.\n\n## Solution\nCompare the results.\n\n<script>HTML_EXECUTION_SENTINEL()</script>\n\n[Unsafe link](javascript:alert%281%29)')
  writeFileSync(path.join(tutorialDir, 'cells.ipynb'), JSON.stringify({ cells: [{ cell_type: 'markdown', source: '# Notebook publication check' }, { cell_type: 'code', source: 'print("NOTEBOOK_SYNC_SENTINEL")', outputs: [{ text: 'PRIVATE_OUTPUT_SENTINEL' }] }, { cell_type: 'markdown', source: '## Solution' }, { cell_type: 'code', source: 'print("SOLUTION_SYNC_SENTINEL")' }] }))
  writeFileSync(path.join(tutorialDir, 'draft.md'), '---\nstatus: draft\n---\n# DRAFT_ONLY_SENTINEL\nNot approved.')
  writeFileSync(path.join(tutorialDir, 'review.md'), '---\nstatus: review-required\n---\n# REVIEW_ONLY_SENTINEL\nNot approved.')
  writeFileSync(path.join(tutorialDir, 'slides.pdf'), pdf())
  writeFileSync(path.join(nexusDir, 'session.md'), '---\ndate: 2026-10-20\nyear: 2026/27\nseries: Publication check series\norder: 2\n---\n# Nexus publication check\nNEXUS_SYNC_SENTINEL')
  execFileSync(process.execPath, [path.join(root, 'node_modules/@docusaurus/core/bin/docusaurus.mjs'), 'build', '--out-dir', output], { cwd: root, env: { ...process.env, SOCIETY_PREVIEW: 'true' }, stdio: 'inherit' })
  const generated = path.join(root, 'services/knowledge/.generated')
  const website = JSON.parse(readFileSync(path.join(generated, 'website-knowledge.json'), 'utf8'))
  const release = JSON.parse(readFileSync(path.join(generated, 'knowledge.release.json'), 'utf8')).release
  assert.equal(website.releaseId, release.id)
  const materials = website.materials.filter(item => item.sourcePath.includes(marker))
  assert.equal(materials.length, 4)
  for (const item of materials) {
    const published = release.corpus.documents.find(doc => doc.id === item.document.id)
    assert.deepEqual(published, item.document)
    const html = readFileSync(path.join(output, item.route.slice(1), 'index.html'), 'utf8')
    assert.ok(html.includes(item.document.title))
    assert.doesNotMatch(html, /PRIVATE_OUTPUT_SENTINEL|DRAFT_ONLY_SENTINEL|REVIEW_ONLY_SENTINEL|HTML_EXECUTION_SENTINEL|href="javascript:/)
    if (item.format === 'mdx') { assert.ok(html.includes('<details')); assert.ok(html.includes('Solution')); assert.ok(html.includes('TUTORIAL_SYNC_SENTINEL')) }
    if (item.format === 'ipynb') { assert.ok(html.includes('NOTEBOOK_SYNC_SENTINEL')); assert.ok(html.includes('notebook cell 2 (code)')); assert.match(html, /<details[^>]*id="cell-4"[^>]*>.*?SOLUTION_SYNC_SENTINEL.*?<\/details>/s); assert.doesNotMatch(html, /<details[^>]*id="cell-4"[^>]*\bopen(?:=|>)/) }
    if (item.format === 'pdf') { assert.ok(html.includes('PDF_SYNC_SENTINEL')); assert.ok(html.includes('page 1')) }
  }
  assert.doesNotMatch(JSON.stringify(website), /PRIVATE_OUTPUT_SENTINEL|DRAFT_ONLY_SENTINEL|REVIEW_ONLY_SENTINEL/)
  const tutorials = readFileSync(path.join(output, 'our-initiatives/tutorials/index.html'), 'utf8')
  const nexus = readFileSync(path.join(output, 'our-initiatives/Nexus-Labs/index.html'), 'utf8')
  assert.ok(tutorials.includes('Website publication check'))
  assert.ok(nexus.includes('Nexus publication check'))
  assert.ok(tutorials.includes('Publication check series') && tutorials.includes('Session 3'))
  assert.ok(nexus.includes('Publication check series') && nexus.includes('Session 2'))
  assert.doesNotMatch(tutorials, /2026\/27 tutorial materials are not published here/)
  assert.doesNotMatch(tutorials, /aria-label="Archive status"|Learning archive/)
  const earlierTutorials = readFileSync(path.join(output, 'our-initiatives/tutorials/2024-2025/index.html'), 'utf8')
  assert.match(earlierTutorials, /aria-label="Archive status"/)
  console.log('Shared publication passed: Markdown, notebook cells, PDF pages and Nexus notes appear in both outputs; drafts, unsafe markup and execution outputs do not.')
} finally {
  rmSync(root, { recursive: true, force: true })
}
