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
                      <h3>{member.name}</h3>
                      <h4>{member.position}</h4>
                      <p>
                        {member.course && (
                          <>
                            <strong>Course</strong>: {member.course}
                            <br />
                          </>
                        )}
                        {member.languages && (
                          <>
                            <strong>Languages</strong>: {member.languages}
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
