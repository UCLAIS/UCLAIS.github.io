import React from 'react'
import Link from '@docusaurus/Link'
import { Page, Hero, ProgrammeGrid, Upcoming, Arrow } from './shared'

export default function Initiatives() {
  return <Page title="Our Initiatives" description="Explore Nexus Labs, AgentVerse, machine learning tutorials and Journal Club at UCL AI Society.">
    <Hero title="Our Initiatives">Learn the foundations, join a research team or build at AgentVerse.</Hero>
    <section className="society-section society-section--first" aria-label="Our current initiatives"><ProgrammeGrid /></section>
    <Upcoming />
    <section className="society-section society-more"><h2>More from our community</h2><div><Link to="https://doxaai.com/">DOXA <Arrow external /></Link><Link to="https://climatehack.ai/">ClimateHack.AI <Arrow external /></Link><Link to="https://podcasters.spotify.com/pod/show/ucl-ai-society">Reinforcement Talking podcast <Arrow external /></Link></div></section>
  </Page>
}
