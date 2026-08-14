import { ImageResponse } from 'next/og'

import {
  DEFAULT_OPEN_GRAPH_IMAGE_ALT,
  DEFAULT_OPEN_GRAPH_IMAGE_SIZE,
} from '@/lib/seo-metadata'

export const openGraphImageAlt = DEFAULT_OPEN_GRAPH_IMAGE_ALT
export const openGraphImageSize = DEFAULT_OPEN_GRAPH_IMAGE_SIZE
export const openGraphImageContentType = 'image/png'

export function createOpenGraphImageResponse() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#0F0004',
        color: '#FEFAF4',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          background: '#E22A30',
          height: 18,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -5 }}>
          ev.church
        </div>
        <div style={{ color: '#FEFAF4', fontSize: 34 }}>
          A community of Christ-followers across Auckland
        </div>
      </div>
    </div>,
    openGraphImageSize,
  )
}
