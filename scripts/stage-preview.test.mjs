import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stagePreview, productionSnapshot } from './stage-preview.mjs'

test('only replaces this preview, preserving production, CNAME and other previews', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uclai-preview-'))
  try {
    const source = join(directory, 'build')
    const published = join(directory, 'published')
    mkdirSync(source); mkdirSync(join(published, 'preview/website-redesign'), { recursive: true })
    writeFileSync(join(source, 'index.html'), 'new preview')
    writeFileSync(join(source, 'CNAME'), 'must not publish this copy')
    writeFileSync(join(published, 'index.html'), 'original homepage')
    writeFileSync(join(published, 'CNAME'), 'uclai.co.uk')
    writeFileSync(join(published, 'preview/other.html'), 'another preview')
    writeFileSync(join(published, 'preview/website-redesign/stale.html'), 'old preview')
    const before = productionSnapshot(published)
    const target = stagePreview(source, published)
    assert.deepEqual(productionSnapshot(published), before)
    assert.equal(readFileSync(join(target, 'index.html'), 'utf8'), 'new preview')
    assert.equal(existsSync(join(target, 'stale.html')), false)
    assert.equal(existsSync(join(target, 'CNAME')), false)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('refuses to stage without an existing published website', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uclai-preview-'))
  try {
    const source = join(directory, 'build'); const published = join(directory, 'published')
    mkdirSync(source); mkdirSync(published); writeFileSync(join(source, 'index.html'), 'preview')
    assert.throws(() => stagePreview(source, published), /existing published website/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
