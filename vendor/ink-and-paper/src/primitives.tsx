import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { easeOutExpo, prefersReducedMotion } from './motion'

type Delay = { delay?: number }
const delayStyle = (delay?: number, extra?: CSSProperties) =>
  ({ ...(delay ? { '--d': `${delay}ms` } : {}), ...extra }) as CSSProperties

/** Headline lines that rise through their own masks, staggered. The element gets is-in when seen. */
export function Lines({
  lines,
  as: Tag = 'h2',
  className,
  stagger = 70,
  delay = 0,
}: {
  lines: ReactNode[]
  as?: 'h1' | 'h2' | 'h3' | 'div'
  className?: string
  stagger?: number
  delay?: number
}) {
  return (
    <Tag className={className} data-io="">
      {lines.map((line, i) => (
        <span className="mask" key={i}>
          <span style={delayStyle(delay + i * stagger)}>{line}</span>
        </span>
      ))}
    </Tag>
  )
}

/** Fades in while rising 18px. */
export function Fade({
  children,
  delay,
  className,
  as: Tag = 'div',
  style,
}: { children: ReactNode; className?: string; as?: 'div' | 'p' | 'span'; style?: CSSProperties } & Delay) {
  return (
    <Tag className={className} data-reveal="fade" data-io="" style={delayStyle(delay, style)}>
      {children}
    </Tag>
  )
}

/** The signature move: a rounded mask opens while the image settles from 115%. */
export function ClipImage({
  src,
  alt,
  className = '',
  pos,
  delay,
  tag,
  style,
  children,
  eager,
  width,
  height,
}: {
  src: string
  alt: string
  className?: string
  pos?: string
  tag?: string
  style?: CSSProperties
  children?: ReactNode
  eager?: boolean
  width?: number
  height?: number
} & Delay) {
  return (
    <div className={`clip ${className}`.trim()} data-io="" style={delayStyle(delay, style)}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        width={width}
        height={height}
        style={delayStyle(delay, pos ? { objectPosition: pos } : undefined)}
      />
      {children}
      {tag && <span className="chip-tag">{tag}</span>}
    </div>
  )
}

export function useInView<T extends Element>(options: IntersectionObserverInit = { threshold: 0.3 }) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(Boolean(e?.isIntersecting)), options)
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [ref, inView] as const
}

/** Counts up once when seen, over about two seconds. Tabular figures so digits don't jitter. */
export function Counter({
  to,
  from = 0,
  duration = 2000,
  prefix = '',
  suffix = '',
  format,
}: {
  to: number
  from?: number
  duration?: number
  prefix?: string
  suffix?: string
  format?: 'count'
}) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.4 })
  const [val, setVal] = useState(prefersReducedMotion() ? to : from)
  // Latch on first sight, so scrolling past mid-count doesn't leave the number stuck partway.
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (inView) setStarted(true)
  }, [inView])
  useEffect(() => {
    if (!started) return
    if (prefersReducedMotion()) return setVal(to)
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setVal(Math.round(from + (to - from) * easeOutExpo(t)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [started, to, from, duration])
  const fmt = (n: number) => (format === 'count' ? n.toLocaleString('en-US') : String(n))
  return (
    <span ref={ref} className="num" aria-label={`${prefix}${fmt(to)}${suffix}`}>
      <span aria-hidden="true">
        {prefix}
        {fmt(val)}
        {suffix}
      </span>
    </span>
  )
}

/** The mono label row above a section: chapter on the left, context on the right. */
export function SectionHead({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="section-head mono">
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  )
}

/** A mark for telling people or series apart without colour (1 to 5, then a numeral). */
export function Mark({ n, label }: { n: number; label?: string }) {
  const k = ((n - 1) % 5) + 1
  return (
    <span className="mark-wrap" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className={`mark mark-${k}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
      {n > 5 && <span className="label num">{n}</span>}
    </span>
  )
}
