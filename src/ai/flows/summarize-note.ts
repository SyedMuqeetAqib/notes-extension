// Summarize long notes with an AI tool for quick review.
/**
 * @fileOverview A note summarization AI agent.
 *
 * - summarizeNote - A function that handles the note summarization process.
 */

'use server';

import {ai} from '@/ai/genkit';
import {
  SummarizeNoteInput,
  SummarizeNoteInputSchema,
  SummarizeNoteOutput,
  SummarizeNoteOutputSchema,
} from './summarize-note.dtos';

const summaryPrompt = ai.definePrompt({
    name: 'summaryPrompt',
    input: { schema: SummarizeNoteInputSchema },
    output: { schema: SummarizeNoteOutputSchema },
    prompt: `You are an expert at summarizing notes.
        Your task is to provide a concise summary of the following note.
        Note: {{{note}}}
    `
});

const summarizeNoteFlow = ai.defineFlow(
  {
    name: 'summarizeNoteFlow',
    inputSchema: SummarizeNoteInputSchema,
    outputSchema: SummarizeNoteOutputSchema,
  },
  async (input) => {
    const {output} = await summaryPrompt(input);
    return output!;
  }
);


export async function summarizeNote(
  input: SummarizeNoteInput
): Promise<SummarizeNoteOutput> {
  try {
    return await summarizeNoteFlow(input);
  } catch (error) {
    console.error("Failed to summarize note:", error);
    return {
      summary:
        "Sorry, I couldn't generate a summary for this note. Please try again.",
    };
  }
}
