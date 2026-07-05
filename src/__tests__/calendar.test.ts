import { executeCalendarTool } from '../tools/calendar'
import type { Env } from '../env'

const mockEnv: Partial<Env> = {
  GOOGLE_CALENDAR_API_KEY: 'test_key_123',
}

describe('Calendar Tool', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('calendar_get_events', () => {
    it('should return events for date range', async () => {
      const mockResponse = {
        items: [
          {
            id: 'event_1',
            summary: 'Team Meeting',
            start: { dateTime: '2026-07-05T10:00:00Z' },
            end: { dateTime: '2026-07-05T11:00:00Z' },
            description: 'Weekly sync',
          },
          {
            id: 'event_2',
            summary: 'Lunch',
            start: { dateTime: '2026-07-05T12:00:00Z' },
            end: { dateTime: '2026-07-05T13:00:00Z' },
          },
        ],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await executeCalendarTool(
        'calendar_get_events',
        {
          startDate: '2026-07-05',
          endDate: '2026-07-06',
        },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: true,
        events: [
          {
            id: 'event_1',
            title: 'Team Meeting',
            startTime: '2026-07-05T10:00:00Z',
            endTime: '2026-07-05T11:00:00Z',
            description: 'Weekly sync',
          },
          {
            id: 'event_2',
            title: 'Lunch',
            startTime: '2026-07-05T12:00:00Z',
            endTime: '2026-07-05T13:00:00Z',
          },
        ],
      })
    })

    it('should handle missing dates', async () => {
      const result = await executeCalendarTool(
        'calendar_get_events',
        {
          startDate: '2026-07-05',
        },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: false,
        error: 'startDate and endDate are required',
      })
    })

    it('should handle API errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await executeCalendarTool(
        'calendar_get_events',
        {
          startDate: '2026-07-05',
          endDate: '2026-07-06',
        },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: false,
        errors: ['Google Calendar API error: 401'],
      })
    })
  })

  describe('calendar_create_event', () => {
    it('should create an event', async () => {
      const mockResponse = {
        id: 'new_event_1',
        summary: 'New Task',
        start: { dateTime: '2026-07-06T14:00:00Z' },
        end: { dateTime: '2026-07-06T15:00:00Z' },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await executeCalendarTool(
        'calendar_create_event',
        {
          title: 'New Task',
          startTime: '2026-07-06T14:00:00Z',
          endTime: '2026-07-06T15:00:00Z',
          description: 'Important task',
          location: 'Office',
        },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: true,
        event: {
          id: 'new_event_1',
          title: 'New Task',
          startTime: '2026-07-06T14:00:00Z',
          endTime: '2026-07-06T15:00:00Z',
          description: 'Important task',
          location: 'Office',
        },
        message: 'Event created successfully',
      })
    })

    it('should require title and times', async () => {
      const result = await executeCalendarTool(
        'calendar_create_event',
        {
          title: 'Test',
          startTime: '2026-07-06T14:00:00Z',
        },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: false,
        error: 'title, startTime, and endTime are required',
      })
    })
  })

  describe('calendar_delete_event', () => {
    it('should delete an event', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      })

      const result = await executeCalendarTool(
        'calendar_delete_event',
        {
          eventId: 'event_to_delete',
        },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: true,
        message: 'Event deleted successfully',
      })
    })

    it('should require eventId', async () => {
      const result = await executeCalendarTool(
        'calendar_delete_event',
        {},
        mockEnv as Env
      )

      expect(result).toEqual({
        success: false,
        error: 'eventId is required',
      })
    })
  })

  describe('error handling', () => {
    it('should handle unconfigured API key', async () => {
      const result = await executeCalendarTool(
        'calendar_get_events',
        {
          startDate: '2026-07-05',
          endDate: '2026-07-06',
        },
        {} as Env
      )

      expect(result).toEqual({
        success: false,
        errors: ['GOOGLE_CALENDAR_API_KEY not configured'],
      })
    })
  })
})
