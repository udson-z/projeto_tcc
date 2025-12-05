import { useState } from "react";
import { BrowserProvider } from "ethers";
import { startSiwe, verifySiwe, registerProperty } from "../lib/api";

declare const process: { env: { [key: string]: string | undefined } };

type PropertyForm = {
  matricula: string;
  previousOwner: string;
  currentOwner: string;
  latitude: string;
  longitude: string;
};

export default function Home() {
  const [account, setAccount] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [status, setStatus] = useState<string>("Desconectado");
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [form, setForm] = useState<PropertyForm>({
    matricula: "",
    previousOwner: "",
    currentOwner: "",
    latitude: "",
    longitude: "",
  });

  async function connectWallet() {
    setError("");
    setStatus("Conectando carteira…");
    try {
      if (!(window as any).ethereum) {
        throw new Error("MetaMask não encontrada");
      }
      const provider = new BrowserProvider((window as any).ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);

      setStatus("Gerando nonce…");
      const { nonce } = await startSiwe();

      const domain = window.location.host;
      const uri = window.location.origin;
      const chainId = Number(process.env.NEXT_PUBLIC_SIWE_CHAIN_ID || 11155111);
      const issuedAt = new Date().toISOString().replace(/\..+/, "Z");
      const message = `${domain} wants you to sign in with your Ethereum account:\n${addr}\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

      setStatus("Assinando mensagem…");
      const signature = await signer.signMessage(message);

      setStatus("Verificando assinatura…");
      const out = await verifySiwe(addr, message, signature);
      setToken(out.token);
      setRole(out.role);
      setStatus("Autenticado");
    } catch (e: any) {
      setStatus("Falhou");
      setError(e?.message || "Erro ao conectar");
    }
  }

  async function submitProperty(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTxHash("");
    if (!token) {
      setError("Faça login com a carteira antes de registrar.");
      return;
    }
    try {
      setStatus("Registrando propriedade…");
      const latitude = parseFloat(form.latitude);
      const longitude = parseFloat(form.longitude);
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        throw new Error("Latitude/Longitude inválidas");
      }

      const resp = await registerProperty(
        {
          matricula: form.matricula,
          previous_owner: form.previousOwner || null,
          current_owner: form.currentOwner || account,
          latitude,
          longitude,
        },
        token
      );
      setTxHash(resp.tx_hash);
      setStatus("Propriedade registrada");
    } catch (e: any) {
      setStatus("Falhou");
      setError(e?.message || "Erro ao registrar propriedade");
    }
  }

  const updateField = (key: keyof PropertyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={{ marginTop: 0 }}>POC – Autenticação + Registro de Propriedade</h1>
        <p style={{ color: "#555" }}>
          PBI1: autenticação por carteira (SIWE simplificado) + PBI2: registro de propriedade
          em contrato Ethereum (mock por padrão).
        </p>

        <button onClick={connectWallet} style={styles.buttonPrimary}>
          {account ? "Reconectar carteira" : "Conectar carteira (SIWE)"}
        </button>
        <div style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </div>
        {account && (
          <div>
            <strong>Wallet:</strong> {account}
          </div>
        )}
        {role && (
          <div>
            <strong>Papel:</strong> {role}
          </div>
        )}
        {token && (
          <details style={{ marginTop: 8 }}>
            <summary>JWT</summary>
            <code style={styles.code}>{token}</code>
          </details>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Registrar Propriedade (PBI2)</h2>
        <form onSubmit={submitProperty}>
          <label style={styles.label}>
            Matrícula
            <input
              style={styles.input}
              value={form.matricula}
              onChange={(e) => updateField("matricula", e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            Proprietário atual (wallet)
            <input
              style={styles.input}
              value={form.currentOwner}
              placeholder={account || "0x..."}
              onChange={(e) => updateField("currentOwner", e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Proprietário anterior (opcional)
            <input
              style={styles.input}
              value={form.previousOwner}
              placeholder="0x..."
              onChange={(e) => updateField("previousOwner", e.target.value)}
            />
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ ...styles.label, flex: 1 }}>
              Latitude
              <input
                style={styles.input}
                value={form.latitude}
                onChange={(e) => updateField("latitude", e.target.value)}
                placeholder="-23.5"
                required
              />
            </label>
            <label style={{ ...styles.label, flex: 1 }}>
              Longitude
              <input
                style={styles.input}
                value={form.longitude}
                onChange={(e) => updateField("longitude", e.target.value)}
                placeholder="-46.6"
                required
              />
            </label>
          </div>

          <button type="submit" style={styles.buttonPrimary}>
            Registrar na blockchain (mock se ETH_MOCK=true)
          </button>
        </form>

        {txHash && (
          <div style={{ marginTop: 8 }}>
            <strong>Tx Hash:</strong>{" "}
            <code style={styles.code}>{txHash}</code>
          </div>
        )}
        {error && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Erro: {error}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f172a 0%, #111827 50%, #0b1224 100%)",
    color: "#f8fafc",
    padding: "40px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  card: {
    background: "#0b1224",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 20,
    maxWidth: 820,
    width: "100%",
    margin: "0 auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  },
  buttonPrimary: {
    background: "linear-gradient(135deg, #38bdf8, #6366f1)",
    color: "#0b1224",
    border: "none",
    padding: "12px 16px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontSize: 14,
    gap: 6,
    marginBottom: 12,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #1e293b",
    background: "#0f172a",
    color: "#e2e8f0",
  },
  code: {
    display: "block",
    wordBreak: "break-all",
    background: "#0f172a",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #1e293b",
    marginTop: 4,
  },
};
