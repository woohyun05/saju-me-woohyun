import { useEffect, useState } from 'react'
import ProfileModal from './components/ProfileModal.jsx'
import SkyDecor from './components/SkyDecor.jsx'
import { getSajuReading } from './services/gemini.js'
import { supabase } from './lib/supabase.js'
import './App.css'

const DRAFT_KEY = 'saju_me_draft'
const PENDING_RESULT_KEY = 'saju_me_pending_result'

function profileFromRow(row) {
  if (!row) return null
  return {
    name: row.name,
    birthDate: row.birth_date,
    birthTime: String(row.birth_time).slice(0, 5),
    gender: row.gender,
    calendarType: row.calendar_type,
  }
}

function emptyForm() {
  return {
    name: '',
    birthDate: '',
    birthTime: '',
    gender: '',
    calendarType: '',
  }
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return emptyForm()
    return { ...emptyForm(), ...JSON.parse(raw) }
  } catch {
    return emptyForm()
  }
}

function saveDraft(form) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
}

function isFormComplete(form) {
  return Boolean(form.name && form.birthDate && form.birthTime && form.gender && form.calendarType)
}

function App() {
  const [form, setForm] = useState(loadDraft)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [showLoginGate, setShowLoginGate] = useState(false)

  const [sajuResult, setSajuResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResultPage, setShowResultPage] = useState(false)
  const [activeReadingId, setActiveReadingId] = useState(null)

  const [readings, setReadings] = useState([])
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    saveDraft(form)
  }, [form])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setReadings([])
      setProfileLoading(false)
      setShowProfileModal(false)
      return
    }

    let cancelled = false

    async function bootstrapLoggedInUser() {
      setProfileLoading(true)
      setError('')

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, name, birth_date, birth_time, gender, calendar_type')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (fetchError) {
        console.error(fetchError)
        setError(fetchError.message || '프로필을 불러오지 못했습니다.')
        setProfileLoading(false)
        return
      }

      const pendingResult = sessionStorage.getItem(PENDING_RESULT_KEY) === '1'
      const draft = loadDraft()

      if (data) {
        const loaded = profileFromRow(data)
        setProfile(loaded)
        if (!pendingResult) {
          setForm(loaded)
        }
      } else {
        setProfile(null)
      }

      await loadReadings(user.id)

      if (pendingResult && isFormComplete(draft)) {
        sessionStorage.removeItem(PENDING_RESULT_KEY)
        setForm(draft)
        setShowLoginGate(false)
        setProfileLoading(false)
        await runSajuReading(draft, user.id)
        return
      }

      sessionStorage.removeItem(PENDING_RESULT_KEY)
      setProfileLoading(false)
    }

    bootstrapLoggedInUser()

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    function handlePopState() {
      resetReadingView()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetReadingView() {
    setSajuResult('')
    setShowResultPage(false)
    setActiveReadingId(null)
    setError('')
  }

  async function loadReadings(userId) {
    const { data, error: fetchError } = await supabase
      .from('saju_readings')
      .select('id, result, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      return
    }

    setReadings(data ?? [])
  }

  async function upsertProfile(userId, values) {
    const payload = {
      id: userId,
      name: values.name,
      birth_date: values.birthDate,
      birth_time: values.birthTime,
      gender: values.gender,
      calendar_type: values.calendarType,
      updated_at: new Date().toISOString(),
    }

    const { data, error: saveError } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select('id, name, birth_date, birth_time, gender, calendar_type')
      .single()

    if (saveError) {
      throw new Error(saveError.message || '프로필 저장에 실패했습니다.')
    }

    const next = profileFromRow(data)
    setProfile(next)
    return next
  }

  async function handleGoogleSignIn() {
    setError('')
    saveDraft(form)
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (signInError) {
      setError(signInError.message || 'Google 로그인에 실패했습니다.')
    }
  }

  async function handleSignOut() {
    setError('')
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError(signOutError.message || '로그아웃에 실패했습니다.')
    }
  }

  function openProfileEditor() {
    setProfileError('')
    setShowProfileModal(true)
  }

  async function handleProfileSubmit(values) {
    if (!user) return

    setProfileSaving(true)
    setProfileError('')

    try {
      const next = await upsertProfile(user.id, values)
      setForm(next)
      setShowProfileModal(false)
    } catch (err) {
      setProfileError(err.message || '프로필 저장에 실패했습니다.')
    } finally {
      setProfileSaving(false)
    }
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

  function formatReadingDate(iso) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '사주 기록'

    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
    setSajuResult(reading.result)
    setActiveReadingId(reading.id)
    setShowResultPage(true)
    setError('')
    enterResultPage()
  }

  function startNewReading() {
    resetReadingView()
  }

  async function deleteReading(id) {
    if (!window.confirm('이 사주 기록을 삭제할까요?')) return

    setError('')
    const { error: deleteError } = await supabase.from('saju_readings').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message || '삭제에 실패했습니다.')
      return
    }

    if (activeReadingId === id) {
      resetReadingView()
      if (window.history.state?.page === 'result') {
        window.history.back()
      }
    }

    if (user) {
      await loadReadings(user.id)
    }
  }

  async function runSajuReading(values, userId) {
    setError('')
    setSajuResult('')
    setIsLoading(true)
    setShowLoginGate(false)

    try {
      await upsertProfile(userId, values)

      const result = await getSajuReading({
        name: values.name,
        birthDate: values.birthDate,
        birthTime: values.birthTime,
        gender: values.gender,
        calendarType: values.calendarType,
        birthTimeLabel: formatBirthTime(values.birthTime),
      })

      const { data, error: saveError } = await supabase
        .from('saju_readings')
        .insert({
          user_id: userId,
          result,
        })
        .select('id')
        .single()

      if (saveError) {
        throw new Error(saveError.message || '사주 결과 저장에 실패했습니다.')
      }

      setActiveReadingId(data.id)
      setSajuResult(result)
      setShowResultPage(true)
      enterResultPage()
      await loadReadings(userId)
    } catch (err) {
      setError(err.message || '사주 해석 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSajuSubmit() {
    if (!isFormComplete(form)) {
      setError('모든 항목을 입력해 주세요.')
      return
    }

    saveDraft(form)

    if (!user) {
      sessionStorage.setItem(PENDING_RESULT_KEY, '1')
      setShowLoginGate(true)
      setError('')
      return
    }

    await runSajuReading(form, user.id)
  }

  const displayInfo = profile ?? (isFormComplete(form) ? form : null)

  const authSection = (
    <div className="sidebar-auth">
      {authLoading ? (
        <p className="sidebar-auth-status">로그인 확인 중...</p>
      ) : user ? (
        <>
          <p className="sidebar-auth-email" title={user.email ?? ''}>
            {profile?.name || user.user_metadata?.full_name || user.email}
          </p>
          {profile && (
            <button type="button" className="sidebar-auth-btn" onClick={openProfileEditor}>
              프로필 수정
            </button>
          )}
          <button type="button" className="sidebar-auth-btn" onClick={handleSignOut}>
            로그아웃
          </button>
        </>
      ) : (
        <button type="button" className="sidebar-auth-btn" onClick={handleGoogleSignIn}>
          Google로 로그인
        </button>
      )}
    </div>
  )

  const sidebar = (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          className="mascot mascot-sidebar"
          src="/mascot.png"
          alt=""
          width={56}
          height={56}
        />
        <span className="sidebar-brand-text">사주 Me</span>
      </div>
      <div className="sidebar-header">
        <h2 className="sidebar-title">내 사주 기록</h2>
        <button type="button" className="sidebar-new-btn" onClick={startNewReading}>
          새로 보기
        </button>
      </div>
      {!user ? (
        <p className="sidebar-empty">로그인하면 사주 기록이 여기에 저장됩니다.</p>
      ) : readings.length === 0 ? (
        <p className="sidebar-empty">아직 저장된 사주가 없습니다.</p>
      ) : (
        <ul className="sidebar-list">
          {readings.map((reading) => (
            <li key={reading.id} className="sidebar-row">
              <button
                type="button"
                className={`sidebar-item${activeReadingId === reading.id ? ' is-active' : ''}`}
                onClick={() => openReading(reading)}
              >
                {formatReadingDate(reading.created_at)}
              </button>
              <button
                type="button"
                className="sidebar-delete-btn"
                aria-label={`${formatReadingDate(reading.created_at)} 삭제`}
                onClick={() => deleteReading(reading.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {authSection}
    </aside>
  )

  const profileModal = showProfileModal && user ? (
    <ProfileModal
      key={`edit-${profile?.name ?? 'profile'}`}
      mode="edit"
      initialValues={profile ?? form}
      isSaving={profileSaving}
      error={profileError}
      onSubmit={handleProfileSubmit}
      onClose={() => {
        setShowProfileModal(false)
        setProfileError('')
      }}
    />
  ) : null

  const loginGate = showLoginGate ? (
    <div className="modal-overlay" role="presentation">
      <div className="modal-panel login-gate" role="dialog" aria-modal="true" aria-labelledby="login-gate-title">
        <img className="mascot mascot-gate" src="/mascot.png" alt="" width={72} height={72} />
        <h2 id="login-gate-title" className="modal-title">
          결과를 보려면 로그인이 필요해요
        </h2>
        <p className="modal-desc">
          입력하신 정보는 그대로 유지됩니다. Google 로그인 후 사주 해석 결과를 바로 확인할 수 있어요.
        </p>
        <button type="button" className="submit-btn modal-submit-btn" onClick={handleGoogleSignIn}>
          Google로 로그인하고 결과 보기
        </button>
        <button
          type="button"
          className="cancel-btn modal-cancel-btn"
          onClick={() => {
            setShowLoginGate(false)
            sessionStorage.removeItem(PENDING_RESULT_KEY)
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  ) : null

  const brandMark = (
    <div className="brand-mark">
      <img
        className="mascot mascot-result"
        src="/mascot.png"
        alt=""
        width={88}
        height={88}
      />
      <span className="brand-mark-text">사주 Me</span>
    </div>
  )

  const inputForm = (
    <div className="input-form">
      <div className="form-group">
        <label className="form-label" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          className="form-input"
          type="text"
          value={form.name}
          onChange={(e) => updateForm('name', e.target.value)}
          placeholder="이름을 입력하세요"
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="birthDate">
          생년월일
        </label>
        <input
          id="birthDate"
          className="form-input"
          type="date"
          value={form.birthDate}
          onChange={(e) => updateForm('birthDate', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="birthTime">
          태어난 시간
        </label>
        <input
          id="birthTime"
          className="form-input"
          type="time"
          value={form.birthTime}
          onChange={(e) => updateForm('birthTime', e.target.value)}
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
              checked={form.gender === 'male'}
              onChange={(e) => updateForm('gender', e.target.value)}
            />
            남성
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="gender"
              value="female"
              checked={form.gender === 'female'}
              onChange={(e) => updateForm('gender', e.target.value)}
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
              checked={form.calendarType === 'solar'}
              onChange={(e) => updateForm('calendarType', e.target.value)}
            />
            양력
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="calendarType"
              value="lunar"
              checked={form.calendarType === 'lunar'}
              onChange={(e) => updateForm('calendarType', e.target.value)}
            />
            음력
          </label>
        </div>
      </div>
    </div>
  )

  if (showResultPage && sajuResult && displayInfo) {
    return (
      <div className="app-shell">
        <SkyDecor />
        {sidebar}
        <div className="page page-result">
          {brandMark}
          <h1 className="page-title">사주 해석 결과</h1>

          <div className="result-header">
            <p className="result-name">{displayInfo.name} 님의 사주</p>
            <p className="result-meta">
              생년월일: {displayInfo.birthDate}
              <br />
              태어난 시간: {formatBirthTime(displayInfo.birthTime)}
              <br />
              성별: {displayInfo.gender === 'male' ? '남' : displayInfo.gender === 'female' ? '여' : ''}
              <br />
              달력: {displayInfo.calendarType === 'solar' ? '양력' : displayInfo.calendarType === 'lunar' ? '음력' : ''}
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

          {activeReadingId && (
            <div className="result-actions">
              <button type="button" className="action-btn" onClick={startNewReading}>
                다시 보기
              </button>
              <button
                type="button"
                className="action-btn action-btn-danger"
                onClick={() => deleteReading(activeReadingId)}
              >
                삭제
              </button>
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}
        </div>
        {profileModal}
        {loginGate}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <SkyDecor />
      {sidebar}
      <div className="page page-home">
        {user && profileLoading ? (
          <p className="loading-text">프로필을 불러오는 중...</p>
        ) : isLoading ? (
          <section className="home-panel">
            <p className="brand-name brand-name-compact">사주 Me</p>
            <div className="reading-wait" aria-live="polite">
              <img className="mascot mascot-loading" src="/mascot.png" alt="" width={96} height={96} />
              <p className="loading-text">별자리를 읽는 중이에요...</p>
            </div>
          </section>
        ) : (
          <section className="home-panel">
            <p className="brand-name brand-name-compact">사주 Me</p>
            <img
              className="mascot mascot-home"
              src="/mascot.png"
              alt="사주 Me 마스코트"
              width={140}
              height={140}
            />
            <p className="hero-copy hero-copy-compact">
              {user
                ? '정보를 확인하고 사주를 읽어 보세요.'
                : '먼저 정보를 입력해 보세요. 결과는 로그인 후 확인할 수 있어요.'}
            </p>

            {inputForm}

            <div className="preview-box">
              <strong>{form.name ? `${form.name} 님의 사주` : '입력 미리보기'}</strong>
              생년월일: {form.birthDate || '-'}
              <br />
              태어난 시간: {formatBirthTime(form.birthTime) || '-'}
              <br />
              성별: {form.gender === 'male' ? '남' : form.gender === 'female' ? '여' : '-'}
              <br />
              달력: {form.calendarType === 'solar' ? '양력' : form.calendarType === 'lunar' ? '음력' : '-'}
            </div>

            <button
              type="button"
              className="submit-btn"
              onClick={handleSajuSubmit}
              disabled={!isFormComplete(form)}
            >
              결과 보기
            </button>

            {!user && (
              <p className="gate-hint">결과 확인 시 Google 로그인이 필요합니다.</p>
            )}

            {error && <p className="error-msg">{error}</p>}
          </section>
        )}
      </div>
      {profileModal}
      {loginGate}
    </div>
  )
}

export default App
