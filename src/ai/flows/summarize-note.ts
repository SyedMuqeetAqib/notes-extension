// Summarize long notes with an AI tool for quick review.
/**
 * @fileOverview A note summarization AI agent.
 *
 * - summarizeNote - A function that handles the note summarization process.
 */

import { SummarizeNoteInput, SummarizeNoteOutput } from "./summarize-note.dtos";

// For static export, we'll use a simple client-side summarization approach
// This is a placeholder implementation that can be replaced with actual AI integration
export async function summarizeNote(
  input: SummarizeNoteInput
): Promise<SummarizeNoteOutput> {
  try {
    // Simple text summarization logic for static export
    const text = input.note;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    if (sentences.length <= 3) {
      return {
        summary: text.substring(0, 200) + (text.length > 200 ? "..." : ""),
      };
    }

    // Take first few sentences as summary
    const summarySentences = sentences.slice(
      0,
      Math.min(3, Math.ceil(sentences.length / 3))
    );
    const summary = summarySentences.join(". ").trim() + ".";

    return {
      summary:
        summary.length > 300 ? summary.substring(0, 300) + "..." : summary,
    };
  } catch (error) {
    console.error("Failed to summarize note:", error);
    return {
      summary:
        "Sorry, I couldn't generate a summary for this note. Please try again.",
    };
  }
}
