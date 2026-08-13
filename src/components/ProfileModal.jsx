import { useState } from 'react'

function ProfileModal({
  mode = 'onboarding',
  initialValues,
  isSaving,
  error,
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [birthDate, setBirthDate] = useState(initialValues?.birthDate ?? '')
  const [birthTime, setBirthTime] = useState(initialValues?.birthTime ?? '')
  const [gender, setGender] = useState(initialValues?.gender ?? '')
  const [calendarType, setCalendarType] = useState(initialValues?.calendarType ?? '')

  const isOnboarding = mode === 'onboarding'
  const isComplete = name && birthDate && birthTime && gender && calendarType

  function handleSubmit(event) {
    event.preventDefault()
    if (!isComplete || isSaving) return

    onSubmit({
      name: name.trim(),
      birthDate,
      birthTime,
      gender,
      calendarType,
    })
  }

  return (
    <div className="modal-overlay" role="presentation">
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        <h2 id="profile-modal-title" className="modal-title">
          {isOnboarding ? '프로필 설정' : '프로필 수정'}
        </h2>
        <p className="modal-desc">
          {isOnboarding
            ? '사주 해석에 필요한 기본 정보를 입력해 주세요. 한 번만 설정하면 다음부터 자동으로 불러옵니다.'
            : '저장된 사주 정보에 반영됩니다.'}
        </p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-name">
              이름
            </label>
            <input
              id="profile-name"
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-birthDate">
              생년월일
            </label>
            <input
              id="profile-birthDate"
              className="form-input"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-birthTime">
              태어난 시간
            </label>
            <input
              id="profile-birthTime"
              className="form-input"
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <span className="form-label">성별</span>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="profile-gender"
                  value="male"
                  checked={gender === 'male'}
                  onChange={(e) => setGender(e.target.value)}
                  required
                />
                남성
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="profile-gender"
                  value="female"
                  checked={gender === 'female'}
                  onChange={(e) => setGender(e.target.value)}
                />
                여성
              </label>
            </div>
          </div>

          <div className="form-group">
            <span className="form-label">달력</span>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="profile-calendarType"
                  value="solar"
                  checked={calendarType === 'solar'}
                  onChange={(e) => setCalendarType(e.target.value)}
                  required
                />
                양력
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="profile-calendarType"
                  value="lunar"
                  checked={calendarType === 'lunar'}
                  onChange={(e) => setCalendarType(e.target.value)}
                />
                음력
              </label>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="modal-actions">
            {!isOnboarding && (
              <button
                type="button"
                className="cancel-btn modal-cancel-btn"
                onClick={onClose}
                disabled={isSaving}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="submit-btn modal-submit-btn"
              disabled={isSaving || !isComplete}
            >
              {isSaving ? '저장 중...' : isOnboarding ? '시작하기' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfileModal
