// The single place that names a model provider. Everywhere else in the app
// (src/pages/api/chat.ts, src/lib/spotify/tools.ts) talks to the `ai`
// package's provider-neutral `LanguageModel` / `streamText` interface, not to
// any vendor SDK directly — so switching providers means editing only this
// file.
//
// To swap providers: install the relevant `@ai-sdk/*` package, replace the
// import and provider construction below, and update `chatModel` to a model
// id that provider offers. For example, to move to OpenAI:
//
//   import { createOpenAI } from '@ai-sdk/openai';
//   const openai = createOpenAI({ apiKey: import.meta.env.OPENAI_API_KEY });
//   export const chatModel = openai('gpt-5');
//
// Nothing in chat.ts or tools.ts needs to change — `streamText`, tool
// definitions (Zod input schemas via the `ai` package's `tool()` helper),
// and the response shape are all provider-agnostic.
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

export const chatModel = anthropic('claude-haiku-4-5');
