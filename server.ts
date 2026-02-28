import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import https from "https";
import { URL } from "url";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to trace redirects and get final HTML
  app.post("/api/trace", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const redirects: string[] = [url];
    let currentUrl = url;
    let finalHtml = "";
    const maxRedirects = 10;
    let redirectCount = 0;

    try {
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

      res.json({
        redirects,
        finalUrl: currentUrl,
        htmlSnippet: finalHtml.substring(0, 5000), // Send first 5000 chars of HTML for analysis
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to trace URL",
        details: error.message,
        redirects,
        finalUrl: currentUrl,
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
