type VercelRequestInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

export async function vercelRequest<T>(path: string, init: VercelRequestInit = {}) {
  const token = process.env.VERCEL_TOKEN;

  if (!token) {
    throw new Error('Brakuje VERCEL_TOKEN w zmiennych środowiskowych.');
  }

  const teamId = process.env.VERCEL_TEAM_ID;
  const separator = path.includes('?') ? '&' : '?';
  const url = `https://api.vercel.com${path}${teamId ? `${separator}teamId=${teamId}` : ''}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Vercel API error ${response.status}: ${JSON.stringify(data)}`);
  }

  return data as T;
}
