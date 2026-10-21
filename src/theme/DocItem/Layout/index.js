import React from 'react'
import Link from '@docusaurus/Link'
import { useDoc } from '@docusaurus/theme-common/internal'
import DocItemContent from '@theme/DocItem/Content'
import { Arrow } from '../../../components/Society/shared'

export default function DocItemLayout({ children }) {
  const { metadata } = useDoc()
  const id = metadata.unversionedId
  const tutorial = id.startsWith('tutorials/')
  const journal = id.startsWith('journal-club/')
  const archived = tutorial || journal
  const year = id.match(/(20\d{2})-(20\d{2})/)
  const period = year ? `${year[1]}/${year[2].slice(2)}` : journal ? 'Past Journal Club sessions' : 'Past tutorial series'
  const hub = tutorial ? '/our-initiatives/tutorials/' : '/our-initiatives/journal-club/'

  return <div className="society-document">
    <nav className="society-document__nav" aria-label="Resource navigation">
      <Link to="/our-initiatives/">Our Initiatives</Link>
      {archived && <Link to={hub}>{tutorial ? 'Tutorial archive' : 'Journal Club archive'}</Link>}
      {!archived && <Link to="/our-initiatives/Nexus-Labs/">Nexus Labs</Link>}
    </nav>
    {archived && <aside className="society-archive-status" aria-label="Archive status">
      <strong>Archived material <span>{period}</span></strong>
      <p>Past sessions. Dates, team roles and resource links are historical.</p>
    </aside>}
    <article className="society-document__article"><DocItemContent>{children}</DocItemContent></article>
    <footer className="society-document__footer"><Link className="society-text-link" to={archived ? hub : '/our-initiatives/Nexus-Labs/'}>{archived ? 'Browse the archive' : 'Back to Nexus Labs'} <Arrow /></Link></footer>
  </div>
}
