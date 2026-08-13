const DECORS = [
  { src: '/decor-moon.png', className: 'sky-decor sky-decor-moon' },
  { src: '/decor-star-yellow.png', className: 'sky-decor sky-decor-star-y1' },
  { src: '/decor-star-white.png', className: 'sky-decor sky-decor-star-w1' },
  { src: '/decor-star-purple.png', className: 'sky-decor sky-decor-star-p1' },
  { src: '/decor-star-yellow.png', className: 'sky-decor sky-decor-star-y2' },
  { src: '/decor-star-white.png', className: 'sky-decor sky-decor-star-w2' },
  { src: '/decor-star-purple.png', className: 'sky-decor sky-decor-star-p2' },
]

function SkyDecor() {
  return (
    <div className="sky-decor-layer" aria-hidden="true">
      {DECORS.map((item) => (
        <img key={item.className} className={item.className} src={item.src} alt="" />
      ))}
    </div>
  )
}

export default SkyDecor
