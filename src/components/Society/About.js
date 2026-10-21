import React from 'react'
import Link from '@docusaurus/Link'
import { Page, Hero, Button, Arrow } from './shared'
import { links } from './content'
import committee from '../../data/committee'

const cleanText = value => String(value || '').replace(/[\u2013\u2014]/g, '-')

export default function About() {
  return (
    <Page title="About Us" description="UCL AI Society brings students together to learn, research and build AI with safety, ethics and people at the centre.">
      <Hero title="About Us" actions={<Button href={links.membership}>Join us</Button>} compact>
        A student community for learning, building and researching AI, safely and ethically.
      </Hero>
      <section className="society-section society-about" aria-labelledby="about-title">
        <div className="society-section__intro"><h2 id="about-title">A society for everyone interested in AI.</h2><p>UCL AI Society brings together students who want to understand AI, use it thoughtfully and help shape its future.</p></div>
        <p className="society-about__statement">We want AI to be useful to people. That means asking what a system can do, where it can fail and who is affected by the way it is built and used.</p>
        <p>Our community connects technical work with questions about safety, fairness, privacy and accountability. You can learn the foundations, join a research team or build with others, while thinking critically about the consequences.</p>
      </section>
      <section className="society-section" aria-labelledby="goals-title">
        <h2 id="goals-title">Our goals</h2>
        <div className="society-goals">
          <article><h3>Make AI accessible</h3><p>Give students from different backgrounds a way to understand AI and develop practical skills.</p></article>
          <article><h3>Support student research</h3><p>Help students find collaborators, explore questions and develop work they can share with the wider research community.</p></article>
          <article><h3>Open up opportunities</h3><p>Connect students with researchers, companies and each other through projects, events and career-building partnerships.</p></article>
        </div>
      </section>
      <section className="society-section" aria-labelledby="ethics-title">
        <div className="society-section__intro"><h2 id="ethics-title">Safe and ethical AI</h2><p>The eight principles we stand by.</p></div>
        <ol className="society-principles">
          {['Never Build for Lethality', 'Never Use AI to Impersonate a Human', 'Defend Human Creativity', 'Welcome Every Student', 'Ask Anything, Help Anyone', 'Build, Don’t Regurgitate', 'Question the Hype', 'No AI Slop'].map(principle => <li key={principle}>{principle}</li>)}
        </ol>
      </section>
      <section className="society-section society-about-opportunities"><h2>Connections beyond the classroom.</h2><p>Our partnerships give students practical experience and career support.</p><Link className="society-text-link" to={links.opportunities}>Explore our opportunities <Arrow /></Link></section>
      <section className="society-section society-committee" aria-labelledby="committee-title">
        <details><summary id="committee-title">Meet the committee</summary><div className="society-committee__groups">
          {committee.categories.map(category => <section key={category.title}><h3>{cleanText(category.title)}</h3><div className="society-member-grid">{category.members.map(member => <article className="society-member" key={member.name}>
            {member.image && <img src={`/img/committee/${encodeURIComponent(member.image)}`} alt={member.name} width="88" height="104" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} />}
            <div><h4>{member.linkedin ? <Link to={member.linkedin}>{member.name}</Link> : member.name}</h4><p>{cleanText(member.position)}</p>{member.course && <p className="society-member__course">{cleanText(member.course)}{member.year && `, ${cleanText(member.year)}`}</p>}</div>
          </article>)}</div></section>)}
        </div></details>
      </section>
    </Page>
  )
}
