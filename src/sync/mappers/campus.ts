import type { RockCampus } from '@/lib/rock-api'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function text(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function mapGeoPoint(geoPoint: NonNullable<RockCampus['Location']>['GeoPoint']) {
  if (!geoPoint) return undefined

  if ('Latitude' in geoPoint && 'Longitude' in geoPoint) {
    return { lat: geoPoint.Latitude, lng: geoPoint.Longitude }
  }

  const wellKnownText = geoPoint.Geography?.WellKnownText
  const match = wellKnownText?.match(
    /^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i,
  )
  if (!match) return undefined

  return { lat: Number(match[2]), lng: Number(match[1]) }
}

export function mapRockCampus(rock: RockCampus) {
  const attrs = rock.AttributeValues || {}
  const street = [text(rock.Location?.Street1), text(rock.Location?.Street2)]
    .filter(Boolean)
    .join(', ')
  return {
    name: rock.Name,
    slug: slugify(rock.Name),
    rockId: rock.Id,
    address: {
      street,
      city: text(rock.Location?.City),
      postalCode: text(rock.Location?.PostalCode),
    },
    geoPoint: mapGeoPoint(rock.Location?.GeoPoint),
    googlePlaceId: text(
      rock.Location?.GooglePlaceId ??
        rock.Location?.AttributeValues?.GooglePlaceId?.Value,
    ),
    serviceTimes: rock.ServiceTimes || '',
    order: rock.Order,
    isActive: rock.IsActive,
    establishmentYear: attrs.EstablishmentYear
      ? parseInt(attrs.EstablishmentYear.Value, 10)
      : undefined,
    // Image GUIDs for the image sync pipeline to process
    _imageGuids: {
      featuredImage: attrs.FeaturedImage?.Value || null,
      slideImages: [
        attrs.SlideImage1?.Value,
        attrs.SlideImage2?.Value,
        attrs.SlideImage3?.Value,
        attrs.SlideImage4?.Value,
      ].filter(Boolean) as string[],
    },
    lastSyncedAt: new Date().toISOString(),
  }
}
