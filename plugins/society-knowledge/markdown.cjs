const unified = require('unified')
const remarkParse = require('remark-parse')

function safeHref(value, sourceUrl) {
  try {
    if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x1f\x7f]/.test(value)) return null
    const url = new URL(value, sourceUrl)
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch { return null }
}

// Parse Markdown as data at build time. Only this small allowlist of nodes is
// sent to React. HTML, MDX expressions, imports and scripts are never compiled.
function markdownNodes(text, sourceUrl) {
  const tree = unified().use(remarkParse).parse(text)
  const definitions = new Map(tree.children.filter(node => node.type === 'definition').map(node => [node.identifier, node.url]))
  const convert = node => {
    const children = () => (node.children || []).flatMap(convert)
    if (node.type === 'text' || node.type === 'inlineCode') return [{ type: node.type, value: node.value }]
    if (node.type === 'code') return [{ type: 'code', value: node.value, language: /^[a-z0-9_+-]{1,30}$/i.test(node.lang || '') ? node.lang : 'text' }]
    if (['paragraph', 'strong', 'emphasis', 'blockquote', 'listItem'].includes(node.type)) return [{ type: node.type, children: children() }]
    if (node.type === 'heading') return [{ type: 'heading', depth: Math.min(6, Math.max(2, node.depth)), children: children() }]
    if (node.type === 'list') return [{ type: 'list', ordered: !!node.ordered, children: children() }]
    if (node.type === 'break' || node.type === 'thematicBreak') return [{ type: node.type }]
    if (['link', 'linkReference', 'image', 'imageReference'].includes(node.type)) {
      const href = safeHref(node.url ?? definitions.get(node.identifier), sourceUrl)
      const label = node.type.startsWith('image') ? [{ type: 'text', value: node.alt || 'View image' }] : children()
      // Images stay explicit links; visiting a tutorial never loads external images.
      return href ? [{ type: 'link', href, children: label }] : label
    }
    return []
  }
  return tree.children.flatMap(convert)
}

module.exports = { markdownNodes, safeHref }
