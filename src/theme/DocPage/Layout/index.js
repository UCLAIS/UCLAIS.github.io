import React from 'react'
import Layout from '@theme/Layout'

export default function DocPageLayout({ children }) {
  return <Layout wrapperClassName="society-wrapper"><main className="society-page society-document-page">{children}</main></Layout>
}
