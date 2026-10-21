import React from 'react'
import Link from '@docusaurus/Link'
import { Page, Hero, Button, Arrow } from './shared'
import { links, pillars } from './content'

export default function Nexus() {
  return (
    <Page title="Nexus Labs" description="Student-led AI research at UCL. Explore four research pillars and apply for the 2026/27 programme." canonical={links.nexus}>
      <Hero title="Nexus Labs" actions={<><Button href={links.researcher}>Apply to Nexus</Button><Button href="#research-pillars" secondary>Explore pillars</Button></>}>
        Find a team, develop an idea and do AI research with academic and industry support.
      </Hero>
      <div className="society-deadline"><p><strong>Nexus Labs 2026/27</strong><span>First-round student applications close <time dateTime="2026-10-23">Friday 23 October</time>.</span></p></div>
      <section className="society-section" aria-labelledby="nexus-process-title">
        <div className="society-section__intro"><h2 id="nexus-process-title">From a question to a project.</h2><p>Nexus Labs is the research division of UCL AI Society. We help students turn shared research interests into work they can present.</p></div>
        <div className="society-process">
          <article><h3>Find your team</h3><p>Tell us what interests you. We group applicants by research interests and help teams form.</p></article>
          <article><h3>Develop the work</h3><p>Share progress through demos and poster sessions, with feedback from peers and researchers.</p></article>
          <article><h3>Share the results</h3><p>Present to students and society partners, with support for strong projects working towards conference submissions.</p></article>
        </div>
      </section>
      <section className="society-section society-pillars" id="research-pillars" aria-labelledby="pillars-title">
        <div className="society-section__intro"><h2 id="pillars-title">Four research pillars.</h2><p>Choose the questions you want to work on.</p></div>
        <div className="society-disclosures">
          {pillars.map(pillar => <details key={pillar.path}><summary>{pillar.title}</summary><div><p>{pillar.text}</p><Link className="society-text-link" to={`${links.nexus}Research%20Pillars/${pillar.path}/`}>Explore this pillar <Arrow /></Link></div></details>)}
        </div>
      </section>
      <section className="society-section" aria-labelledby="tracks-title">
        <div className="society-section__intro"><h2 id="tracks-title">Two ways to research.</h2><p>Both tracks include Nexus events and opportunities to showcase your work.</p></div>
        <div className="society-tracks">
          <article><h3>Advanced</h3><p>For students with solid technical foundations who are ready to commit consistent time to ambitious research.</p><p>Closer mentorship and support from academic and industry researchers. Continued participation depends on progress and engagement.</p></article>
          <article><h3>Exploratory</h3><p>For students discovering research, developing their skills or trying out early ideas.</p><p>A more flexible environment for experimentation and learning. Members may move here from the Advanced track if it becomes a better fit.</p></article>
        </div>
      </section>
      <section className="society-section" aria-labelledby="nexus-involvement-title">
        <h2 id="nexus-involvement-title">Other ways to get involved.</h2>
        <div className="society-role"><div><h3>Become a Pillar Officer</h3><p>Support teams within one of our four pillars. We are looking for research methodology experience and clear, proactive communication.</p></div><Button href={links.officer} secondary>Apply as officer</Button></div>
        <div className="society-role"><div><h3>Become an academic mentor</h3><p>PhD students, postdoctoral researchers and academics can register to guide a student team and provide regular feedback.</p></div><Button href={links.mentor} secondary>Register as mentor</Button></div>
        <p className="society-contact">Questions? Contact co-heads <a href="mailto:edwin.redhead.24@ucl.ac.uk">Edwin Redhead</a> or <a href="mailto:aryan.rishi.24@ucl.ac.uk">Aryan Rishi</a>.</p>
      </section>
    </Page>
  )
}
