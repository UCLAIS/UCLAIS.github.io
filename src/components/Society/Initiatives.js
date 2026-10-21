import React from 'react'
import Link from '@docusaurus/Link'
import { Page, Hero, ProgrammeGrid, Upcoming, Arrow } from './shared'
import { links } from './content'

export default function Initiatives() {
  return <Page title="Our Initiatives" description="Explore Nexus Labs, AgentVerse and student opportunities, plus the archive of past tutorial and Journal Club materials.">
    <Hero title="Our Initiatives">Join a research team, build at AgentVerse or explore opportunities through our partners.</Hero>
    <section className="society-section society-section--first" aria-label="Our current initiatives"><ProgrammeGrid /></section>
    <Upcoming />
    <section className="society-section society-archive-section" aria-labelledby="initiative-archive-title">
      <h2 id="initiative-archive-title">From the archive</h2>
      <p>Learning materials from past years. These are not current programmes or upcoming sessions.</p>
      <div className="society-archive-links">
        <Link to={links.tutorials}><div><h3>Machine learning tutorials</h3><p>Past notebooks, slides and recordings. Current-year materials are not published here yet.</p></div><Arrow /></Link>
        <Link to={links.journal}><div><h3>Journal Club</h3><p>Notes and slides from past sessions.</p></div><Arrow /></Link>
      </div>
    </section>
    <section className="society-section society-more"><h2>More from our community</h2><div><Link to="https://doxaai.com/">DOXA <Arrow external /></Link><Link to="https://climatehack.ai/">ClimateHack.AI <Arrow external /></Link><Link to="https://podcasters.spotify.com/pod/show/ucl-ai-society">Reinforcement Talking podcast <Arrow external /></Link></div></section>
  </Page>
}
