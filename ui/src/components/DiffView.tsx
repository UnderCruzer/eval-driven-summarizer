interface Props {
  baseVersion: string
  newVersion: string
  newSystem: string
  newUser: string
  onSystemChange: (v: string) => void
  onUserChange: (v: string) => void
}

export function DiffView({
  baseVersion,
  newVersion,
  newSystem,
  newUser,
  onSystemChange,
  onUserChange,
}: Props) {
  return (
    <div className="diff-grid">
      <div className="diff-col">
        <h3>
          현재 프롬프트 <span className="tag tag-current">{baseVersion}</span>
        </h3>
        <h4>System Prompt</h4>
        <textarea readOnly rows={4} value="(현재 적용 중인 버전의 system prompt)" />
        <h4>User Template</h4>
        <textarea readOnly rows={6} value="(현재 적용 중인 버전의 user template)" />
      </div>

      <div className="diff-col">
        <h3>
          제안 프롬프트 <span className="tag tag-new">{newVersion}</span>
        </h3>
        <h4>
          System Prompt{' '}
          <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(수정 가능)</small>
        </h4>
        <textarea
          rows={4}
          value={newSystem}
          onChange={(e) => onSystemChange(e.target.value)}
        />
        <h4>
          User Template{' '}
          <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(수정 가능)</small>
        </h4>
        <textarea
          rows={6}
          value={newUser}
          onChange={(e) => onUserChange(e.target.value)}
        />
      </div>
    </div>
  )
}
