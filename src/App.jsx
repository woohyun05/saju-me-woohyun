import { useEffect, useState } from 'react'
import ProfileModal from './components/ProfileModal.jsx'
import { getSajuReading } from './services/gemini.js'
import { supabase } from './lib/supabase.js'
import './App.css'

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

function App() {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileModalMode, setProfileModalMode] = useState('onboarding')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [sajuResult, setSajuResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResultPage, setShowResultPage] = useState(false)
  const [activeReadingId, setActiveReadingId] = useState(null)

  const [readings, setReadings] = useState([])
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

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
      setShowProfileModal(false)
      setProfileLoading(false)
      resetReadingView()
      return
    }

    loadProfile(user.id)
    loadReadings(user.id)
  }, [user])

  useEffect(() => {
    function handlePopState() {
      resetReadingView()
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function resetReadingView() {
    setSajuResult('')
    setShowResultPage(false)
    setActiveReadingId(null)
    setError('')
  }

  async function loadProfile(userId) {
    setProfileLoading(true)
    setProfileError('')

    const { data, error: fetchError } = await supabase
      .from('users')
      .select('id, name, birth_date, birth_time, gender, calendar_type')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error(fetchError)
      setError(fetchError.message || '프로필을 불러오지 못했습니다.')
      setProfileLoading(false)
      return
    }

    if (!data) {
      setProfile(null)
      setProfileModalMode('onboarding')
      setShowProfileModal(true)
    } else {
      setProfile(profileFromRow(data))
      setShowProfileModal(false)
    }

    setProfileLoading(false)
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

  async function handleGoogleSignIn() {
    setError('')
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
    setProfileModalMode('edit')
    setShowProfileModal(true)
  }

  async function handleProfileSubmit(values) {
    if (!user) return

    setProfileSaving(true)
    setProfileError('')

    const payload = {
      id: user.id,
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
      setProfileError(saveError.message || '프로필 저장에 실패했습니다.')
      setProfileSaving(false)
      return
    }

    setProfile(profileFromRow(data))
    setShowProfileModal(false)
    setProfileSaving(false)
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

  async function handleSajuSubmit() {
    if (!user) {
      setError('Google 로그인 후 이용해 주세요.')
      return
    }

    if (!profile) {
      setProfileModalMode('onboarding')
      setShowProfileModal(true)
      return
    }

    setError('')
    setSajuResult('')
    setIsLoading(true)

    try {
      const result = await getSajuReading({
        name: profile.name,
        birthDate: profile.birthDate,
        birthTime: profile.birthTime,
        gender: profile.gender,
        calendarType: profile.calendarType,
        birthTimeLabel: formatBirthTime(profile.birthTime),
      })

      const { data, error: saveError } = await supabase
        .from('saju_readings')
        .insert({
          user_id: user.id,
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
      await loadReadings(user.id)
    } catch (err) {
      setError(err.message || '사주 해석 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const needsOnboarding = Boolean(user && !profileLoading && !profile)
  const modalVisible = showProfileModal && (needsOnboarding || profileModalMode === 'edit')

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
        <button type="button" className="sidebar-auth-btn sidebar-auth-btn-primary" onClick={handleGoogleSignIn}>
          Google로 로그인
        </button>
      )}
    </div>
  )

  const sidebar = (
    <aside className="sidebar">
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

  const profileModal = modalVisible ? (
    <ProfileModal
      key={`${profileModalMode}-${profile?.name ?? 'new'}`}
      mode={needsOnboarding ? 'onboarding' : profileModalMode}
      initialValues={
        needsOnboarding
          ? {
              name: user?.user_metadata?.full_name ?? '',
              birthDate: '',
              birthTime: '',
              gender: '',
              calendarType: '',
            }
          : profile
      }
      isSaving={profileSaving}
      error={profileError}
      onSubmit={handleProfileSubmit}
      onClose={() => {
        if (!needsOnboarding) {
          setShowProfileModal(false)
          setProfileError('')
        }
      }}
    />
  ) : null

  if (showResultPage && sajuResult && profile) {
    return (
      <div className="app-shell">
        {sidebar}
        <div className="page">
          <h1 className="page-title">사주 해석 결과</h1>

          <div className="result-header">
            <p className="result-name">{profile.name} 님의 사주</p>
            <p className="result-meta">
              생년월일: {profile.birthDate}
              <br />
              태어난 시간: {formatBirthTime(profile.birthTime)}
              <br />
              성별: {profile.gender === 'male' ? '남' : profile.gender === 'female' ? '여' : ''}
              <br />
              달력: {profile.calendarType === 'solar' ? '양력' : profile.calendarType === 'lunar' ? '음력' : ''}
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
      </div>
    )
  }

  return (
    <div className="app-shell">
      {sidebar}
      <div className="page">
        <h1 className="page-title">사주 보기</h1>

        {!user ? (
          <div className="guest-panel">
            <p className="guest-text">Google 로그인 후 프로필을 설정하면 사주를 볼 수 있습니다.</p>
            <button
              type="button"
              className="submit-btn"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
            >
              Google로 로그인
            </button>
          </div>
        ) : profileLoading ? (
          <p className="loading-text">프로필을 불러오는 중...</p>
        ) : profile ? (
          <>
            <div className="profile-card">
              <div className="profile-card-header">
                <strong>{profile.name} 님</strong>
                <button type="button" className="profile-edit-link" onClick={openProfileEditor}>
                  수정
                </button>
              </div>
              <p className="profile-card-meta">
                생년월일: {profile.birthDate}
                <br />
                태어난 시간: {formatBirthTime(profile.birthTime)}
                <br />
                성별: {profile.gender === 'male' ? '남' : '여'}
                <br />
                달력: {profile.calendarType === 'solar' ? '양력' : '음력'}
              </p>
            </div>

            <button
              type="button"
              className="submit-btn"
              onClick={handleSajuSubmit}
              disabled={isLoading}
            >
              {isLoading ? '사주 해석 중...' : '사주 보기'}
            </button>

            {isLoading && <p className="loading-text">잠시만 기다려 주세요.</p>}
            {error && <p className="error-msg">{error}</p>}
          </>
        ) : (
          <div className="guest-panel">
            <p className="guest-text">사주 해석을 위해 프로필 정보가 필요합니다.</p>
          </div>
        )}
      </div>
      {profileModal}
    </div>
  )
}

export default App
