const { execFile } = require('node:child_process')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')
const { createHash } = require('node:crypto')
const { markdownNodes } = require('./markdown.cjs')
const run = promisify(execFile)

module.exports = function societyKnowledge(context) {
  const service = path.join(context.siteDir, 'services/knowledge')
  return {
    name: 'society-knowledge-pages',
    getPathsToWatch: () => [path.join(context.siteDir, 'knowledge/**/*'), path.join(service, 'data/bootstrap-corpus.json')],
    async loadContent() {
      try {
        // Every website build runs the same validation/importer as the MCP build.
        // Never serve a stale manifest after a failed build, or publish raw files.
        await run(process.execPath, ['--import', 'tsx', 'scripts/build-knowledge.ts'], { cwd: service, timeout: 180000, maxBuffer: 1024 * 1024 })
      } catch {
        throw new Error('Knowledge validation failed. Install the service dependencies and PDF requirements, then run its knowledge:build command for diagnostics. No source contents were logged.')
      }
      const content = JSON.parse(await readFile(path.join(service, '.generated/website-knowledge.json'), 'utf8'))
      if (content.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(content.releaseId) || !Array.isArray(content.materials)) throw new Error('Invalid website knowledge manifest.')
      return content
    },
    async contentLoaded({ content, actions }) {
      const collections = { tutorials: [], nexus: [] }
      for (const material of content.materials) {
        const doc = material.document
        const sections = (doc.sections?.length ? doc.sections : [{ id: 'body', heading: doc.title, text: doc.text }]).map(section => ({ ...section, nodes: material.format === 'pdf' ? [] : markdownNodes(section.text, doc.source.url) }))
        const resource = { ...material, document: { ...doc, text: undefined, sections }, releaseId: content.releaseId }
        const filename = createHash('sha256').update(material.route).digest('hex') + '.json'
        const data = await actions.createData(filename, JSON.stringify(resource))
        actions.addRoute({ path: context.baseUrl.replace(/\/$/, '') + material.route, component: '@site/src/components/Society/KnowledgeResource.js', exact: true, modules: { resource: data } })
        collections[material.collection].push({ id: doc.id, route: material.route, title: doc.title, year: doc.year, series: doc.series, order: doc.order, date: material.date, archived: doc.archived, format: material.format, topics: doc.topics })
      }
      actions.setGlobalData({ collections })
    },
  }
}
