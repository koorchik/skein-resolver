import { EmbeddingCache } from './EmbeddingCache';
import { EmbeddingsBackendGemini } from './EmbeddingsBackendGemini';
import { EmbeddingsBackendOllama } from './EmbeddingsBackendOllama';
import { EmbeddingsClient } from './EmbeddingsClient';
import type { CostMeter } from '../Experiment/CostMeter';

/**
 * The one place a provider name becomes an embeddings backend.
 *
 * This paper repo carries exactly the two encoders the experiments use: `ollama`
 * (embeddinggemma, the open-weight stack) and `gemini` (gemini-embedding-2 via Google AI Studio,
 * the cloud stack). Credentials come from the environment; the caller chooses provider, model and
 * cache directory.
 */
export function createEmbeddingsClient(params: {
  provider: string;
  model: string;
  cacheDir?: string;
  costMeter?: CostMeter;
}): EmbeddingsClient {
  let backend;

  switch (params.provider) {
    // Google AI Studio (GEMINI_API_KEY) — the encoder-side sibling of the 'gemini' LLM provider.
    case 'gemini':
      backend = new EmbeddingsBackendGemini({
        model: params.model,
        apiKey: process.env.GEMINI_API_KEY!,
      });
      break;

    case 'ollama':
      backend = new EmbeddingsBackendOllama({
        model: params.model,
        apiKey: process.env.OLLAMA_API_KEY,
        host: process.env.OLLAMA_HOST,
      });
      break;

    default:
      throw new Error(`Unknown embeddings provider: ${params.provider}`);
  }

  return new EmbeddingsClient({
    backend,
    costMeter: params.costMeter,
    cache: params.cacheDir
      ? new EmbeddingCache({
          dir: params.cacheDir,
          provider: backend.provider,
          model: params.model,
        })
      : undefined,
  });
}
