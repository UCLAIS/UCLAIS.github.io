import React from 'react'
import Link from '@docusaurus/Link'
import { Page, Hero, ProgrammeGrid, Upcoming, Arrow } from './shared'
import { links } from './content'

export default function Initiatives() {
  return <Page title="Our Initiatives" description="Explore Nexus Labs, AgentVerse and student opportunities, plus the archive of past tutorial and Journal Club materials.">
    <Hero title="Our Initiatives">Join a research team, build at AgentVerse or explore opportunities through our partners.</Hero>
    <section className="society-section society-section--first" aria-label="Our current initiatives"><ProgrammeGrid /></section>
    <Upcoming />
    <section className="society-section society-archive-section" id="archive" aria-labelledby="initiative-archive-title">
      <h2 id="initiative-archive-title">Learning resources</h2>
      <p>Tutorials and Journal Club materials for self-study. Check the events calendar for upcoming sessions.</p>
      <div className="society-archive-links">
        <Link to={links.tutorials}><div><h3>Machine learning tutorials</h3><p>Published tutorials and notebooks, alongside slides and recordings from earlier series.</p></div><Arrow /></Link>
        <Link to={links.journal}><div><h3>Journal Club</h3><p>Notes and slides from past sessions.</p></div><Arrow /></Link>
      </div>
    </section>
    <section className="society-section society-more"><h2>From our podcast archive</h2><div><Link to="https://podcasters.spotify.com/pod/show/ucl-ai-society">Reinforcement Talking podcast <Arrow external /></Link></div></section>
  </Page>
}
