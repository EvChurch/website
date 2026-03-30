import Image, { type ImageProps } from 'next/image'

interface MediaObject {
  url?: string | null
  alt?: string
  width?: number | null
  height?: number | null
  blurDataURL?: string | null
}

type MediaImageProps = Omit<ImageProps, 'src' | 'alt' | 'placeholder' | 'blurDataURL'> & {
  media: MediaObject | string
  alt?: string
}

export function MediaImage({ media, alt, ...props }: MediaImageProps) {
  if (typeof media === 'string') {
    return <Image src={media} alt={alt ?? ''} {...props} />
  }

  const src = media.url
  if (!src) return null

  const blurProps =
    media.blurDataURL
      ? { placeholder: 'blur' as const, blurDataURL: media.blurDataURL }
      : {}

  return (
    <Image
      src={src}
      alt={alt ?? media.alt ?? ''}
      {...blurProps}
      {...props}
    />
  )
}
