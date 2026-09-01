export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const mergedOptions: RequestInit = {
    cache: 'no-store',
    ...options,
  };
  
  const response = await fetch(url, mergedOptions);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}
