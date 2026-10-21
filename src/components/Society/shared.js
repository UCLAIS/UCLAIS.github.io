import React from 'react'
import Layout from '@theme/Layout'
import Head from '@docusaurus/Head'
import Link from '@docusaurus/Link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { links, pillars } from './content'
import PixelScene from './PixelScene'
import displayFont from '@site/static/fonts/EBGaramond-Latin.woff2'
import textFont from '@site/static/fonts/Geist.woff2'

export function Page({ title, description, children, canonical }) {
  return <Layout title={title} description={description} wrapperClassName="society-wrapper">
    <Head>
      <link rel="preload" href={displayFont} as="font" type="font/woff2" crossOrigin="anonymous" />
      <link rel="preload" href={textFont} as="font" type="font/woff2" crossOrigin="anonymous" />
      {canonical && <link rel="canonical" href={`https://uclai.co.uk${canonical}`} />}
    </Head>
    <main className="society-page">{children}</main>
  </Layout>
}

export function Arrow({ external = false }) {
  return <FontAwesomeIcon icon={external ? faArrowUpRightFromSquare : faArrowRight} aria-hidden="true" />
}
export function Button({ href, children, secondary = false }) {
  return <Link className={`society-button${secondary ? ' society-button--secondary' : ''}`} to={href}>{children}<Arrow external={href.startsWith('https:')} /></Link>
}
export function Emblem({ className = '' }) {
  return <span className={`society-emblem ${className}`} aria-hidden="true" />
}
export function Hero({ title, children, actions }) {
  return <header className="society-hero">
    <PixelScene small />
    <div className="society-hero__copy"><h1>{title}</h1><p>{children}</p>{actions && <div className="society-actions">{actions}</div>}</div>
  </header>
}
export function Upcoming() {
  return <section className="society-section society-upcoming" aria-labelledby="coming-soon-title">
    <h2 id="coming-soon-title">Coming soon</h2>
    <div className="society-upcoming__items"><p><strong>Startup scheme</strong><span>Coming soon</span></p><p><strong>LICA</strong><span>Coming soon</span></p></div>
  </section>
}
export function Partnerships() {
  return <section className="society-section society-partners" id="opportunities" aria-label="Our partnerships">
    <article className="society-partner">
      <div className="society-partner__name"><h2>Headstart</h2><span>Experience</span></div>
      <div><h3>Get experience on real projects.</h3><p>Build career skills through mentored startup micro-internships, working on real projects and developing your portfolio.</p><Link className="society-text-link" to={links.headstart}>Visit Headstart <Arrow external /></Link></div>
    </article>
    <article className="society-partner">
      <div className="society-partner__name"><h2><img className="society-career26-logo" src="/img/design/career26.webp" alt="Career26" width="180" height="35" loading="lazy" /></h2><span>Career development</span></div>
      <div><h3>Eight weeks. Free for our students.</h3><p>Our Career26 partnership offers an exclusive eight-week finance course taught by former industry professionals.</p><p>Strong performers can be considered for referrals.</p><Link className="society-text-link" to={links.career26}>Explore Career26 Academy <Arrow external /></Link></div>
    </article>
  </section>
}
export function ProgrammeGrid() {
  return <div className="society-programmes" id="programmes">
    <Link to={links.nexus} className="society-nexus-feature">
      <div className="society-nexus-feature__copy"><h2>Nexus Labs</h2><p>Our research division. Find a team and develop an AI research project with academic and industry support.</p><span className="society-text-link">Explore Nexus Labs <Arrow /></span></div>
      <div className="society-nexus-feature__details"><ul>{pillars.map(pillar => <li key={pillar.path}>{pillar.title}</li>)}</ul><p>Applications close<br/><time dateTime="2026-10-23">Friday 23 October</time></p></div>
    </Link>
    <Link to={links.agentverse} className="society-agentverse-feature">
      <div><img className="society-agentverse-wordmark" src="/img/design/agentverse-wordmark.webp" alt="AgentVerse" width="640" height="109" loading="lazy" /><h2 className="society-sr-only">AgentVerse</h2><p>Our student AI hackathon.</p><span className="society-text-link">Explore AgentVerse <Arrow external /></span></div>
      <div className="society-mini-pixels" aria-hidden="true"><span/><span/><span/><span/><span/><span/></div>
    </Link>
    <Link to={links.tutorials} className="society-resource"><div><h2>Machine learning tutorials</h2><p>Learn the foundations and put them into practice.</p></div><Arrow /></Link>
    <Link to={links.journal} className="society-resource"><div><h2>Journal Club</h2><p>Read and discuss AI research with other students.</p></div><Arrow /></Link>
    <Link to={links.opportunities} className="society-resource society-resource--wide"><div><h2>Partnerships & opportunities</h2><p>Career support and practical experience through Headstart and Career26.</p></div><Arrow /></Link>
  </div>
}
