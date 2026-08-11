import { useState } from 'react'
import { getSajuReading } from './services/gemini.js'
import './App.css'

function App() {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  const [calendarType, setCalendarType] = useState('')

  // 사주 해석 결과 / 로딩 / 에러 상태
  const [sajuResult, setSajuResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResultPage, setShowResultPage] = useState(false)

  function formatBirthTime(time) {
    if (!time) return ''

    const [hourStr, minute] = time.split(':')
    const hour24 = Number(hourStr)

    const ampm = hour24 < 12 ? '오전' : '오후'
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

    return `${ampm} ${hour12}시 ${minute}분`
  }

  // 입력값이 모두 채워졌는지 확인
  function isFormComplete() {
    return name && birthDate && birthTime && gender && calendarType
  }

  // 마크다운 * / ** 제거 (가독성)
  function cleanAsterisks(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/\*/g, '')
  }

  // ### 로 시작하는 소제목 기준으로 문단 분리
  function parseResultSections(text) {
    const cleaned = cleanAsterisks(text)

    if (!/^###\s/m.test(cleaned)) {
      return [{ title: null, content: cleaned.trim() }]
    }

    const blocks = []
    const firstMatch = cleaned.match(/^###\s/m)
    const preamble = cleaned.slice(0, firstMatch.index).trim()

    if (preamble) {
      blocks.push({ title: null, content: preamble })
    }

    const sections = cleaned.slice(firstMatch.index).split(/(?=^###\s)/m)
    for (const section of sections) {
      const trimmed = section.trim()
      if (!trimmed) continue

      const lines = trimmed.split('\n')
      const title = lines[0].replace(/^###\s*/, '').trim()
      const content = lines.slice(1).join('\n').trim()
      blocks.push({ title, content })
    }

    return blocks
  }

  async function handleSajuSubmit() {
    if (!isFormComplete()) {
      setError('모든 항목을 입력해 주세요.')
      return
    }

    setError('')
    setSajuResult('')
    setIsLoading(true)

    try {
      const result = await getSajuReading({
        name,
        birthDate,
        birthTime,
        gender,
        calendarType,
        birthTimeLabel: formatBirthTime(birthTime),
      })
      setSajuResult(result)
      setShowResultPage(true)
    } catch (err) {
      setError(err.message || '사주 해석 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (showResultPage && sajuResult) {
    return (
      <div className="page">
        <h1 className="page-title">사주 해석 결과</h1>

        <div className="result-header">
          <p className="result-name">{name} 님의 사주</p>
          <p className="result-meta">
            생년월일: {birthDate}
            <br />
            태어난 시간: {formatBirthTime(birthTime)}
            <br />
            성별: {gender === 'male' ? '남' : gender === 'female' ? '여' : ''}
            <br />
            달력: {calendarType === 'solar' ? '양력' : calendarType === 'lunar' ? '음력' : ''}
          </p>
        </div>

        <div className="result-sections">
          {parseResultSections(sajuResult).map((section, index) => (
            <div key={index} className="result-section">
              {section.title && <h3 className="result-section-title">{section.title}</h3>}
              {section.content && <p className="result-section-content">{section.content}</p>}
            </div>
          ))}
        </div>

        <button type="button" className="back-btn" onClick={() => setShowResultPage(false)}>
          다시 입력하기
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">사주 입력</h1>

      <div className="form-group">
        <label className="form-label" htmlFor="name">이름</label>
        <input
          id="name"
          className="form-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름을 입력하세요"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="birthDate">생년월일</label>
        <input
          id="birthDate"
          className="form-input"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="birthTime">태어난 시간</label>
        <input
          id="birthTime"
          className="form-input"
          type="time"
          value={birthTime}
          onChange={(e) => setBirthTime(e.target.value)}
        />
      </div>

      <div className="form-group">
        <span className="form-label">성별</span>
        <div className="radio-group">
          <label className="radio-label">
            <input
              type="radio"
              name="gender"
              value="male"
              checked={gender === 'male'}
              onChange={(e) => setGender(e.target.value)}
            />
            남성
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="gender"
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
              name="calendarType"
              value="solar"
              checked={calendarType === 'solar'}
              onChange={(e) => setCalendarType(e.target.value)}
            />
            양력
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="calendarType"
              value="lunar"
              checked={calendarType === 'lunar'}
              onChange={(e) => setCalendarType(e.target.value)}
            />
            음력
          </label>
        </div>
      </div>

      <div className="preview-box">
        <strong>{name ? `${name} 님의 사주` : '입력 미리보기'}</strong>
        생년월일: {birthDate || '-'}
        <br />
        태어난 시간: {formatBirthTime(birthTime) || '-'}
        <br />
        성별: {gender === 'male' ? '남' : gender === 'female' ? '여' : '-'}
        <br />
        달력: {calendarType === 'solar' ? '양력' : calendarType === 'lunar' ? '음력' : '-'}
      </div>

      <button
        type="button"
        className="submit-btn"
        onClick={handleSajuSubmit}
        disabled={isLoading || !isFormComplete()}
      >
        {isLoading ? '사주 해석 중...' : '사주 보기'}
      </button>

      {isLoading && <p className="loading-text">잠시만 기다려 주세요.</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  )
}

export default App
