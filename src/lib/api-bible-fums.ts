type FumsCommand = [command: string, value: string]

export interface ApiBibleFumsWindow {
  fumsData?: FumsCommand[]
  fums?: (command: string, value: string) => void
}

declare global {
  interface Window {
    fumsData?: FumsCommand[]
    fums?: (command: string, value: string) => void
  }
}

export function apiBibleFumsTokens(value: string): string[] {
  return value.split('\n').map((token) => token.trim()).filter(Boolean)
}

/** Queues a privacy-preserving Scripture view until API.Bible's tracker is ready. */
export function reportApiBibleView(target: ApiBibleFumsWindow, fumsToken: string): void {
  if (!fumsToken) return
  target.fumsData ??= []
  target.fums ??= (command, value) => target.fumsData?.push([command, value])
  target.fums('trackView', fumsToken)
}
