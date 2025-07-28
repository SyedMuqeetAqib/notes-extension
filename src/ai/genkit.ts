/**
 * @fileoverview This file initializes the Genkit AI platform.
 */
'use server';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export {ai};
