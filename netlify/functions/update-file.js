// netlify/functions/update-file.js
// Node 18 (Netlify) - en serverless function
exports.handler = async function(event, context) {
  // CORS headers (ajuste le domaine si tu veux restreindre)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // vérifier admin key
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  const sentKey = event.headers["x-admin-key"] || event.headers["X-Admin-Key"];
  if (!ADMIN_SECRET || sentKey !== ADMIN_SECRET) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized - bad admin key" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { path, contentBase64, message, branch } = payload;
  if (!path || !contentBase64) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing path or contentBase64" }) };
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // voir variable Netlify
  const OWNER = process.env.GITHUB_OWNER || "idriskr";
  const REPO = process.env.GITHUB_REPO || "portfolio";
  const REF = branch || process.env.GITHUB_BRANCH || "main";

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;

  try {
    // 1) récupérer SHA si existe
    let sha = null;
    const getRes = await fetch(`${apiUrl}?ref=${REF}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (getRes.ok) {
      const getData = await getRes.json();
      if (getData && getData.sha) sha = getData.sha;
    }

    // 2) put/create file
    const commitMessage = message || `Update ${path} via Admin`;
    const putBody = {
      message: commitMessage,
      content: contentBase64,
      branch: REF
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(putBody)
    });

    const putData = await putRes.json();
    if (!putRes.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "GitHub API error", details: putData }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: putData }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error", details: String(err) }) };
  }
};
