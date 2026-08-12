import { useEffect, useState } from 'react'
import { getSajuReading } from './services/gemini.js'
import { supabase } from './lib/supabase.js'
import './App.css'

function App() {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  const [calendarType, setCalendarType] = useState('')

  const [sajuResult, setSajuResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResultPage, setShowResultPage] = useState(false)

  const [readings, setReadings] = useState([])

  useEffect(() => {
    loadReadings()
  }, [])

  useEffect(() => {
    function handlePopState() {
      setName('')
      setBirthDate('')
      setBirthTime('')
      setGender('')
      setCalendarType('')
      setSajuResult('')
      setShowResultPage(false)
      setError('')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  async function loadReadings() {
    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, name, birth_date, birth_time, gender, calendar_type, result, created_at')
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      return
    }

    setReadings(data ?? [])
  }

  function formatBirthTime(time) {
    if (!time) return ''

    const normalized = String(time).slice(0, 5)
    const [hourStr, minute] = normalized.split(':')
    const hour24 = Number(hourStr)

    const ampm = hour24 < 12 ? '오전' : '오후'
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

    return `${ampm} ${hour12}시 ${minute}분`
  }

  function isFormComplete() {
    return name && birthDate && birthTime && gender && calendarType
  }

  function cleanAsterisks(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/\*/g, '')
  }

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

  function enterResultPage() {
    if (window.history.state?.page !== 'result') {
      window.history.pushState({ page: 'result' }, '')
    }
  }

  function openReading(reading) {
    setName(reading.name)
    setBirthDate(reading.birth_date)
    setBirthTime(String(reading.birth_time).slice(0, 5))
    setGender(reading.gender)
    setCalendarType(reading.calendar_type)
    setSajuResult(reading.result)
    setShowResultPage(true)
    setError('')
    enterResultPage()
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

      const { error: saveError } = await supabase.from('saju_readings').insert({
        name,
        birth_date: birthDate,
        birth_time: birthTime,
        gender,
        calendar_type: calendarType,
        result,
      })

      if (saveError) {
        throw new Error(saveError.message || '사주 결과 저장에 실패했습니다.')
      }

      setSajuResult(result)
      setShowResultPage(true)
      enterResultPage()
      await loadReadings()
    } catch (err) {
      setError(err.message || '사주 해석 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const sidebar = (
    <aside className="sidebar">
      <h2 className="sidebar-title">저장된 사주</h2>
      {readings.length === 0 ? (
        <p className="sidebar-empty">아직 저장된 사주가 없습니다.</p>
      ) : (
        <ul className="sidebar-list">
          {readings.map((reading) => (
            <li key={reading.id}>
              <button
                type="button"
                className="sidebar-item"
                onClick={() => openReading(reading)}
              >
                {reading.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )

  if (showResultPage && sajuResult) {
    return (
      <div className="app-shell">
        {sidebar}
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
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {sidebar}
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
    </div>
  )
}

export default App
