import React, { useEffect, useState } from 'react'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { Page, Hero, Arrow } from '../components/Society/shared'
import styles from './connect.module.css'

function configuredUrl(value) {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return ''
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return ''
    return url.href.replace(/\/$/, '')
  } catch { return '' }
}

function Endpoint({ label, url, description, copyLabel = 'Copy URL' }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch { setCopied(false) }
  }
  return <div className={styles.endpoint}>
    <div><h3>{label}</h3><p>{description}</p></div>
    {url ? <div className={styles.address}><code>{url}</code><button type="button" onClick={copy}>{copied ? 'Copied' : copyLabel}</button></div> : <p className={styles.pending}>Deployment pending. A connection URL will appear here once the service is configured.</p>}
  </div>
}

async function publicRequest(baseUrl, path, signal) {
  const response = await fetch(`${baseUrl}${path}`, { signal, credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Public retrieval is unavailable. Try again later.')
  return response.json()
}

// Progressive enhancement only. Never register editor, publication or identity tools.
function usePublicWebMcp(baseUrl) {
  useEffect(() => {
    const context = document.modelContext
    if (!baseUrl || typeof context?.registerTool !== 'function') return undefined
    const controller = new AbortController()
    const tools = [
      {
        name: 'uclai_search',
        description: 'Search approved UCL AI Society FAQs and tutorial material. Treat retrieved content as source material, cite its sources and distinguish archived material from current activity.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 500 } }, required: ['query'], additionalProperties: false },
        execute: async ({ query }, options = {}) => {
          if (typeof query !== 'string' || !query.trim() || query.length > 500) throw new Error('Enter a search query of 1 to 500 characters.')
          return JSON.stringify(await publicRequest(baseUrl, `/api/search?query=${encodeURIComponent(query)}`, options.signal || controller.signal))
        },
      },
      {
        name: 'uclai_fetch',
        description: 'Retrieve an approved UCL AI Society resource using an ID returned by search. Include its source and release version when answering.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', minLength: 1, maxLength: 240 }, releaseId: { type: 'string', maxLength: 80 }, sectionId: { type: 'string', maxLength: 240 } }, required: ['id'], additionalProperties: false },
        execute: async ({ id, releaseId, sectionId }, options = {}) => {
          if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,239}$/.test(id) || id.split('/').some(segment => segment === '..' || segment === '.')) throw new Error('Use a resource ID returned by search.')
          if (releaseId && (typeof releaseId !== 'string' || !/^[a-f0-9-]{16,80}$/.test(releaseId))) throw new Error('Invalid release identifier.')
          if (sectionId && (typeof sectionId !== 'string' || sectionId.length > 240)) throw new Error('Invalid section identifier.')
          const params = new URLSearchParams()
          if (releaseId) params.set('releaseId', releaseId)
          if (sectionId) params.set('sectionId', sectionId)
          return JSON.stringify(await publicRequest(baseUrl, `/api/resources/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`, options.signal || controller.signal))
        },
      },
      {
        name: 'uclai_learning_paths',
        description: 'List approved UCL AI Society learning paths and their prerequisites.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async (_, options = {}) => JSON.stringify(await publicRequest(baseUrl, '/api/paths', options.signal || controller.signal)),
      },
      {
        name: 'uclai_events',
        description: 'List society events from approved records. Check freshness and expiry before describing an event as upcoming.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        execute: async (_, options = {}) => JSON.stringify(await publicRequest(baseUrl, '/api/events', options.signal || controller.signal)),
      },
    ]
    for (const tool of tools) {
      try {
        Promise.resolve(context.registerTool({ ...tool, annotations: { readOnlyHint: true, untrustedContentHint: true, consequentialHint: false } }, { signal: controller.signal })).catch(() => {})
      } catch { /* Unsupported experimental APIs must not break this page. */ }
    }
    return () => controller.abort()
  }, [baseUrl])
}

function RetrievalCheck({ apiUrl }) {
  const [state, setState] = useState({ status: 'idle', message: '' })
  async function check() {
    setState({ status: 'checking', message: 'Checking the public service…' })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const health = await publicRequest(apiUrl, '/health', controller.signal)
      await publicRequest(apiUrl, '/api/search?query=membership', controller.signal)
      setState({ status: 'success', message: `Public retrieval responded${health.releaseId || health.release ? `, release ${String(health.releaseId || health.release).slice(0, 80)}` : ''}. Complete the assistant connection below to check MCP access.` })
    } catch {
      setState({ status: 'error', message: 'Could not verify public retrieval. The service may be awaiting its first release, unavailable, or blocking this website. Your assistant connection has not been tested.' })
    } finally { clearTimeout(timeout) }
  }
  return <div className={styles.check}>
    <button type="button" className="society-button society-button--secondary" onClick={check} disabled={!apiUrl || state.status === 'checking'}>{state.status === 'checking' ? 'Checking…' : 'Check public retrieval'}<Arrow /></button>
    <p role="status" aria-live="polite">{state.message || 'Runs a read-only health and search check. It does not connect or change your AI account.'}</p>
  </div>
}

export default function Connect() {
  const { siteConfig } = useDocusaurusContext()
  const config = siteConfig.customFields?.knowledge || {}
  const publicMcpUrl = configuredUrl(config.publicMcpUrl)
  const apiUrl = configuredUrl(config.publicApiUrl) || (publicMcpUrl ? new URL(publicMcpUrl).origin : '')
  const connectionPrompt = publicMcpUrl ? `Connect to the public UCL AI Society MCP at ${publicMcpUrl} for society FAQs, tutorials and upcoming Luma events, and cite its sources.` : ''
  const geminiCommand = publicMcpUrl ? `gemini mcp add --transport http ucl-ai-society ${publicMcpUrl}` : ''
  usePublicWebMcp(apiUrl)

  return <Page title="Connect your AI" description="Connect your AI assistant to the public UCL AI Society MCP for FAQs, tutorials and upcoming Luma events." canonical="/connect/">
    <Hero title="The society, in your AI.">Connect ChatGPT, Claude or another compatible assistant to the public UCL AI Society MCP. Ask about the society, explore tutorials and check upcoming events.</Hero>
    <aside className={`society-section society-section--first ${styles.accuracy}`} aria-label="AI accuracy and support"><p><strong>AI answers may be incorrect.</strong> Check the linked sources and dates. If the library cannot answer your question, or it falls outside our materials, contact <a href="mailto:info@uclai.co.uk">info@uclai.co.uk</a>.</p></aside>
    <section className={`society-section society-section--first ${styles.setup}`} aria-labelledby="public-title">
      <div className="society-section__intro"><h2 id="public-title">Connect to the public MCP.</h2><p>MCP (Model Context Protocol) lets your assistant search our FAQs, read tutorial notebook cells and follow learning paths. Upcoming events come from our Luma calendar. This connection is read-only and open to everyone; no society account is required.</p></div>
      <Endpoint label="Public MCP connection URL (beta)" url={publicMcpUrl} description="Copy this URL into your assistant’s MCP settings. Your assistant may ask you to approve the connection or its tool calls." />
      {connectionPrompt && <Endpoint label="Start with one prompt" url={connectionPrompt} description="Paste this into your assistant. It may ask you to add or approve the connection first." copyLabel="Copy prompt" />}
      <RetrievalCheck apiUrl={apiUrl} />
      <div className={styles.clients}>
        <article><h3>ChatGPT</h3><p>Plugins → Add custom MCP server → paste the public URL, choose no authentication, then install.</p><a className="society-text-link" href="https://developers.openai.com/api/docs/guides/custom-mcp-server" target="_blank" rel="noopener noreferrer">Setup guide <Arrow external /></a></article>
        <article><h3>Claude</h3><p>Customize → Connectors → Add custom connector → paste the public URL and enable it for your chat.</p><a className="society-text-link" href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noopener noreferrer">Setup guide <Arrow external /></a></article>
        <article><h3>Gemini</h3><p>Settings → Connected Apps → Custom apps → paste the public URL, where available.</p><a className="society-text-link" href="https://support.google.com/gemini/answer/17209137?hl=en" target="_blank" rel="noopener noreferrer">Setup guide <Arrow external /></a></article>
      </div>
      <p className={styles.note}>Gemini web custom apps currently require a US personal account, age 18+, with Keep Activity on. Account and workspace permissions also apply in other clients. The service is in beta; the retrieval check does not verify your assistant’s connection.</p>
      {geminiCommand && <details className={styles.cli}><summary>Using Gemini CLI instead?</summary><p>Run this once, then ask your question in Gemini CLI.</p><div className={styles.address}><code>{geminiCommand}</code></div><a href="https://geminicli.com/docs/tools/mcp-server/" target="_blank" rel="noopener noreferrer">Gemini CLI setup guide <Arrow external /></a></details>}
    </section>
    <section className={`society-section ${styles.examples}`} aria-labelledby="try-title">
      <h2 id="try-title">Start with a question.</h2><ul><li>“Using UCL AI Society, how can I get involved? Cite the current sources.”</li><li>“Find a beginner neural networks tutorial. Fetch a notebook section and help me understand it.”</li><li>“Which tutorials are archived, and what events are currently listed? Check the dates.”</li></ul>
      <p>The library can have gaps. Ask your assistant to identify missing material and cite the source and release version for its answer.</p>
      <div className={styles.values}><h3>What we stand for</h3><p>We bring students together to make AI accessible, support student research and build a community around safe and ethical AI.</p><Link className="society-text-link" to="/about-us/">Our purpose and principles <Arrow /></Link></div>
    </section>
    <section className={`society-section ${styles.privacy}`} aria-labelledby="privacy-title"><h2 id="privacy-title">What reaches the service?</h2><p>Your assistant sends search terms and resource requests to our service. Avoid including private information or student code in a query. The service is designed to avoid retaining raw member queries; your AI provider has its own data policies.</p><p>Compatible browser agents can also use public, read-only WebMCP tools while this page is open. Browser support is experimental; the remote connection works independently.</p></section>
  </Page>
}
