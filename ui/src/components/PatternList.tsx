import type { Pattern } from '../types'

export function PatternList({ patterns }: { patterns: Pattern[] }) {
  if (!patterns.length) return null
  return (
    <div className="patterns">
      <h3>실패 패턴</h3>
      {patterns.map((p, i) => (
        <div className="pattern-item" key={i}>
          <span className="pattern-cat">{p.category}</span>
          <div>
            <div>
              {p.description} — <strong>{p.frequency}건</strong>
            </div>
            <div className="pattern-hint">{p.improvement_hint}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
