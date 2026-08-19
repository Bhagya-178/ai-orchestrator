export async function streamChat(
  message: string,
  sessionId: string,
  onChunk: (text: string) => void,
  onMetadata: (metadata: any) => void
): Promise<void> {
  try {
    const response = await fetch("http://localhost:8000/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to chat: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === "token") {
                onChunk(parsed.token);
              } else if (parsed.type === "done") {
                onMetadata(parsed);
              }
            } catch (err) {
              console.error("Error parsing JSON chunk:", err, line);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream chat error:", error);
    throw error;
  }
}
