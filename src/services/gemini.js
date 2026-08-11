import { GoogleGenAI } from '@google/genai'
import { SAJU_SYSTEM_PROMPT } from '../prompts/sajuPrompt.js'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY

if (!apiKey) {
  console.warn('VITE_GEMINI_API_KEY가 .env에 설정되어 있지 않습니다.')
}

const ai = new GoogleGenAI({ apiKey })

/**
 * 사용자 입력 정보로 Gemini API에 사주 해석을 요청합니다.
 */
export async function getSajuReading({ name, birthDate, birthTime, gender, calendarType, birthTimeLabel }) {
  if (!apiKey) {
    throw new Error('API 키가 없습니다. .env 파일에 VITE_GEMINI_API_KEY를 설정해 주세요.')
  }

  const genderLabel = gender === 'male' ? '남성' : gender === 'female' ? '여성' : ''
  const calendarLabel = calendarType === 'solar' ? '양력' : calendarType === 'lunar' ? '음력' : ''

  const userMessage = `
다음 사용자 정보를 바탕으로 사주 명식을 계산하고 기본 차트 해석을 해 주세요.

이름: ${name}
생년월일: ${birthDate} (${calendarLabel})
태어난 시간: ${birthTimeLabel || birthTime}
성별: ${genderLabel}
`.trim()

  // gemini-2.5-flash는 신규 사용자에게 더 이상 제공되지 않습니다.
  // Interactions API + 최신 모델(gemini-3.6-flash)을 사용합니다.
  const interaction = await ai.interactions.create({
    model: 'gemini-3.6-flash',
    input: userMessage,
    system_instruction: SAJU_SYSTEM_PROMPT,
  })

  const text = interaction.output_text
  if (!text) {
    throw new Error('Gemini API에서 응답을 받지 못했습니다.')
  }

  return text
}
