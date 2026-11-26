import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { CourseShell } from '@/components/courses/CourseShell'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Courses', robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
export default function Layout({ children }: { children: ReactNode }) { return <CourseShell>{children}</CourseShell> }
