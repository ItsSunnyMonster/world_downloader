export default async function fetchJson(url, options = {}, label = "request") {
  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid JSON response from ${url}:\n${text}`);
  }

  if (!res.ok) {
    const message =
      data?.error_description ||
      data?.error ||
      data?.message ||
      JSON.stringify(data);

    throw new Error(`${label} failed (${res.status}): ${message}`);
  }

  return data;
}
