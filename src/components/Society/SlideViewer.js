import React, { useEffect, useRef, useState } from 'react'
import useBaseUrl from '@docusaurus/useBaseUrl'
import styles from './knowledge.module.css'

export default function SlideViewer({ presentation, title }) {
  const [index, setIndex] = useState(0)
  const [canExpand, setCanExpand] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState('')
  const frame = useRef(null)
  const slide = presentation.slides[index]
  const src = useBaseUrl(slide.src)
  useEffect(() => {
    setCanExpand(!!document.fullscreenEnabled && !!frame.current?.requestFullscreen)
    const update = () => setExpanded(document.fullscreenElement === frame.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  async function expand() {
    try {
      if (expanded) await document.exitFullscreen()
      else await frame.current.requestFullscreen()
      setMessage('')
    } catch { setMessage('Full screen is unavailable. Open the PDF below to view it separately.') }
  }
  return <section className={styles.viewer} aria-label={`${title} slides`} ref={frame} tabIndex={0} onKeyDown={event => {
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
    if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(value => Math.min(presentation.slides.length - 1, value + 1)) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(value => Math.max(0, value - 1)) }
  }}>
    <div className={styles.slideStage} style={{ aspectRatio: `${slide.width} / ${slide.height}` }}>
      <img src={src} width={slide.width} height={slide.height} alt={`${title}, slide ${index + 1} of ${presentation.slides.length}`} decoding="async" />
    </div>
    <div className={styles.slideControls}>
      <button type="button" onClick={() => setIndex(value => Math.max(0, value - 1))} disabled={index === 0}>Previous</button>
      <label>Slide <select aria-label="Slide number" value={index} onChange={event => setIndex(Number(event.target.value))}>{presentation.slides.map((_, position) => <option key={position} value={position}>{position + 1}</option>)}</select> of {presentation.slides.length}</label>
      <button type="button" onClick={() => setIndex(value => Math.min(presentation.slides.length - 1, value + 1))} disabled={index === presentation.slides.length - 1}>Next</button>
      {canExpand && <button className={styles.expandButton} type="button" onClick={expand}>{expanded ? 'Exit full screen' : 'Full screen'}</button>}
    </div>
    {message && <p role="status">{message}</p>}
    <details className={styles.slideText} key={index}><summary>Slide text</summary><p>{slide.text || 'This slide contains visual material. Open the PDF below for the original slide.'}</p></details>
  </section>
}
