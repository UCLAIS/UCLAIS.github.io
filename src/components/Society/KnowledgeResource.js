import React from 'react'
import Link from '@docusaurus/Link'
import CodeBlock from '@theme/CodeBlock'
import { Page, Arrow } from './shared'
import { MaterialDate } from './KnowledgeCollection'
import styles from './knowledge.module.css'

// Only explicit React elements are rendered. Imported HTML/MDX is never inserted
// with innerHTML, compiled as JSX, or evaluated. Code remains a displayed string.
export function MarkdownNodes({ nodes }) {
  return <>{nodes.map((node, index) => {
    const children = <MarkdownNodes nodes={node.children || []} />
    switch (node.type) {
      case 'text': return <React.Fragment key={index}>{node.value}</React.Fragment>
      case 'inlineCode': return <code key={index}>{node.value}</code>
      case 'code': return <CodeBlock key={index} language={node.language}>{node.value}</CodeBlock>
      case 'paragraph': return <p key={index}>{children}</p>
      case 'strong': return <strong key={index}>{children}</strong>
      case 'emphasis': return <em key={index}>{children}</em>
      case 'heading': return React.createElement(`h${node.depth}`, { key: index }, children)
      case 'blockquote': return <blockquote key={index}>{children}</blockquote>
      case 'list': return node.ordered ? <ol key={index}>{children}</ol> : <ul key={index}>{children}</ul>
      case 'listItem': return <li key={index}>{children}</li>
      case 'link': return <a key={index} href={node.href} rel="noopener noreferrer">{children}</a>
      case 'thematicBreak': return <hr key={index} />
      case 'break': return <br key={index} />
      default: return null
    }
  })}</>
}

function MaterialSection({ section, pdf, hideHeading }) {
  const reference = section.heading.match(/\s+\(((?:slides?|pages?|notebook cell)\s[^)]+)\)$/i)
  const heading = reference ? section.heading.slice(0, reference.index) : section.heading
  const locator = section.locator || reference?.[1]
  const content = <>{locator && <p className={styles.locator}>{locator}</p>}{pdf ? <p className={styles.pdfText}>{section.text}</p> : <MarkdownNodes nodes={section.nodes} />}</>
  if (section.kind === 'hint' || section.kind === 'solution') return <details className={styles.answer} id={section.id}><summary>{new RegExp(section.kind, 'i').test(heading) ? heading : `${section.kind === 'hint' ? 'Hint' : 'Solution'}: ${heading}`}</summary><div>{content}</div></details>
  return <section className={styles.section} id={section.id}>{!hideHeading && <h2>{heading}</h2>}{content}</section>
}

export default function KnowledgeResource({ resource }) {
  const { document: doc } = resource
  const nexus = resource.collection === 'nexus'
  const parent = nexus ? '/our-initiatives/Nexus-Labs/#session-notes' : '/our-initiatives/tutorials/'
  return <Page title={doc.title} description={`${nexus ? 'Nexus Labs session notes' : 'Tutorial material'} from UCL AI Society.`} canonical={resource.route}>
    <article className={styles.resource}>
      <Link className="society-text-link" to={parent}>Back to {nexus ? 'Nexus Labs' : 'tutorials'} <Arrow /></Link>
      <header className={styles.resourceHeader}>
        <h1>{doc.title}</h1>
        <p>{[doc.year, doc.series, doc.order && `Session ${doc.order}`].filter(Boolean).join(' · ')}{resource.date && <> · <MaterialDate date={resource.date} /></>}</p>
      </header>
      <aside className={styles.provenance} aria-label="Material source">
        {doc.source.attribution && <p>{doc.source.attribution}</p>}
        <p><a href={resource.fileUrl} target="_blank" rel="noopener noreferrer">View on GitHub <Arrow external /></a>{doc.source.url !== resource.fileUrl && <> · <a href={doc.source.url} target="_blank" rel="noopener noreferrer">Source</a></>}{doc.source.license && <> · {doc.source.license}</>}</p>
      </aside>
      {doc.sections.map((section, index) => <MaterialSection key={section.id} section={section} hideHeading={index === 0 && section.heading === doc.title} pdf={resource.format === 'pdf'} />)}
    </article>
  </Page>
}
