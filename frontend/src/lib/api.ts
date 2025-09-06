export async function chatWithQwen({
  prompt,
  character,
  character_json,
  signal,
}: {
  prompt: string;
  character?: string;
  character_json?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch("http://localhost:8000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      character,
      max_tokens: 4096,
      character_json,
      // optional system: "You are a helpful assistant."
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Qwen proxy error (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  console.log(data);
  return data.content ?? "";
}