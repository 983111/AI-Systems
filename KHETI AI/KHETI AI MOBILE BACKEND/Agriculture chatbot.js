// Agriculture-focused system prompt
const AGRICULTURE_PROMPT = `You are an expert agricultural advisor with deep knowledge in:
- Crop cultivation, pest management, and disease control
- Soil health, fertilization, and irrigation techniques
- Weather patterns and seasonal farming practices
- Organic and sustainable farming methods
- Livestock management and animal husbandry
- Agricultural technology and modern farming equipment
- Market trends and crop pricing
- Government schemes and subsidies for farmers

Provide practical, actionable advice to farmers. Keep responses clear, concise, and farmer-friendly. 
Use local context when possible. If you don't know something specific, be honest and suggest consulting local agricultural experts.`;

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { message, conversationHistory } = await request.json();

      if (!message) {
        return new Response(JSON.stringify({ error: 'Message is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Prepare conversation history for Gemini
      const contents = [];
      
      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          });
        }
      }

      // Add current message
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Call Gemini 2.5 Flash API
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: contents,
            systemInstruction: {
              parts: [{ text: AGRICULTURE_PROMPT }],
            },
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            },
          }),
        }
      );

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.text();
        console.error('Gemini API error:', errorData);
        return new Response(
          JSON.stringify({ error: 'Failed to get response from AI' }),
          {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const data = await geminiResponse.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

      return new Response(
        JSON.stringify({
          response: aiResponse,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};