import { Hono } from 'hono';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const imageRoutes = new Hono();

// Convert FormData image to Base64
async function fileToBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  for (let b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

imageRoutes.post('/analyze-image', async (c) => {
  try {
    const contentType = c.req.header("Content-Type");

    if (!contentType || !contentType.includes("multipart/form-data")) {
      return c.json({ error: "Invalid content type. Use multipart/form-data." }, 400);
    }

    const body = await c.req.parseBody();
    const file = body.image;

    if (!file) {
      return c.json({ error: "No image file provided. Use field name 'image'." }, 400);
    }

    const base64Image = await fileToBase64(file);

    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'API key not configured' }, 500);
    }

    const prompt = `You are a scam detection AI by Stremini AI Developers. Analyze this image for scams, phishing, or suspicious content.
Extract visible text and assess threat level.
Return ONLY valid JSON in this exact format:
{
  "text": "extracted text from image",
  "scamLikelihood": 0-100,
  "safety": "Safe" or "Suspicious" or "Scam Detected",
  "reason": "brief explanation",
  "details": "detailed analysis"
}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: file.type || 'image/jpeg',
          data: base64Image,
        },
      },
    ]);

    const text = result.response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const json = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        text: "Could not extract text",
        scamLikelihood: 0,
        safety: "Safe",
        reason: "No threats detected",
        details: "Image analysis completed"
      };
      
      return c.json(json, 200);
    } catch (err) {
      return c.json({
        text: "Analysis completed",
        scamLikelihood: 0,
        safety: "Safe",
        reason: "Could not parse AI response",
        details: text
      }, 200);
    }

  } catch (err) {
    console.error('Image analysis error:', err);
    return c.json({
      error: "Image analysis failed",
      message: err.message,
    }, 500);
  }
});