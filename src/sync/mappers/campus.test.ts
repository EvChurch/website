import { describe, expect, it } from 'vitest'

import { mapRockCampus } from './campus'

describe('mapRockCampus', () => {
  it('maps the linked Rock location into a complete public campus address', () => {
    expect(
      mapRockCampus({
        Id: 2,
        Name: 'North',
        Description: '',
        IsActive: true,
        Order: 1,
        LocationId: 2401,
        Location: {
          Street1: '9-11 Rothwell Avenue',
          Street2: 'Rosedale',
          City: 'Auckland',
          PostalCode: '0632',
          GeoPoint: {
            Geography: {
              WellKnownText: 'POINT (174.699985 -36.751087)',
            },
          },
          GooglePlaceId: '  ',
          AttributeValues: {
            GooglePlaceId: { Value: 'ChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U' },
          },
        },
      }),
    ).toMatchObject({
      address: {
        street: '9-11 Rothwell Avenue, Rosedale',
        city: 'Auckland',
        postalCode: '0632',
      },
      geoPoint: {
        lat: -36.751087,
        lng: 174.699985,
      },
      googlePlaceId: 'ChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
    })
  })

  it('does not invent coordinates when Rock has no geocoded point', () => {
    expect(
      mapRockCampus({
        Id: 3,
        Name: 'Central',
        Description: '',
        IsActive: true,
        Order: 0,
        LocationId: 2,
        Location: {
          Street1: '80 Olsen Ave',
          Street2: 'Hillsborough',
          City: 'Auckland',
          PostalCode: '1042',
          GeoPoint: null,
          GooglePlaceId: null,
          AttributeValues: {},
        },
      }),
    ).toMatchObject({
      address: {
        street: '80 Olsen Ave, Hillsborough',
        city: 'Auckland',
        postalCode: '1042',
      },
      geoPoint: undefined,
      googlePlaceId: '',
    })
  })
})
