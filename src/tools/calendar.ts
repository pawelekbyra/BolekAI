import type { Env } from '../env'

export const calendarTools = [
  {
    name: 'calendar_get_events',
    description: 'Get calendar events for a date range',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        maxResults: {
          type: 'number',
          description: 'Max events to return (default: 10)',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a calendar event',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title',
        },
        description: {
          type: 'string',
          description: 'Event description (optional)',
        },
        startTime: {
          type: 'string',
          description: 'Start time (ISO 8601 format)',
        },
        endTime: {
          type: 'string',
          description: 'End time (ISO 8601 format)',
        },
        location: {
          type: 'string',
          description: 'Event location (optional)',
        },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete a calendar event',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Event ID to delete',
        },
      },
      required: ['eventId'],
    },
  },
]

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  description?: string
  location?: string
}

interface CalendarResponse {
  success: boolean
  events?: CalendarEvent[]
  event?: CalendarEvent
  message?: string
  errors?: string[]
}

async function getGoogleCalendarEvents(
  apiKey: string,
  startDate: string,
  endDate: string,
  maxResults: number = 10
): Promise<CalendarResponse> {
  if (!apiKey) {
    return {
      success: false,
      errors: ['GOOGLE_CALENDAR_API_KEY not configured'],
    }
  }

  try {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const params = new URLSearchParams({
      key: apiKey,
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      maxResults: maxResults.toString(),
      orderBy: 'startTime',
      singleEvents: 'true',
    })

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      return {
        success: false,
        errors: [`Google Calendar API error: ${response.status}`],
      }
    }

    const data = await response.json() as { items?: Array<{
      id: string
      summary: string
      start: { dateTime?: string; date?: string }
      end: { dateTime?: string; date?: string }
      description?: string
      location?: string
    }> }

    const events: CalendarEvent[] = (data.items || []).map((item) => ({
      id: item.id,
      title: item.summary,
      startTime: item.start.dateTime || item.start.date || '',
      endTime: item.end.dateTime || item.end.date || '',
      description: item.description,
      location: item.location,
    }))

    return {
      success: true,
      events,
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

async function createGoogleCalendarEvent(
  apiKey: string,
  title: string,
  startTime: string,
  endTime: string,
  description?: string,
  location?: string
): Promise<CalendarResponse> {
  if (!apiKey) {
    return {
      success: false,
      errors: ['GOOGLE_CALENDAR_API_KEY not configured'],
    }
  }

  try {
    const eventBody = {
      summary: title,
      description,
      location,
      start: { dateTime: new Date(startTime).toISOString() },
      end: { dateTime: new Date(endTime).toISOString() },
    }

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    )

    if (!response.ok) {
      return {
        success: false,
        errors: [`Failed to create event: ${response.status}`],
      }
    }

    const data = await response.json() as {
      id: string
      summary: string
      start: { dateTime?: string }
      end: { dateTime?: string }
    }

    return {
      success: true,
      event: {
        id: data.id,
        title: data.summary,
        startTime: data.start.dateTime || '',
        endTime: data.end.dateTime || '',
        description,
        location,
      },
      message: 'Event created successfully',
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

async function deleteGoogleCalendarEvent(
  apiKey: string,
  eventId: string
): Promise<CalendarResponse> {
  if (!apiKey) {
    return {
      success: false,
      errors: ['GOOGLE_CALENDAR_API_KEY not configured'],
    }
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      return {
        success: false,
        errors: [`Failed to delete event: ${response.status}`],
      }
    }

    return {
      success: true,
      message: 'Event deleted successfully',
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}

export async function executeCalendarTool(
  name: string,
  args: unknown,
  env: Env
): Promise<unknown> {
  const {
    startDate,
    endDate,
    maxResults,
    title,
    description,
    startTime,
    endTime,
    location,
    eventId,
  } = args as {
    startDate?: string
    endDate?: string
    maxResults?: number
    title?: string
    description?: string
    startTime?: string
    endTime?: string
    location?: string
    eventId?: string
  }

  const apiKey = env.GOOGLE_CALENDAR_API_KEY || ''

  if (name === 'calendar_get_events') {
    if (!startDate || !endDate) {
      return {
        success: false,
        error: 'startDate and endDate are required',
      }
    }
    return getGoogleCalendarEvents(apiKey, startDate, endDate, maxResults)
  }

  if (name === 'calendar_create_event') {
    if (!title || !startTime || !endTime) {
      return {
        success: false,
        error: 'title, startTime, and endTime are required',
      }
    }
    return createGoogleCalendarEvent(apiKey, title, startTime, endTime, description, location)
  }

  if (name === 'calendar_delete_event') {
    if (!eventId) {
      return {
        success: false,
        error: 'eventId is required',
      }
    }
    return deleteGoogleCalendarEvent(apiKey, eventId)
  }

  throw new Error(`Unknown calendar tool: ${name}`)
}
