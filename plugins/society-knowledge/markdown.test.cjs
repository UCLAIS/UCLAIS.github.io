const test = require('node:test')
const assert = require('node:assert/strict')
const { markdownNodes, safeHref } = require('./markdown.cjs')
const source = 'https://github.com/UCLAIS/UCLAIS.github.io/blob/abc/knowledge/tutorials/intro.md'

test('Markdown imports and HTML do not become executable elements or unsafe URLs', () => {
  const nodes = markdownNodes('<script>globalThis.EXECUTED = true</script>\n\n<img src=x onerror=steal()>\n\n[unsafe](javascript:alert%281%29)\n\n{globalThis.EXECUTED = true}\n\n```python\nprint("hello")\n```', source)
  assert.doesNotMatch(JSON.stringify(nodes), /javascript:|onerror|<script>|<img/)
  assert.ok(JSON.stringify(nodes).includes('globalThis.EXECUTED = true')) // inert text only
  assert.ok(nodes.some(node => node.type === 'code' && node.value === 'print("hello")'))
  assert.equal(globalThis.EXECUTED, undefined)
})
test('links preserve pinned source paths and images require an explicit visit', () => {
  const nodes = markdownNodes('[Data](../data/example.csv)\n\n![Slides](https://example.com/slides.png)\n\n[Notes][ref]\n\n[ref]: https://example.com/notes', source)
  const links = nodes.flatMap(node => node.children || []).filter(node => node.type === 'link')
  assert.equal(links[0].href, 'https://github.com/UCLAIS/UCLAIS.github.io/blob/abc/knowledge/data/example.csv')
  assert.equal(links[1].href, 'https://example.com/slides.png')
  assert.equal(links[2].href, 'https://example.com/notes')
  assert.doesNotMatch(JSON.stringify(nodes), /"type":"image"/)
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@example.com', 'file:///private', 'https://example.com/\nattack', undefined]) assert.equal(safeHref(value, source), null)
})
