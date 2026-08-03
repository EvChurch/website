export type RockListItem = {
  value: string
  text: string
}

export type RockPhoneValue = {
  number?: string | null
  countryCode?: string | null
  isMessagingEnabled?: boolean
}

export type RockPublicAttribute = {
  attributeGuid: string
  categories?: Array<{ guid?: string | null; name?: string | null }> | null
  configurationValues?: Record<string, string> | null
  description?: string | null
  fieldTypeGuid: string
  isRequired: boolean
  key?: string | null
  name?: string | null
  order: number
  postHtml?: string | null
  preHtml?: string | null
  securityGrantToken?: string | null
}

export type RockConnectionSignupInitialization = {
  attributes?: Record<string, RockPublicAttribute> | null
  campuses?: RockListItem[] | null
  commentFieldLabel?: string | null
  disableCaptchaSupport: boolean
  displayHomePhone: boolean
  displayMobilePhone: boolean
  email?: string | null
  errorMessage?: string | null
  firstName?: string | null
  homePhone?: RockPhoneValue | null
  lastName?: string | null
  mobilePhone?: RockPhoneValue | null
  navigationUrls?: Record<string, string> | null
  securityGrantToken?: string | null
  selectedCampusId?: number | null
}

export type RockObsidianBlockConfig = {
  blockGuid: string
  blockTypeGuid: string
  configurationValues?: unknown
}

export type RockConnectionSignupRequestBag = {
  firstName: string
  lastName: string
  email: string
  campusId?: number | null
  homePhone?: RockPhoneValue | null
  mobilePhone?: RockPhoneValue | null
  comments?: string | null
  attributeValues?: Record<string, string> | null
}

export type RockConnectionSignupResult = {
  resultType: number
  responseMessage?: string | null
}

export type RockConnectionSignupOption = {
  blockGuid: string
  label: string
}

export type RockConnectionSignupAttribute = {
  attributeGuid: string
  configurationValues: Record<string, string>
  description: string
  fieldTypeGuid: string
  isRequired: boolean
  key: string
  name: string
  order: number
}

export type RockConnectionSignupSchema = {
  pageGuid: string
  blockGuid: string
  blockTypeGuid: string
  opportunityGuid: string
  opportunityName: string
  sessionGuid: string
  interactionGuid: string
  attributes: RockConnectionSignupAttribute[]
  campuses: RockListItem[]
  commentFieldLabel: string
  disableCaptchaSupport: true
  displayHomePhone: boolean
  displayMobilePhone: boolean
  selectedCampusId: number | null
  firstName: ''
  lastName: ''
  email: ''
  homePhone: null
  mobilePhone: null
}
