import { useEffect, useState } from 'react'
import { fetchVersions } from '../../api/client'
import type { VersionAvg } from '../../types'

const METRICS = [
  { key: 'key_point_coverage', label: 'Coverage' },
  { key: 'faithfulness',       label: 'Faithfulness' },
  { key: 'information_loss',   label: 'Info Loss' },
  { key: 'length_adequacy',    label: 'Length' },
] as const

const GRADES = ['A', 'B', 'C', 'F']
const GRADE_COLOR: Record<string, string> = {
  A: 'var(--green)', B: 'var(--yellow)', C: '#f97316', F: 'var(--red)',
}

export function VersionTab() {
  const [averages, setAverages] = useState<VersionAvg[]>([])
  const [gradeDist, setGradeDist] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    fetchVersions().then((d) => {
      setAverages(d.averages)
      setGradeDist(d.grade_dist)
    })
  }, [])

  if (!averages.length) {
    return <p className="dash-empty">아직 Eval 결과가 없습니다.</p>
  }

  const maxScore = 5

  return (
    <div className="dash-section">
      <h3 className="dash-title">버전별 평균 총점</h3>
      <div className="bar-chart">
        {averages.map((v) => (
          <div className="bar-row" key={v.prompt_version}>
            <span className="bar-label">{v.prompt_version}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(v.total_score / maxScore) * 100}%` }}
              />
            </div>
            <span className="bar-value">{v.total_score}</span>
          </div>
        ))}
      </div>

      <h3 className="dash-title" style={{ marginTop: 32 }}>지표별 점수 추이</h3>
      <div className="line-chart-wrap">
        <table className="metric-table">
          <thead>
            <tr>
              <th>버전</th>
              {METRICS.map((m) => <th key={m.key}>{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {averages.map((v) => (
              <tr key={v.prompt_version}>
                <td><span className="tag tag-current">{v.prompt_version}</span></td>
                {METRICS.map((m) => (
                  <td key={m.key} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {v[m.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="dash-title" style={{ marginTop: 32 }}>등급 분포</h3>
      <div className="grade-dist">
        {averages.map((v) => (
          <div key={v.prompt_version} className="grade-col">
            <div className="grade-version">{v.prompt_version}</div>
            {GRADES.map((g) => {
              const cnt = gradeDist[v.prompt_version]?.[g] ?? 0
              if (!cnt) return null
              return (
                <div key={g} className="grade-chip" style={{ borderColor: GRADE_COLOR[g], color: GRADE_COLOR[g] }}>
                  {g} × {cnt}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
