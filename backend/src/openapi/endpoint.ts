import { Router } from "express";
import { generateOpenApiDocument } from "./registry.js";

/**
 * Mounts the OpenAPI spec endpoint and Swagger UI documentation.
 *
 * GET /api/v1/openapi.json   — Machine-readable spec (no auth required, read-only)
 * GET /api/v1/docs           — Swagger UI (HTML, links to the spec above)
 *
 * These endpoints are intentionally unauthenticated:
 * - The spec contains no secret or private data
 * - Frontend/tooling needs to read it without credentials
 * - Security is by read-only nature (schema docs, not data)
 */
export const openapiRouter = Router();

// Cache the generated doc (immutable at runtime)
let cachedSpec: ReturnType<typeof generateOpenApiDocument> | null = null;

function getSpec() {
  if (!cachedSpec) {
    cachedSpec = generateOpenApiDocument();
  }
  return cachedSpec;
}

// GET /api/v1/openapi.json — versioned OpenAPI 3.1 spec
openapiRouter.get("/openapi.json", (_req, res) => {
  res.json(getSpec());
});

// GET /api/v1/docs — Swagger UI (CDN-hosted assets, no npm package needed)
openapiRouter.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DealFlow360 API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/v1/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});
