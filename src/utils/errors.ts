import { ZodError } from "zod";

/**
 * Helper per gestire gli errori in modo pulito e coerente nelle Server Actions
 */
export function handleActionError(error: unknown, defaultMessage: string): never {
  if (error instanceof ZodError) {
    const errorDetails = error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Dati non validi: ${errorDetails}`);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(defaultMessage);
}
