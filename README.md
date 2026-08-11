# 사주 Me (saju-me)

이름, 생년월일, 태어난 시간, 성별, 양력/음력을 입력하면 Gemini API가 사주를 해석해 주는 웹 서비스입니다.

## 주요 기능

- **사주 정보 입력** — 이름, 생년월일, 태어난 시간, 성별, 양력/음력
- **실시간 미리보기** — 입력값이 아래에 바로 반영됩니다
- **AI 사주 해석** — Google Gemini Interactions API(`gemini-3.6-flash`)로 기본 차트 해석
- **결과 페이지** — 해석 결과를 별도 화면에서 소제목(`###`) 단위로 확인

## 기술 스택

- React 19 + Vite 8
- [@google/genai](https://www.npmjs.com/package/@google/genai) (Gemini Interactions API)

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만들고 Gemini API 키를 설정합니다.

```
VITE_GEMINI_API_KEY=your_api_key_here
```

API 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급할 수 있습니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

`.env`를 수정한 뒤에는 개발 서버를 재시작해야 합니다.

## 프로젝트 구조

```
src/
├── App.jsx              # 입력 폼, 결과 페이지 UI
├── App.css              # 모노톤 스타일
├── prompts/
│   └── sajuPrompt.js    # 사주 해석 시스템 프롬프트
└── services/
    └── gemini.js        # Gemini API 호출
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint 실행 |

## 참고

- `.env`는 Git에 포함되지 않습니다. API 키는 로컬에서만 관리하세요.
- 현재 API 키가 프론트엔드에 노출됩니다. 배포 시에는 서버 프록시 사용을 권장합니다.
