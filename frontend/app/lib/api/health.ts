export async function getHealth(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:8000/health", { cache: "no-store" });
    return res.ok;
  } catch (error) {
    return false;
  }
}
