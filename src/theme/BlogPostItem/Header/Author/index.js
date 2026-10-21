import React from 'react'
import BlogAuthor from '@theme-original/BlogPostItem/Header/Author'
import useBaseUrl from '@docusaurus/useBaseUrl'

export default function Author(props) {
  const imageURL = useBaseUrl(props.author.imageURL)
  return <BlogAuthor {...props} author={{ ...props.author, imageURL }} />
}
