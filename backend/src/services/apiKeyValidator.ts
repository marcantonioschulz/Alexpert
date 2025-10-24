/**
 * Service for validating OpenAI API keys
 * Checks if a key is valid and has Realtime API access
 */

export interface ApiKeyValidationResult {
  valid: boolean;
  hasRealtimeAccess: boolean;
  error?: string;
}

/**
 * Validates an OpenAI API key by attempting to create a Realtime session
 * @param apiKey - The OpenAI API key to validate
 * @returns Validation result with status and error details
 */
export async function validateOpenAIKey(
  apiKey: string
): Promise<ApiKeyValidationResult> {
  try {
    // Test 1: Key format validation
    if (!apiKey.startsWith('sk-')) {
      return {
        valid: false,
        hasRealtimeAccess: false,
        error: 'Invalid key format - must start with sk-'
      };
    }

    // Test 2: Attempt to create a Realtime API session
    // This is the most reliable way to check both validity AND Realtime access
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse'
      })
    });

    // Handle different status codes
    if (response.status === 401) {
      return {
        valid: false,
        hasRealtimeAccess: false,
        error: 'Invalid or expired API key'
      };
    }

    if (response.status === 403) {
      return {
        valid: true,
        hasRealtimeAccess: false,
        error: 'API key does not have Realtime API access'
      };
    }

    if (response.ok) {
      // Key is valid and has Realtime access
      // Note: We don't need to parse the response data for validation
      return {
        valid: true,
        hasRealtimeAccess: true
      };
    }

    // Any other error
    const errorText = await response.text();
    return {
      valid: false,
      hasRealtimeAccess: false,
      error: `HTTP ${response.status}: ${errorText || 'Unknown error'}`
    };
  } catch (error) {
    return {
      valid: false,
      hasRealtimeAccess: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  }
}
