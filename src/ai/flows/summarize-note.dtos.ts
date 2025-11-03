/**
 * @fileOverview Schemas and types for the note summarization AI agent.
 *
 * - SummarizeNoteInput - The input type for the summarizeNote function.
 * - SummarizeNoteOutput - The return type for the summarizeNote function.
 */

import {z} from 'zod';

export const SummarizeNoteInputSchema = z.object({
  note: z.string().describe('The note to summarize'),
});
export type SummarizeNoteInput = z.infer<typeof SummarizeNoteInputSchema>;

export const SummarizeNoteOutputSchema = z.object({
  summary: z.string().describe('The summary of the note'),
});
export type SummarizeNoteOutput = z.infer<typeof SummarizeNoteOutputSchema>;
