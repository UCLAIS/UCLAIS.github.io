import React from 'react'
import Link from '@docusaurus/Link'
import { useCurrentSidebarCategory, filterDocCardListItems } from '@docusaurus/theme-common'
import { findFirstCategoryLink } from '@docusaurus/theme-common/internal'
import { Arrow } from '../../components/Society/shared'

function CurrentDirectory() {
  const category = useCurrentSidebarCategory()
  return <Directory items={category.items.filter(item => item.href !== category.href)} />
}
function Directory({ items }) {
  return <div className="society-archive-directory">{filterDocCardListItems(items).map((item, index) => {
    const href = item.type === 'category' ? findFirstCategoryLink(item) : item.href
    if (!href) return null
    const title = item.label.replace(/^[^\p{L}\p{N}]+/u, '')
    return <Link to={href} key={`${href}-${index}`}><span>{title}</span><Arrow /></Link>
  })}</div>
}
export default function DocCardList({ items }) {
  return items ? <Directory items={items} /> : <CurrentDirectory />
}
