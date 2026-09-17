export function getLeadEndpoint() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''
  return `${baseUrl}/api/lead`
}
