'use client'
import { createContext } from 'react'

export type AnswerActivity = 'saved' | 'saving' | 'error' | 'conflict'
export const LessonAnswerActivity = createContext<{ report: (blockId: string, status: AnswerActivity | null) => void } | null>(null)
