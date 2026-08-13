const DECORS = [
  { src: '/moon.png', className: 'sky-decor sky-decor-moon' },
  { src: '/star2.png', className: 'sky-decor sky-decor-star-y1' },
  { src: '/star3.png', className: 'sky-decor sky-decor-star-w1' },
  { src: '/star1.png', className: 'sky-decor sky-decor-star-p1' },
  { src: '/star2.png', className: 'sky-decor sky-decor-star-y2' },
  { src: '/star3.png', className: 'sky-decor sky-decor-star-w2' },
  { src: '/star1.png', className: 'sky-decor sky-decor-star-p2' },
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
