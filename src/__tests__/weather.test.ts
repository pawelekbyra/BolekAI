import { executeWeatherTool } from '../tools/weather'
import type { Env } from '../env'

const mockEnv: Partial<Env> = {
  USER_LATITUDE: '52.1326',
  USER_LONGITUDE: '21.0122',
}

describe('Weather Tool', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('weather_current', () => {
    it('should return current weather', async () => {
      const mockResponse = {
        current: {
          temperature_2m: 22,
          apparent_temperature: 20,
          relative_humidity_2m: 65,
          weather_code: 2,
          wind_speed_10m: 5,
          precipitation: 0,
          cloud_cover: 40,
          visibility: 10000,
          uv_index: 5,
          time: '2026-07-05T14:00Z',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await executeWeatherTool(
        'weather_current',
        { latitude: 52.1326, longitude: 21.0122 },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: true,
        current: {
          temperature: 22,
          feelsLike: 20,
          condition: 'Partly cloudy',
          humidity: 65,
          windSpeed: 5,
          precipitation: 0,
          cloudCover: 40,
          visibility: 10000,
          uv: 5,
          timestamp: '2026-07-05T14:00Z',
        },
      })
    })

    it('should use default coordinates from env', async () => {
      const mockResponse = {
        current: {
          temperature_2m: 20,
          apparent_temperature: 18,
          relative_humidity_2m: 60,
          weather_code: 0,
          wind_speed_10m: 3,
          precipitation: 0,
          cloud_cover: 10,
          visibility: 10000,
          uv_index: 6,
          time: '2026-07-05T14:00Z',
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await executeWeatherTool('weather_current', {}, mockEnv as Env)

      expect(result).toEqual({
        success: true,
        current: expect.objectContaining({
          temperature: 20,
          condition: 'Clear sky',
        }),
      })
    })

    it('should handle API errors', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await executeWeatherTool(
        'weather_current',
        {},
        mockEnv as Env
      )

      expect(result).toEqual({
        success: false,
        errors: ['Open-Meteo API error: 500'],
      })
    })
  })

  describe('weather_forecast', () => {
    it('should return 7-day forecast', async () => {
      const mockResponse = {
        daily: {
          time: [
            '2026-07-05',
            '2026-07-06',
            '2026-07-07',
            '2026-07-08',
            '2026-07-09',
            '2026-07-10',
            '2026-07-11',
          ],
          temperature_2m_max: [25, 26, 23, 22, 24, 25, 26],
          temperature_2m_min: [18, 19, 17, 16, 17, 18, 19],
          weather_code: [2, 0, 61, 1, 2, 0, 3],
          precipitation_sum: [0, 0, 5, 1, 0, 0, 0],
          wind_speed_10m_max: [5, 4, 8, 6, 5, 3, 4],
          uv_index_max: [6, 7, 4, 3, 5, 6, 6],
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await executeWeatherTool(
        'weather_forecast',
        { days: 7 },
        mockEnv as Env
      )

      expect(result).toEqual({
        success: true,
        forecast: expect.arrayContaining([
          expect.objectContaining({
            date: '2026-07-05',
            maxTemp: 25,
            minTemp: 18,
          }),
        ]),
      })

      expect((result as any).forecast).toHaveLength(7)
    })
  })

  describe('weather_alert', () => {
    it('should detect severe weather alerts', async () => {
      const mockResponse = {
        daily: {
          time: ['2026-07-05', '2026-07-06', '2026-07-07'],
          temperature_2m_max: [25, 26, 23],
          temperature_2m_min: [18, 19, 17],
          weather_code: [95, 0, 61],
          precipitation_sum: [25, 0, 5],
          wind_speed_10m_max: [5, 4, 8],
          uv_index_max: [6, 7, 4],
        },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await executeWeatherTool(
        'weather_alert',
        {},
        mockEnv as Env
      )

      expect(result).toEqual({
        success: true,
        alerts: expect.arrayContaining([
          expect.objectContaining({
            severity: 'high',
            type: 'Thunderstorm',
          }),
          expect.objectContaining({
            severity: 'moderate',
            type: 'Heavy Rain',
          }),
        ]),
        message: expect.stringContaining('weather alerts'),
      })
    })
  })
})
