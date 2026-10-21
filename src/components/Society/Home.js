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
      <div className="society-actions"><Button href={links.membership}>Join the society</Button><Link className="society-text-link" to={links.initiatives}>Explore our initiatives <Arrow /></Link></div>
    </header>
    <section className="society-quote society-section" aria-label="Jensen Huang on UCL AI Society">
      <blockquote><p>“UCL AI Society. AI has a society now.”</p><footer>Jensen Huang <span>Founder and CEO, NVIDIA</span></footer></blockquote>
    </section>
    <aside className="society-section society-home-news" aria-label="Nexus Labs applications">
      <div><p>Nexus Labs 2026/27</p><h2>Research starts with a question.</h2><p>Join our student research programme. Applications close <time dateTime="2026-10-23">Friday 23 October</time>.</p></div><Link className="society-text-link" to={links.nexus}>Meet Nexus Labs <Arrow /></Link>
    </aside>
    <section className="society-section society-home-directory" aria-label="Explore the society">
      <Link to="/about-us/" className="society-home-directory__about"><Emblem /><div><h2>Curiosity, with responsibility.</h2><p>Open to every student, whatever your degree or experience. Get to know our goals and how we think about safe, ethical AI.</p><span className="society-text-link">About Us <Arrow /></span></div></Link>
      <div className="society-home-directory__links"><Link to={links.initiatives}><h2>Our Initiatives</h2><p>Research, tutorials and AgentVerse.</p><Arrow /></Link><Link to={links.opportunities}><h2>Opportunities</h2><p>Experience and career support from our partners.</p><Arrow /></Link></div>
    </section>
  </Page>
}
