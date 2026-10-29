const test = require('node:test')
const assert = require('node:assert/strict')
const plugin = require('./index.cjs')

test('approved manifest entries become versioned data and correctly based routes in both builds', async () => {
  for (const baseUrl of ['/', '/preview/website-redesign/']) {
    const routes = [], files = []
    let globalData
    const content = { schemaVersion: 1, releaseId: 'a'.repeat(64), materials: ['tutorials', 'nexus'].map(collection => ({ collection, route: `/learn/${collection}/lesson.md/`, sourcePath: `knowledge/${collection}/lesson.md`, format: 'md', document: { id: collection, title: 'Lesson', text: 'Do not copy this full body to global data.', topics: ['research'], archived: true, source: { url: 'https://example.com/source' }, sections: [{ id: 'exercise', heading: 'Exercise', kind: 'exercise', text: 'Try **this**.' }] } })) }
    await plugin({ siteDir: '/repo', baseUrl }).contentLoaded({ content, actions: {
      async createData(name, value) { files.push(JSON.parse(value)); return '/data/' + name },
      addRoute(route) { routes.push(route) }, setGlobalData(data) { globalData = data },
    } })
    assert.equal(routes.length, 2)
    assert.equal(routes[0].path, baseUrl + 'learn/tutorials/lesson.md/')
    assert.equal(routes[1].path, baseUrl + 'learn/nexus/lesson.md/')
    assert.equal(files[0].releaseId, content.releaseId)
    assert.equal(files[0].document.sections[0].kind, 'exercise')
    assert.ok(files[0].document.sections[0].nodes[0].children.some(node => node.type === 'strong'))
    assert.equal(files[0].document.text, undefined)
    assert.equal(globalData.collections.nexus[0].title, 'Lesson')
    assert.doesNotMatch(JSON.stringify(globalData), /Do not copy|Try/)
  }
})
test('an empty or withdrawn collection does not retain old routes', async () => {
  const routes = []
  await plugin({ siteDir: '/repo', baseUrl: '/' }).contentLoaded({ content: { materials: [] }, actions: { createData() { assert.fail('No data should be created') }, addRoute(route) { routes.push(route) }, setGlobalData(data) { assert.deepEqual(data.collections, { tutorials: [], nexus: [] }) } } })
  assert.deepEqual(routes, [])
})
