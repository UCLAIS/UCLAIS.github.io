import React from 'react'
import Link from '@docusaurus/Link'
import { usePluginData } from '@docusaurus/useGlobalData'
import { Arrow } from './shared'
import styles from './knowledge.module.css'

export function MaterialDate({ date }) {
  return date ? <time dateTime={date}>{new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time> : null
}

export default function KnowledgeCollection({ collection }) {
  const data = usePluginData('society-knowledge-pages')
  const materials = data.collections[collection] || []
  const nexus = collection === 'nexus'
  return <div className={styles.collection}>
    <h2>{nexus ? 'Nexus session notes' : 'Published tutorials'}</h2>
    <p>{nexus ? 'Notes and resources from Nexus Labs sessions. Check our events calendar for upcoming sessions.' : 'Tutorial notes and notebooks for self-study. Session dates describe the material, rather than an upcoming event.'}</p>
    {materials.length ? <ul className={styles.list}>{materials.map(item => <li key={item.id}>
      <Link className={styles.materialLink} to={item.route}><span><strong>{item.title}</strong><span className={styles.metadata}>{[item.year, item.series, item.order && `${nexus ? 'Session' : 'Lesson'} ${item.order}`, item.archived ? 'Learning archive' : 'Learning material', item.format.toUpperCase()].filter(Boolean).join(' · ')}{item.date && <> · <MaterialDate date={item.date} /></>}</span></span><Arrow /></Link>
    </li>)}</ul> : <p className={styles.empty}>{nexus ? 'No session notes have been published here yet.' : 'No new tutorials have been published here yet. Explore the earlier series below.'}</p>}
  </div>
}
