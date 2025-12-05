export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";


export async function startSiwe(): Promise<{ nonce: string }> {
const res = await fetch(`${API_URL}/auth/siwe/start`, { method: 'POST' });
if (!res.ok) throw new Error('Failed to start SIWE');
return res.json();
}


export async function verifySiwe(address: string, message: string, signature: string) {
const res = await fetch(`${API_URL}/auth/siwe/verify`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ address, message, signature }),
});
if (!res.ok) throw new Error(await res.text());
return res.json();
}