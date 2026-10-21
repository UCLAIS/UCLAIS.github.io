import React from 'react'
import { Page, Hero, Partnerships, Button } from './shared'
import { links } from './content'

export default function Opportunities() {
  return <Page title="Partnerships & opportunities" description="Career building, startup micro-internships and an exclusive free eight-week course through UCL AI Society partnerships.">
    <Hero title={<>Partnerships &<br/>opportunities</>}>We work with companies to give students practical experience and help with their next steps.</Hero>
    <Partnerships />
    <section className="society-section society-opportunities-follow"><h2>Hear about the next opportunity.</h2><p>We share society opportunities through our newsletter.</p><Button href={links.newsletter}>Get the newsletter</Button></section>
  </Page>
}
