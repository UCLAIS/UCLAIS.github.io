import React from 'react'

// The society's square-grid artwork, rather than AgentVerse's star field.
// Fixed compositions keep spacing and density consistent at every viewport.
const cluster = [
  [0,0,0],[2,0,2],[3,0,1],[6,0,3],
  [0,1,1],[1,1,2],[4,1,0],[6,1,1],[7,1,2],
  [1,2,3],[2,2,0],[3,2,2],[5,2,1],
  [0,3,2],[2,3,1],[4,3,3],[5,3,0],[7,3,1],
  [1,4,0],[3,4,2],[4,4,1],[6,4,3],
  [0,5,1],[1,5,3],[3,5,0],[5,5,2],
  [0,6,0],[2,6,1],[4,6,2],[6,6,0],
  [1,7,2],[2,7,0],[5,7,1],
  [0,8,3],[3,8,1],[4,8,0],
  [1,9,0],[2,9,2],[6,9,1],
  [0,10,1],[4,10,3], [2,11,0],
]

export default function PixelScene({ small = false }) {
  return <div className={`society-pixel-frame${small ? ' society-pixel-frame--small' : ''}`} aria-hidden="true">
    {['left', 'right'].map((side, sideIndex) => <div className={`society-pixel-cluster society-pixel-cluster--${side}`} key={side}>
      {cluster.filter((_, i) => !small || i % 2 === 0).map(([x,y,colour],i) => <span key={i} className={`society-pixel society-pixel--${colour}`} style={{gridColumn:x+1,gridRow:y+1,'--pixel-delay':`${(x+y+sideIndex*3)*35}ms`}} />)}
    </div>)}
  </div>
}
