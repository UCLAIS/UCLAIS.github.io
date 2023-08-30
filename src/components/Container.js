import React from 'react'
import styles from './Container.module.scss'

export default function Container({ children }) {
  return <div className={styles.container}>{children}</div>
}
