import Image, { type ImageProps } from 'next/image'
import {
  getPayloadMediaDerivative,
  type PayloadMediaImage,
  type PayloadMediaSize,
} from '@/lib/payload-media'

type MediaImageProps = Omit<ImageProps, 'src' | 'alt' | 'placeholder' | 'blurDataURL'> & {
  media: PayloadMediaImage | string
  mediaSize: PayloadMediaSize
  alt?: string
}

export function MediaImage({ media, mediaSize, alt, ...props }: MediaImageProps) {
  if (typeof media === 'string') {
    return <Image src={media} alt={alt ?? ''} {...props} />
  }

  const derivative = getPayloadMediaDerivative(media, mediaSize)
  if (!derivative?.url) return null

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
    />
  )
}
