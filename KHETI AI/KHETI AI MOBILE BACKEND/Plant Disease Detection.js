// Cloudflare Worker implementation for Plant Disease Detection using Gemini 2.5 Flash

// Define the maximum number of retries for the API call
const MAX_RETRIES = 5;

// --- CORS Configuration ---
const CORS_HEADERS = {
    // Allows all origins. For production, consider replacing '*' with your specific front-end domain(s).
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Must match headers your client sends
    'Access-Control-Allow-Headers': 'Content-Type', 
    'Access-Control-Max-Age': '86400', // Cache preflight response for 24 hours
};

/**
 * Creates and returns a set of headers including the mandatory CORS headers.
 * @param {string} contentType The Content-Type for the response (e.g., 'application/json').
 * @returns {Headers} The complete set of headers.
 */
function createResponseHeaders(contentType = 'application/json') {
    const headers = {
        'Content-Type': contentType,
        ...CORS_HEADERS
    };
    return headers;
}
// --- End CORS Configuration ---


/**
 * Implements exponential backoff with jitter for retrying API calls.
 * This helps manage rate limits and transient network issues.
 * @param {number} attempt The current retry attempt number (0-indexed).
 * @returns {number} The delay in milliseconds.
 */
function getExponentialBackbackoffDelay(attempt) {
    // Base delay is 500ms
    const baseDelay = 500;
    // Calculate 2^attempt * baseDelay + random jitter
    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
    return Math.min(delay, 30000); // Cap the delay at 30 seconds
}

/**
 * Handles the incoming request to analyze a plant image.
 * This function processes the incoming request, calls the Gemini API, 
 * and returns a structured JSON response.
 * * @param {Request} request The incoming request object.
 * @param {Environment} env The environment variables, including GEMINI_API_KEY.
 * @returns {Response} The JSON response containing the analysis or an error.
 */
async function handleRequest(request, env) {
    // Handle only POST requests (OPTIONS is handled in the fetch wrapper)
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405, 
            headers: createResponseHeaders() 
        });
    }

    const API_KEY = env.GEMINI_API_KEY;
    if (!API_KEY) {
        return new Response(JSON.stringify({ error: 'API key not configured. Ensure GEMINI_API_KEY secret is set.' }), { 
            status: 500, 
            headers: createResponseHeaders() 
        });
    }

    try {
        // 1. Receive and parse the request body
        const { image_data: base64Image, prompt } = await request.json();

        if (!base64Image || !prompt) {
            return new Response(JSON.stringify({ error: 'Missing image_data (Base64 image) or prompt in request body.' }), { 
                status: 400, 
                headers: createResponseHeaders() 
            });
        }

        // 2. Construct the multimodal parts for the Gemini API
        const parts = [
            {
                inlineData: {
                    // Assuming common image type, adjust if app guarantees others (e.g., image/png)
                    mimeType: "image/jpeg", 
                    data: base64Image
                }
            },
            {
                text: prompt
            }
        ];

        // 3. Define the structured response schema (JSON Schema)
        const responseSchema = {
            type: "OBJECT",
            properties: {
                "plant_type": {
                    "type": "STRING",
                    "description": "The specific type of plant identified in the image (e.g., 'Tomato', 'Rose', 'Wheat')."
                },
                "disease_name": {
                    "type": "STRING",
                    "description": "The name of the disease identified (e.g., 'Late Blight', 'Powdery Mildew', or 'Healthy' if no disease is found)."
                },
                "severity": {
                    "type": "STRING",
                    "description": "The estimated severity of the disease: 'Low', 'Medium', or 'High'. Should be 'N/A' if healthy."
                },
                "treatment_steps": {
                    "type": "ARRAY",
                    "description": "A list of actionable steps for treating the identified disease or maintaining plant health.",
                    "items": { "type": "STRING" }
                }
            },
            required: ["plant_type", "disease_name", "severity", "treatment_steps"],
            propertyOrdering: ["plant_type", "disease_name", "severity", "treatment_steps"]
        };

        // 4. Construct the full API payload
        const payload = {
            contents: [{ parts: parts }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        };

        // Use the Gemini 2.5 Flash model URL
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
        
        // 5. Make the API call with retries (Exponential Backoff)
        let apiResponse;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    apiResponse = await response.json();
                    break; // Success!
                }

                if (response.status === 429 || response.status >= 500) {
                    // Retry for rate limits (429) or server errors (5xx)
                    if (attempt < MAX_RETRIES - 1) {
                        const delay = getExponentialBackbackoffDelay(attempt);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue; // Try again
                    }
                }

                // Handle non-retryable errors (e.g., 400 Bad Request)
                const errorBody = await response.json();
                console.error('Gemini API Error:', response.status, errorBody);
                return new Response(JSON.stringify({ error: `Gemini API failed with status ${response.status}`, details: errorBody }), {
                    status: response.status,
                    headers: createResponseHeaders()
                });

            } catch (networkError) {
                // Retry for network issues
                if (attempt < MAX_RETRIES - 1) {
                    const delay = getExponentialBackbackoffDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw networkError; // Re-throw if all retries fail
            }
        }
        
        if (!apiResponse) {
             return new Response(JSON.stringify({ error: 'Failed to get a response from Gemini API after multiple retries.' }), { 
                status: 504, 
                headers: createResponseHeaders() 
            });
        }

        // 6. Process and return the structured JSON result
        const generatedText = apiResponse.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedText) {
            try {
                // Parse the guaranteed JSON response
                const structuredResult = JSON.parse(generatedText);
                return new Response(JSON.stringify(structuredResult), {
                    status: 200,
                    headers: createResponseHeaders()
                });
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError, generatedText);
                return new Response(JSON.stringify({ error: 'Failed to parse structured response from AI.', raw_text: generatedText }), { 
                    status: 500, 
                    headers: createResponseHeaders() 
                });
            }
        } else {
            console.error('API Response missing generated text:', apiResponse);
            return new Response(JSON.stringify({ error: 'AI generated an empty or malformed response.', api_response: apiResponse }), { 
                status: 500, 
                headers: createResponseHeaders() 
            });
        }

    } catch (e) {
        console.error('Request processing error:', e);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: e.message }), { 
            status: 500, 
            headers: createResponseHeaders() 
        });
    }
}

// Cloudflare Workers entry point
export default {
    async fetch(request, env) {
        // 1. Handle preflight CORS requests (Crucial for web/Flutter clients)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204, // No Content
                headers: CORS_HEADERS,
            });
        }
        
        // 2. Handle all other requests (POST in this case)
        return handleRequest(request, env);
    },
};