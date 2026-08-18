import Image, { type ImageProps } from 'next/image'
import {
  getPayloadMediaDerivative,
  getRequestedPayloadMediaDerivative,
  type PayloadMediaImage,
  type PayloadMediaSize,
} from '@/lib/payload-media'

type MediaImageProps = Omit<ImageProps, 'src' | 'alt' | 'placeholder' | 'blurDataURL'> & {
  media: PayloadMediaImage | string
  mediaSize: PayloadMediaSize
  alt?: string
  preferOriginalWhenRequestedSizeMissing?: boolean
}

export function MediaImage({
  media,
  mediaSize,
  alt,
  preferOriginalWhenRequestedSizeMissing = false,
  ...props
}: MediaImageProps) {
  if (typeof media === 'string') {
    return <Image src={media} alt={alt ?? ''} {...props} />
  }

  const useOriginal =
    preferOriginalWhenRequestedSizeMissing &&
    !getRequestedPayloadMediaDerivative(media, mediaSize) &&
    Boolean(media.url)
  const derivative = useOriginal ? { url: media.url } : getPayloadMediaDerivative(media, mediaSize)
  if (!derivative?.url) return null

  const focalPointStyle =
    media.focalX != null && media.focalY != null
      ? { objectPosition: `${media.focalX}% ${media.focalY}%` }
      : undefined

  const blurProps =
    media.blurDataURL
      ? { placeholder: 'blur' as const, blurDataURL: media.blurDataURL }
      : {}

  return (
    <Image
      src={derivative.url}
      alt={alt ?? media.alt ?? ''}
      {...blurProps}
      {...props}
      style={{ ...focalPointStyle, ...props.style }}
    />
  )
}
