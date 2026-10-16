import type { RockSignatureValues } from './types'

export function validateRockSignature(
  type: 'typed' | 'drawn',
  values: RockSignatureValues,
): string | null {
  if (!values.signedByName.trim() || values.signedByName.length > 200) {
    return 'Enter your legal name.'
  }
  if (
    values.signedByEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.signedByEmail)
  ) {
    return 'Enter your email address.'
  }
  if (type === 'drawn') {
    if (
      values.signatureData.length > 1_400_000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(
        values.signatureData,
      )
    ) {
      return 'Draw your signature.'
    }
    const bytes = Buffer.from(values.signatureData.split(',')[1], 'base64')
    if (
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      return 'Draw your signature.'
    }
  } else if (values.signatureData) {
    return 'This step requires a typed signature.'
  }

  return null
}
