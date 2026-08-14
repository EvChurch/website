import {
  createOpenGraphImageResponse,
  openGraphImageAlt,
  openGraphImageContentType,
  openGraphImageSize,
} from '@/components/seo/OpenGraphImage'

export const alt = openGraphImageAlt
export const size = openGraphImageSize
export const contentType = openGraphImageContentType

export default function OpenGraphImage() {
  return createOpenGraphImageResponse()
}
