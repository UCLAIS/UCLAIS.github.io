const test = require('node:test')
const assert = require('node:assert/strict')
const { mkdtemp, mkdir, writeFile, rm, symlink } = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { loadPresentation } = require('./presentation.cjs')

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGScAAAAASUVORK5CYII=', 'base64')
async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'uclai-slide-check-'))
  const folder = path.join(root, 'static/materials/tutorials/lesson')
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, 'page.png'), png)
  await writeFile(path.join(folder, 'slides.pdf'), '%PDF-1.4\n')
  await writeFile(path.join(folder, 'answers.ipynb'), '{"cells":[]}')
  const data = { schemaVersion: 1, pdf: '/materials/tutorials/lesson/slides.pdf', slides: [{ src: '/materials/tutorials/lesson/page.png', width: 1, height: 1, text: 'Source slide text' }], files: [{ label: 'Answers notebook', url: '/materials/tutorials/lesson/answers.ipynb' }] }
  const save = () => writeFile(path.join(folder, 'presentation.json'), JSON.stringify(data))
  try { await save(); await run({ root, folder, data, save }) }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('approved static slides and additional files load; ordinary text resources remain supported', async () => fixture(async ({ root, data }) => {
  assert.deepEqual(await loadPresentation(root, 'knowledge/tutorials/lesson.md'), data)
  assert.equal(await loadPresentation(root, 'knowledge/tutorials/other notebook.ipynb'), null)
  assert.equal(await loadPresentation(root, 'knowledge/tutorials/example.py'), null)
}))

test('slide and download paths refuse remote URLs, traversal, encoding, active formats and missing files', async () => fixture(async ({ root, data, save }) => {
  for (const value of ['https://example.com/page.png', '//example.com/page.png', '/materials/../private.png', '/materials/%2e%2e/private.png', '/materials/tutorials/lesson/page.svg', '/materials/tutorials/lesson/missing.png']) {
    data.slides[0].src = value; await save()
    await assert.rejects(loadPresentation(root, 'knowledge/tutorials/lesson.md'))
  }
  data.slides[0].src = '/materials/tutorials/lesson/page.png'
  data.files[0].url = '/materials/tutorials/lesson/answers.html'; await save()
  await assert.rejects(loadPresentation(root, 'knowledge/tutorials/lesson.md'))
  await assert.rejects(loadPresentation(root, 'knowledge/tutorials/../../private.md'))
}))

test('symlinks, disguised markup and unbounded records cannot become slide assets', async () => fixture(async ({ root, folder, data, save }) => {
  await writeFile(path.join(root, 'private.png'), png)
  await symlink(path.join(root, 'private.png'), path.join(folder, 'linked.png'))
  data.slides[0].src = '/materials/tutorials/lesson/linked.png'; await save()
  await assert.rejects(loadPresentation(root, 'knowledge/tutorials/lesson.md'), /Symlinked/)
  data.slides[0].src = '/materials/tutorials/lesson/page.png'; await save()
  await writeFile(path.join(folder, 'page.png'), '<svg onload="malicious()"/>')
  await assert.rejects(loadPresentation(root, 'knowledge/tutorials/lesson.md'), /raster/)
  await writeFile(path.join(folder, 'page.png'), png)
  data.slides = Array(301).fill(data.slides[0]); await save()
  await assert.rejects(loadPresentation(root, 'knowledge/tutorials/lesson.md'), /record/)
  await writeFile(path.join(folder, 'presentation.json'), ' '.repeat(1024 * 1024 + 1))
  await assert.rejects(loadPresentation(root, 'knowledge/tutorials/lesson.md'), /oversized/)
}))
