export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function startSiwe(): Promise<{ nonce: string }> {
  const res = await fetch(`${API_URL}/auth/siwe/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start SIWE");
  return res.json();
}

export async function verifySiwe(address: string, message: string, signature: string) {
  const res = await fetch(`${API_URL}/auth/siwe/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, message, signature }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function registerProperty(
  data: {
    matricula: string;
    previous_owner: string | null;
    current_owner: string;
    latitude: number;
    longitude: number;
  },
  token: string
) {
  const res = await fetch(`${API_URL}/properties`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao registrar propriedade");
  }
  return res.json();
}

export async function sendProposal(
  data: {
    matricula: string;
    amount: number;
    fraction?: number;
    message?: string;
  },
  token: string
) {
  const res = await fetch(`${API_URL}/proposals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao enviar proposta");
  }
  return res.json();
}

export async function decideProposal(
  proposalId: number,
  decision: "ACCEPT" | "REJECT",
  token: string
) {
  const res = await fetch(`${API_URL}/proposals/${proposalId}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ decision }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao registrar decisão");
  }
  return res.json();
}

export async function initiateTransfer(proposalId: number, token: string) {
  const res = await fetch(`${API_URL}/transfers/${proposalId}/initiate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao iniciar transferência");
  }
  return res.json();
}

export async function signTransfer(
  proposalId: number,
  action: "SIGN" | "REJECT",
  token: string
) {
  const res = await fetch(`${API_URL}/transfers/${proposalId}/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao registrar assinatura");
  }
  return res.json();
}

export async function validatePos(
  tx_reference: string,
  force_invalid: boolean,
  token: string
) {
  const res = await fetch(`${API_URL}/pos/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tx_reference, force_invalid }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao validar (PoS)");
  }
  return res.json();
}

export async function fetchAudit(matricula: string, token: string) {
  const res = await fetch(`${API_URL}/audit/${matricula}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao consultar histórico");
  }
  return res.json();
}

export async function fetchTransfers(token: string) {
  const res = await fetch(`${API_URL}/audit/transfers`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Erro ao listar transferências");
  }
  return res.json();
}
