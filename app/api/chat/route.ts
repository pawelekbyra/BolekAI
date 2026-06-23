import { google } from '@ai-sdk/google';
import { convertToCoreMessages, streamText } from 'ai';
import { githubTools } from '@/lib/tools';
import { TOOLS_REQUIRING_APPROVAL } from '@/lib/approval';
import { SYSTEM_PROMPT } from '@/lib/system-prompt';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Create a version of tools for the server that excludes 'execute' for tools requiring approval.
  // This forces the AI SDK to pause and wait for client-side tool confirmation.
  const toolsForServer = Object.fromEntries(
    Object.entries(githubTools).map(([name, tool]) => {
      if (TOOLS_REQUIRING_APPROVAL.includes(name)) {
        const { execute, ...rest } = tool as any;
        return [name, rest];
      }
      return [name, tool];
    })
  );

  const result = streamText({
    model: google(process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'),
    system: SYSTEM_PROMPT,
    messages: convertToCoreMessages(messages),
    tools: toolsForServer,
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
