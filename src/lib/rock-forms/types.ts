export type RockListItem = {
  value: string
  text: string
  category?: string | null
  disabled?: boolean | null
}

export type RockVisibilityRule = {
  guid: string
  expressionType: number
  rules: Array<{
    attributeGuid?: string | null
    comparisonType?: number | null
    value?: string | null
  }>
  groups?: RockVisibilityRule[] | null
}

export type RockFormSection = {
  id: string
  title?: string | null
  description?: string | null
  isHeadingSeparatorVisible?: boolean
  cssClass?: string | null
  visibilityRule?: RockVisibilityRule | null
}

export type RockFormField = {
  attribute: {
    fieldTypeGuid: string
    attributeGuid: string
    name: string
    key: string
    description?: string | null
    isRequired?: boolean
    order?: number
    configurationValues: Record<string, string>
    preHtml?: string | null
    postHtml?: string | null
    securityGrantToken?: string | null
  }
  isRequired?: boolean
  isLabelHidden?: boolean
  sectionId?: string | null
  columnSize?: number
  preHtml?: string | null
  postHtml?: string | null
  visibilityRule?: RockVisibilityRule | null
  securityGrantToken?: string | null
}

export type RockPersonEntryConfiguration = {
  title?: string | null
  description?: string | null
  showHeadingSeparator?: boolean
  sectionCssClass?: string | null
  preHtml?: string | null
  postHtml?: string | null
  isCampusVisible: boolean
  campuses?: RockListItem[] | null
  genderOption: number
  emailOption: number
  mobilePhoneOption: number
  isSmsVisible: boolean
  addressOption: number
  maritalStatusOption: number
  maritalStatuses?: RockListItem[] | null
  birthDateOption: number
  spouseOption: number
  spouseLabel?: string | null
  raceOption: number
  ethnicityOption: number
}

export type RockPersonBasicValues = {
  firstName?: string | null
  nickName?: string | null
  lastName?: string | null
  personGender?: number | null
  personRace?: string | null
  personEthnicity?: string | null
  personBirthDate?: string | null
  email?: string | null
  mobilePhoneNumber?: string | null
  mobilePhoneCountryCode?: string | null
  isMessagingEnabled?: boolean
  [key: string]: unknown
}

export type RockPersonEntryValues = {
  person: RockPersonBasicValues
  spouse?: RockPersonBasicValues | null
  campusGuid?: string | null
  maritalStatusGuid?: string | null
  address?: Record<string, unknown> | null
}

export type RockFormButton = {
  action: string
  title: string
  html?: string | null
}

export type RockFormSchema = {
  workflowTypeGuid: string
  workflowName: string
  headerHtml: string
  footerHtml: string
  sections: RockFormSection[]
  fields: RockFormField[]
  personEntry: RockPersonEntryConfiguration | null
  initialFieldValues: Record<string, string>
  initialPersonEntryValues: RockPersonEntryValues | null
  buttons: RockFormButton[]
  contextToken: string
  turnstileSiteKey: string
}

export type RockWorkflowOption = {
  guid: string
  name: string
  formBuilderTemplateId?: number | null
}

export type RockInteractiveAction = {
  workflowGuid?: string | null
  url?: string | null
  noActionMessage?: string | null
  actionStartDateTime?: string | null
  actionTypeGuid?: string | null
  actionComponentGuid?: string | null
  actionData?: {
    componentUrl?: string | null
    componentConfiguration?: Record<string, string> | null
    componentData?: Record<string, string> | null
    exception?: string | null
    message?: {
      type?: number | string | null
      title?: string | null
      content?: string | null
    } | null
  } | null
}

export type RockFormContext = {
  version: 1
  workflowTypeGuid: string
  personId?: number | null
  hidePersonEntryWhenKnown?: boolean
  knownPersonEntryValues?: RockPersonEntryValues | null
  workflowGuid: string | null
  sessionGuid: string
  interactionGuid: string
  actionTypeGuid: string
  actionStartDateTime: string
  initialFieldValues: Record<string, string>
  allowedFields: Array<{
    attributeGuid: string
    fieldTypeGuid: string
    binaryFileTypeGuid: string
    securityGrantToken: string | null
    name: string
  }>
  buttonTitles: string[]
  expiresAt: number
}
