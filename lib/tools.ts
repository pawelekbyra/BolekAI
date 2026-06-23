import { tool } from 'ai';
import { z } from 'zod';
import { getGithubRepoConfig, githubRequest } from '@/lib/github';
import { vercelRequest } from '@/lib/vercel';

export const githubTools = {
  getRepoInfo: tool({
    description: 'Pobierz podstawowe informacje o skonfigurowanym repozytorium GitHub.',
    parameters: z.object({}),
    execute: async () => {
      const { owner, repo } = getGithubRepoConfig();
      return githubRequest(`/repos/${owner}/${repo}`);
    },
  }),

  listOpenIssues: tool({
    description: 'Pobierz otwarte issue z repozytorium GitHub.',
    parameters: z.object({
      limit: z.number().min(1).max(30).default(10),
    }),
    execute: async ({ limit }) => {
      const { owner, repo } = getGithubRepoConfig();
      return githubRequest(`/repos/${owner}/${repo}/issues?state=open&per_page=${limit}`);
    },
  }),

  createGithubIssue: tool({
    description: 'Utwórz issue w GitHubie. Używaj dla bugów, feature requestów i zadań technicznych.',
    parameters: z.object({
      title: z.string().min(3),
      body: z.string().min(10),
      labels: z.array(z.string()).default([]),
    }),
    execute: async ({ title, body, labels }) => {
      const { owner, repo } = getGithubRepoConfig();
      return githubRequest(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: { title, body, labels },
      });
    },
  }),

  createJulesTaskIssue: tool({
    description: 'Utwórz dobrze opisane issue oznaczone labelem jules, aby Jules mógł przejąć zadanie.',
    parameters: z.object({
      taskTitle: z.string().min(3),
      taskDescription: z.string().min(20),
      technicalContext: z.string().default('Brak dodatkowego kontekstu.'),
      acceptanceCriteria: z.array(z.string()).min(1),
    }),
    execute: async ({ taskTitle, taskDescription, technicalContext, acceptanceCriteria }) => {
      const { owner, repo } = getGithubRepoConfig();
      const body = `## Zadanie dla Julesa\n\n${taskDescription}\n\n## Kontekst techniczny\n\n${technicalContext}\n\n## Kryteria akceptacji\n\n${acceptanceCriteria
        .map((item: string) => `- ${item}`)
        .join('\n')}\n\n## Definicja ukończenia\n\n- Zmiany są w osobnym branchu.\n- Jest pull request do review.\n- Build przechodzi lokalnie lub w CI.\n- PR zawiera opis zmian i instrukcję testowania.\n`;

      return githubRequest(`/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        body: {
          title: taskTitle,
          body,
          labels: ['jules'],
        },
      });
    },
  }),

  listVercelDeployments: tool({
    description: 'Pobierz ostatnie deploymenty z Vercel. Wymaga VERCEL_TOKEN i opcjonalnie VERCEL_PROJECT_ID.',
    parameters: z.object({
      limit: z.number().min(1).max(20).default(5),
      projectId: z.string().optional(),
    }),
    execute: async ({ limit, projectId }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      const configuredProjectId = projectId ?? process.env.VERCEL_PROJECT_ID;

      if (configuredProjectId) {
        params.set('projectId', configuredProjectId);
      }

      return vercelRequest(`/v6/deployments?${params.toString()}`);
    },
  }),
};
