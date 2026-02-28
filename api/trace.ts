import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import { URL } from "url";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body as { url?: string };
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const redirects: string[] = [url];
  let currentUrl = url;
  let finalHtml = "";
  const maxRedirects = 10;
  let redirectCount = 0;

  try {
    // Step 1: Trace redirects
    while (redirectCount < maxRedirects) {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          let nextUrl = location;
          if (!nextUrl.startsWith("http")) {
            nextUrl = new URL(location, currentUrl).toString();
          }
          redirects.push(nextUrl);
          currentUrl = nextUrl;
          redirectCount++;
        } else {
          break;
        }
      } else {
        finalHtml = await response.text();
        break;
      }
    }

    const htmlSnippet = finalHtml.substring(0, 5000);

    // Step 2: Gemini analysis
    const prompt = `
      Analyze the following URL redirect chain and the final HTML snippet for security risks.

      Redirect Chain:
      ${redirects.join(" -> ")}

      Final URL: ${currentUrl}

      HTML Snippet (first 5000 chars):
      ${htmlSnippet}

      Provide a risk score from 0 to 100 (100 is extremely dangerous).
      List any suspicious elements (e.g., hidden iframes, obfuscated scripts, fake login forms, typosquatting in the final URL).
      Determine if it's likely a phishing attempt.
      Provide a brief explanation.
      Return strictly in JSON format.
    `;

    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suspiciousElements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of suspicious elements found",
            },
            riskScore: { type: Type.NUMBER, description: "Risk score from 0 to 100" },
            explanation: { type: Type.STRING, description: "Brief explanation" },
            isPhishing: { type: Type.BOOLEAN, description: "True if likely phishing" },
          },
          required: ["suspiciousElements", "riskScore", "explanation", "isPhishing"],
        },
      },
    });

    const analysis = JSON.parse(aiResponse.text?.trim() || "{}");

    res.json({
      redirects,
      finalUrl: currentUrl,
      htmlSnippet,
      analysis,
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to trace URL",
      details: error.message,
      redirects,
      finalUrl: currentUrl,
    });
  }
}
