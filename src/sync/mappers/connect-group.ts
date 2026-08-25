import type { RockGroup, RockSchedule } from '@/lib/rock-api'
import { getRockPersonName } from './person'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function mapRockConnectGroup(
  rock: RockGroup,
  schedule: RockSchedule | null = null,
) {
  const leaders = rock.Members.filter(
    (m) => m.GroupRole && m.Person && m.GroupRole.IsLeader === true,
  )
    .map((m) => ({
      name: getRockPersonName(m.Person),
      email: m.Person.Email || '',
      photoId: Number.isInteger(m.Person.PhotoId) ? (m.Person.PhotoId ?? null) : null,
    }))

  const location = rock.GroupLocations[0]?.Location

  return {
    name: rock.Name,
    slug: slugify(rock.Name),
    rockGroupId: rock.Id,
    rockGroupGuid: rock.Guid.toLowerCase(),
    publicName: rock.Description.trim() || rock.Name,
    leaders,
    location: {
      name: location?.Street1 || '',
      address: location?.City || '',
    },
    capacity: rock.GroupCapacity,
    meetingDay:
      schedule?.IsActive && Number.isInteger(schedule.WeeklyDayOfWeek)
        ? schedule.WeeklyDayOfWeek
        : null,
    meetingTime:
      schedule?.IsActive && schedule.WeeklyTimeOfDay
        ? schedule.WeeklyTimeOfDay
        : null,
    scheduleText:
      schedule?.IsActive
        ? schedule.FriendlyScheduleText?.trim() || schedule.Description.trim() || null
        : null,
    isActive: rock.IsActive,
    _campusRockId: rock.CampusId,
  }
}
