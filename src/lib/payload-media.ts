export type PayloadMediaSize = 'thumbnail' | 'medium' | 'large' | 'hero'

export interface PayloadMediaDerivative {
  url?: string | null
  width?: number | null
  height?: number | null
}

export interface PayloadMediaImage {
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  blurDataURL?: string | null
  sizes?: Partial<
    Record<
      PayloadMediaSize | `${Exclude<PayloadMediaSize, 'hero'>}Webp`,
      PayloadMediaDerivative | null
    >
  > | null
}

type PayloadMediaDerivativeKey = keyof NonNullable<PayloadMediaImage['sizes']>

const DERIVATIVE_CANDIDATES = {
  thumbnail: ['thumbnailWebp', 'thumbnail', 'mediumWebp', 'medium'],
  medium: ['mediumWebp', 'medium', 'largeWebp', 'large', 'thumbnailWebp', 'thumbnail'],
  large: ['largeWebp', 'large', 'hero', 'mediumWebp', 'medium', 'thumbnailWebp', 'thumbnail'],
  hero: ['hero', 'largeWebp', 'large', 'mediumWebp', 'medium', 'thumbnailWebp', 'thumbnail'],
} as const satisfies Record<PayloadMediaSize, readonly PayloadMediaDerivativeKey[]>

export function getPayloadMediaDerivative(
  media: PayloadMediaImage,
  size: PayloadMediaSize,
): PayloadMediaDerivative | null {
  for (const candidate of DERIVATIVE_CANDIDATES[size]) {
    const derivative = media.sizes?.[candidate]
    if (derivative?.url) return derivative
  }

  return null
}

export function getRequestedPayloadMediaDerivative(
  media: PayloadMediaImage,
  size: PayloadMediaSize,
): PayloadMediaDerivative | null {
  if (size !== 'hero') {
    const webpDerivative = media.sizes?.[`${size}Webp`]
    if (webpDerivative?.url) return webpDerivative
  }

  const derivative = media.sizes?.[size]
  return derivative?.url ? derivative : null
}

export function getPayloadMediaUrl(
  media: PayloadMediaImage,
  size: PayloadMediaSize,
): string | null {
  return getPayloadMediaDerivative(media, size)?.url ?? null
}
