export interface FormFallbackAction {
  label: string
  href: string
}

export const DEFAULT_FORM_FALLBACK_ACTION: FormFallbackAction = {
  label: 'Contact us another way',
  href: '/contact',
}
