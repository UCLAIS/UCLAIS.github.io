import React from 'react'
import Link from '@docusaurus/Link'
import { Page, Button, Arrow, Emblem } from './shared'
import PixelScene from './PixelScene'
import { links } from './content'

export default function Home() {
  return <Page title="Home" description="UCL's AI community. Learn, research and build together, with safe and ethical AI at the centre.">
    <header className="society-home-hero">
      <PixelScene />
      <Emblem />
      <h1>UCL Artificial<br/>Intelligence Society</h1>
      <p>For everyone curious about AI. Learn, research and build with us.</p>
      <div className="society-actions"><Button href={links.opportunities}>See events & opportunities</Button><Link className="society-text-link" to={links.membership}>Join the society <Arrow external /></Link></div>
    </header>
    <nav className="society-section society-home-directory" aria-labelledby="home-directory-title">
      <h2 id="home-directory-title">Explore the society</h2>
      <div className="society-home-directory__pages">
        <Link to={links.opportunities}><div><h3>Events & opportunities</h3><p>Our calendar, partner events and career support.</p></div><Arrow /></Link>
        <Link to={links.initiatives}><div><h3>Our Initiatives</h3><p>Research with Nexus Labs. Build at AgentVerse.</p></div><Arrow /></Link>
        <Link to="/about-us/"><div><h3>About Us</h3><p>Our goals, principles and the people behind the society.</p></div><Arrow /></Link>
        <Link to={`${links.initiatives}#archive`}><div><h3>Tutorials & Journal Club</h3><p>Past recordings, slides and notes from our learning archive.</p></div><Arrow /></Link>
      </div>
    </nav>
    <aside className="society-section society-home-news" aria-label="Nexus Labs applications">
      <div><h2>Nexus Labs research applications</h2><p>Join our student research programme. Applications close <time dateTime="2026-10-23">Friday 23 October</time>.</p></div><Link className="society-text-link" to={links.nexus}>Explore Nexus Labs <Arrow /></Link>
    </aside>
    <section className="society-quote society-section" aria-label="Jensen Huang on UCL AI Society">
      <blockquote><p>“UCL AI Society. AI has a society now.”</p><footer>Jensen Huang <span>Founder and CEO, NVIDIA</span></footer></blockquote>
    </section>
  </Page>
}
