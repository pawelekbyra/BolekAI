import type { Env } from '../env'

export const weatherTools = [
  {
    name: 'weather_current',
    description: 'Get current weather conditions',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude (default: from config)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude (default: from config)',
        },
      },
    },
  },
  {
    name: 'weather_forecast',
    description: 'Get 7-day weather forecast',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude (default: from config)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude (default: from config)',
        },
        days: {
          type: 'number',
          description: 'Number of days (1-16, default: 7)',
        },
      },
    },
  },
  {
    name: 'weather_alert',
    description: 'Check for severe weather alerts',
    parameters: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude (default: from config)',
        },
        longitude: {
          type: 'number',
          description: 'Longitude (default: from config)',
        },
      },
    },
  },
]

interface CurrentWeather {
  temperature: number
  feelsLike: number
  condition: string
  humidity: number
  windSpeed: number
  precipitation: number
  cloudCover: number
  visibility: number
  uv: number
  timestamp: string
}

interface ForecastDay {
  date: string
  maxTemp: number
  minTemp: number
  condition: string
  precipitation: number
  windSpeed: number
  uvIndex: number
}

interface WeatherAlert {
  severity: 'low' | 'moderate' | 'high'
  type: string
  description: string
  startTime: string
  endTime: string
}

interface WeatherResponse {
  success: boolean
  current?: CurrentWeather
  forecast?: ForecastDay[]
  alerts?: WeatherAlert[]
  message?: string
  errors?: string[]
}

async function getCurrentWeather(
  latitude: number,
  longitude: number
): Promise<WeatherResponse> {
  try {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,cloud_cover,visibility,uv_index',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
    })

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { timeout: 10000 }
    )

    if (!response.ok) {
      return {
        success: false,
        errors: [`Open-Meteo API error: ${response.status}`],
      }
    }

    const data = await response.json() as {
      current?: {
        temperature_2m: number
        apparent_temperature: number
        relative_humidity_2m: number
        weather_code: number
        wind_speed_10m: number
        precipitation: number
        cloud_cover: number
        visibility: number
        uv_index: number
        time: string
      }
    }

    if (!data.current) {
      return {
        success: false,
        errors: ['No weather data returned'],
      }
    }

    const weatherMap: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with large hail',
    }

    const condition = weatherMap[data.current.weather_code] || 'Unknown'

    return {
      success: true,
      current: {
        temperature: data.current.temperature_2m,
        feelsLike: data.current.apparent_temperature,
        condition,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        precipitation: data.current.precipitation,
        cloudCover: data.current.cloud_cover,
        visibility: data.current.visibility,
        uv: data.current.uv_index,
        timestamp: data.current.time,
      },
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Failed to fetch weather'],
    }
  }
}

async function getWeatherForecast(
  latitude: number,
  longitude: number,
  days: number = 7
): Promise<WeatherResponse> {
  try {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max,uv_index_max',
      forecast_days: Math.min(days, 16).toString(),
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
    })

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      { timeout: 10000 }
    )

    if (!response.ok) {
      return {
        success: false,
        errors: [`Open-Meteo API error: ${response.status}`],
      }
    }

    const data = await response.json() as {
      daily?: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        weather_code: number[]
        precipitation_sum: number[]
        wind_speed_10m_max: number[]
        uv_index_max: number[]
      }
    }

    if (!data.daily) {
      return {
        success: false,
        errors: ['No forecast data returned'],
      }
    }

    const weatherMap: Record<number, string> = {
      0: 'Clear',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      61: 'Rain',
      71: 'Snow',
      80: 'Showers',
      95: 'Thunderstorm',
    }

    const forecast: ForecastDay[] = data.daily.time.map((date, i) => ({
      date,
      maxTemp: data.daily!.temperature_2m_max[i],
      minTemp: data.daily!.temperature_2m_min[i],
      condition: weatherMap[data.daily!.weather_code[i]] || 'Unknown',
      precipitation: data.daily!.precipitation_sum[i],
      windSpeed: data.daily!.wind_speed_10m_max[i],
      uvIndex: data.daily!.uv_index_max[i],
    }))

    return {
      success: true,
      forecast,
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Failed to fetch forecast'],
    }
  }
}

async function checkWeatherAlert(
  latitude: number,
  longitude: number
): Promise<WeatherResponse> {
  // Open-Meteo doesn't have native alerts, but we can infer from forecast
  try {
    const forecast = await getWeatherForecast(latitude, longitude, 3)

    if (!forecast.success || !forecast.forecast) {
      return {
        success: true,
        alerts: [],
        message: 'No severe weather alerts',
      }
    }

    const alerts: WeatherAlert[] = []

    forecast.forecast.forEach((day) => {
      if (day.condition.includes('Thunderstorm')) {
        alerts.push({
          severity: 'high',
          type: 'Thunderstorm',
          description: `Thunderstorm expected on ${day.date}`,
          startTime: day.date,
          endTime: new Date(new Date(day.date).getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        })
      }
      if (day.precipitation > 20) {
        alerts.push({
          severity: 'moderate',
          type: 'Heavy Rain',
          description: `Heavy rain expected on ${day.date} (${day.precipitation}mm)`,
          startTime: day.date,
          endTime: new Date(new Date(day.date).getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        })
      }
    })

    return {
      success: true,
      alerts,
      message: alerts.length > 0 ? `${alerts.length} weather alerts` : 'No severe weather alerts',
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Failed to check alerts'],
    }
  }
}

export async function executeWeatherTool(
  name: string,
  args: unknown,
  env: Env
): Promise<unknown> {
  const { latitude, longitude, days } = args as {
    latitude?: number
    longitude?: number
    days?: number
  }

  // Use provided coords or fallback to env config
  const lat = latitude || (env.USER_LATITUDE ? parseFloat(env.USER_LATITUDE) : 52.1326)
  const lon = longitude || (env.USER_LONGITUDE ? parseFloat(env.USER_LONGITUDE) : 21.0122)

  if (name === 'weather_current') {
    return getCurrentWeather(lat, lon)
  }

  if (name === 'weather_forecast') {
    return getWeatherForecast(lat, lon, days || 7)
  }

  if (name === 'weather_alert') {
    return checkWeatherAlert(lat, lon)
  }

  throw new Error(`Unknown weather tool: ${name}`)
}
