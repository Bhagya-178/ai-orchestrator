import { Artifact } from "../types";

/**
 * Detects whether a code block qualifies as a Claude-style Artifact.
 * HTML, SVG, React, Mermaid diagrams, and large scripts are elevated to Artifacts.
 */
export function extractArtifacts(content: string): Artifact[] {
  if (!content) return [];

  const artifacts: Artifact[] = [];
  // Match code blocks: ```lang\n...code...\n```
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const lang = (match[1] || "text").toLowerCase();
    const code = match[2].trim();

    // Check if block qualifies as an artifact
    const isHtml = lang === "html" || (code.includes("<!DOCTYPE html>") || (code.includes("<html") && code.includes("</html>")));
    const isSvg = lang === "svg" || (code.startsWith("<svg") && code.includes("</svg>"));
    const isMermaid = lang === "mermaid" || code.startsWith("graph ") || code.startsWith("sequenceDiagram") || code.startsWith("flowchart ");
    const isReact = lang === "jsx" || lang === "tsx" || lang === "react";
    const isSubstantialCode = (lang === "python" || lang === "py" || lang === "javascript" || lang === "js") && code.split("\n").length >= 10;

    if (isHtml || isSvg || isMermaid || isReact || isSubstantialCode) {
      let type: Artifact["type"] = "code";
      let defaultTitle = `Artifact ${index}`;

      if (isHtml) {
        type = "html";
        defaultTitle = "Interactive Web Component";
      } else if (isSvg) {
        type = "svg";
        defaultTitle = "Vector Graphic";
      } else if (isMermaid) {
        type = "mermaid";
        defaultTitle = "Architecture Diagram";
      } else if (isReact) {
        type = "react";
        defaultTitle = "React Component";
      } else if (lang === "python" || lang === "py") {
        defaultTitle = "Python Script";
      }

      // Try extracting title from first line comments e.g. <!-- Title: ... --> or # Title: ...
      const titleMatch = code.match(/^(?:<!--|#|\/\/|\/\*)\s*(?:title:)?\s*([^\r\n*]+)/i);
      const title = titleMatch && titleMatch[1].trim().length < 40 ? titleMatch[1].trim() : defaultTitle;

      artifacts.push({
        id: `artifact-${index}-${Date.now().toString(36)}`,
        title,
        type,
        language: lang,
        content: code,
      });
      index++;
    }
  }

  return artifacts;
}

/**
 * Builds a self-contained, safe HTML document string for the sandbox iframe.
 */
export function buildSandboxHtml(artifact: Artifact): string {
  if (artifact.type === "svg") {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #fdfdfd;
      font-family: system-ui, sans-serif;
    }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${artifact.content}
</body>
</html>`;
  }

  if (artifact.type === "html") {
    // If it's a full document, inject Tailwind CDN for beautiful component rendering
    if (artifact.content.includes("<html") || artifact.content.includes("<!DOCTYPE")) {
      if (!artifact.content.includes("tailwindcss") && !artifact.content.includes("<link")) {
        return artifact.content.replace("<head>", '<head><script src="https://cdn.tailwindcss.com"></script>');
      }
      return artifact.content;
    }

    const consoleBridge = `
  <script>
    (function() {
      const origLog = console.log;
      const origWarn = console.warn;
      const origErr = console.error;
      const origInfo = console.info;

      function sendToParent(type, args) {
        try {
          const serialized = Array.from(args).map(a => {
            if (typeof a === 'object') {
              try { return JSON.stringify(a); } catch(e) { return String(a); }
            }
            return String(a);
          }).join(' ');
          window.parent.postMessage({ type: 'SANDBOX_CONSOLE', level: type, message: serialized }, '*');
        } catch(e) {}
      }

      console.log = function(...args) { origLog.apply(console, args); sendToParent('log', args); };
      console.warn = function(...args) { origWarn.apply(console, args); sendToParent('warn', args); };
      console.error = function(...args) { origErr.apply(console, args); sendToParent('error', args); };
      console.info = function(...args) { origInfo.apply(console, args); sendToParent('info', args); };

      window.onerror = function(msg, url, line) {
        sendToParent('error', ['[Uncaught Error: ' + msg + ' (line ' + line + ')]']);
      };
    })();
  </script>`;

    // Wrap partial HTML
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  ${consoleBridge}
  <style>
    body {
      margin: 0;
      padding: 1.5rem;
      background: #fdfdfd;
      color: #111;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>
  ${artifact.content}
</body>
</html>`;
  }

  return "";
}

