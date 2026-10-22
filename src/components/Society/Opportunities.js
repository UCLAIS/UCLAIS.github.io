import React from 'react'
import Link from '@docusaurus/Link'
import { useColorMode } from '@docusaurus/theme-common'
import { Page, Hero, Partnerships, Button } from './shared'
import { links } from './content'

function EventsCalendar() {
  const { colorMode } = useColorMode()
  return <iframe className="society-events__calendar" title="UCL AI Society and partner events on Luma" src={`${links.calendarEmbed}?lt=${colorMode}`} loading="lazy" />
}

export default function Opportunities() {
  return <Page title="Events & opportunities" description="Browse UCL AI Society and partner events on our Luma calendar, then explore career support, micro-internships and partner programmes.">
    <Hero title={<>Events &<br/>opportunities</>}>Find society and partner events, practical experience and career support.</Hero>
    <nav className="society-section society-page-links" aria-label="On this page"><Link to="#events">Events calendar</Link><Link to="#career-opportunities">Career opportunities</Link></nav>
    <section className="society-section society-events" id="events" aria-labelledby="events-calendar-title">
      <h2 id="events-calendar-title">Our events calendar</h2>
      <p>Browse all our society and partner events on Luma, from talks and workshops to hackathons and industry meetups.</p>
      <p>Our partnerships open doors to events such as NVIDIA’s Build-A-Claw in London, where our members heard Jensen Huang speak.</p>
      <Button href={links.calendar}>Open calendar on Luma</Button>
      <EventsCalendar />
      <p className="society-events__fallback">Calendar not loading? <Link to={links.calendar}>View all events directly on Luma.</Link></p>
    </section>
    <Partnerships />
  </Page>
}
