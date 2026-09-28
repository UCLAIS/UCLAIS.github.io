import Layout from '@theme/Layout'
import React from 'react'
import styles from './about-us.module.scss'
import Container from '/src/components/Container'
import committee from '/src/data/committee'

export default function Home() {
  const { categories } = committee

  return (
    <Layout title="About Us" description="Our committee">
      <main className={styles.main}>
        <Container>
          <h1 className={styles.pageTitle}>Our Committee</h1>
          {categories.map((category, i) => (
            <div key={i} className={styles.team}>
              <h2 className={styles.teamName}>{category.title}</h2>
              <div className={styles.memberCards}>
                {category.members.map((member, j) => (
                  <div key={j} className={styles.memberCard}>
                    <div className={styles.memberCardImageContainer}>
                      {member.image && (
                        <img
                          src={`/img/committee/${member.image}`}
                          alt={member.name}
                        />
                      )}
                    </div>
                    <div className={styles.memberCardContent}>
                      <h2>{member.name}</h2>
                      <h4>{member.position}</h4>
                      <p>
                        {member.course && (
                          <>
                            <strong>Course</strong>: {member.course}
                            {member.year && (
                              <>
                                <br />
                                {member.year}
                              </>
                            )}
                            <br />
                          </>
                        )}
                        {member.ai_concept && (
                          <>
                            <strong>Favourite AI concept</strong>:{' '}
                            {member.ai_concept}
                            <br />
                          </>
                        )}
                        {member.fact && (
                          <>
                            <strong>Fun Fact</strong>: {member.fact}
                            <br />
                          </>
                        )}
                      </p>
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.linkedinLink}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.475-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
                          </svg>
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Container>
      </main>
    </Layout>
  )
}