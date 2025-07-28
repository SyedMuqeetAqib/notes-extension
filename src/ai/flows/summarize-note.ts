// Summarize long notes with an AI tool for quick review.
/**
 * @fileOverview A note summarization AI agent.
 *
 * - summarizeNote - A function that handles the note summarization process.
 * - SummarizeNoteInput - The input type for the summarizeNote function.
 * - SummarizeNoteOutput - The return type for the summarizeNote function.
 */

export interface SummarizeNoteInput {
  note: string;
}

export interface SummarizeNoteOutput {
  summary: string;
}

export async function summarizeNote(
  input: SummarizeNoteInput
): Promise<SummarizeNoteOutput> {
  try {
    // For static export, we'll use a simple client-side summarization
    // This is a basic implementation - you may want to integrate with a client-side AI service
    const { note } = input;

    // Simple summarization logic for demonstration
    // In a real implementation, you'd want to use a client-side AI library or API
    const sentences = note.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const keyPoints = sentences.slice(0, 3).map((s) => s.trim());

    const summary =
      keyPoints.length > 0
        ? `Key points:\n${keyPoints
            .map((point, i) => `${i + 1}. ${point}`)
            .join("\n")}`
        : "Note is too short to summarize meaningfully.";

    return { summary };
  } catch (error) {
    console.error("Failed to summarize note:", error);
    return {
      summary:
        "Sorry, I couldn't generate a summary for this note. Please try again.",
    };
  }
}
