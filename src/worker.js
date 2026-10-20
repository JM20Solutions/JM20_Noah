// Runs ONLY for the homepage ("/", see run_worker_first in wrangler.jsonc).
// Agents that send "Accept: text/markdown" get a Markdown version of the page
// (built from /llms.txt). Everyone else gets the normal static homepage.

export default {
  async fetch(request, env) {
    const method = request.method;
    const accept = request.headers.get("Accept") || "";
    const wantsMarkdown =
      (method === "GET" || method === "HEAD") &&
      /text\/markdown(?!\s*;\s*q=0(\.0*)?\s*(,|$))/i.test(accept);

    if (!wantsMarkdown) return env.ASSETS.fetch(request);

    const source = await env.ASSETS.fetch(new URL("/llms.txt", request.url));
    if (!source.ok) return env.ASSETS.fetch(request);

    const markdown = await source.text();

    return new Response(method === "HEAD" ? null : markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Vary": "Accept",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Content-Signal": "ai-train=no, search=yes, ai-input=yes",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
