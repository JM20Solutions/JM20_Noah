// Serves a Markdown version of the homepage to clients that send
// "Accept: text/markdown" (agents). Browsers never send that header,
// so everyone else gets the normal HTML page untouched.
// Markdown source: /llms.txt (single source of truth, already Markdown).

export async function onRequest(context) {
  const { request, env, next } = context;

  const method = request.method;
  const accept = request.headers.get("Accept") || "";
  const wantsMarkdown =
    (method === "GET" || method === "HEAD") &&
    /text\/markdown(?!\s*;\s*q=0(\.0*)?\s*(,|$))/i.test(accept);

  if (!wantsMarkdown) return next();

  const source = await env.ASSETS.fetch(new URL("/llms.txt", request.url));
  if (!source.ok) return next();

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
}
