import type { ChatMessage, PendingAttachment } from '../../shared/chat-types';
import type { Settings } from '../../shared/settings';

export function assembleMessages(
  settings: Settings,
  history: ChatMessage[],
  userText: string,
  attachments: PendingAttachment[]
): ChatMessage[] {
  const screenText = attachments
    .filter((attachment) => attachment.type === 'screen_text')
    .map((attachment) => attachment.text)
    .join('\n\n');
  const transcript = attachments
    .filter((attachment) => attachment.type === 'transcript')
    .map((attachment) => attachment.text)
    .join('\n');
  const renderedBasePrompt = settings.baseUserPrompt
    .replaceAll('{{screen_text}}', screenText)
    .replaceAll('{{transcript}}', transcript)
    .trim();
  const fallbackContext = [
    screenText ? `--- Screen text ---\n${screenText}\n--- End screen text ---` : '',
    transcript ? `--- Transcript ---\n${transcript}\n--- End transcript ---` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
  const userContent = [renderedBasePrompt || fallbackContext, userText.trim()].filter(Boolean).join('\n\n');
  const system = settings.systemPrompt.trim() ? [{ role: 'system' as const, content: settings.systemPrompt.trim() }] : [];
  const retained = [...history];
  const finalUser = { role: 'user' as const, content: userContent };
  while (retained.length > 0 && estimateTokens([...system, ...retained, finalUser]) > settings.contextBudgetTokens) {
    retained.shift();
  }
  return [...system, ...retained, finalUser];
}
