import { useState } from "react";
import { BrowserProvider } from "ethers";
import {
  startSiwe,
  verifySiwe,
  registerProperty,
  sendProposal,
  decideProposal,
  initiateTransfer,
  signTransfer,
  validatePos,
} from "../lib/api";

declare const process: { env: { [key: string]: string | undefined } };

type PropertyForm = {
  matricula: string;
  previousOwner: string;
  currentOwner: string;
  latitude: string;
  longitude: string;
};

type ProposalForm = {
  matricula: string;
  amount: string;
  fraction: string;
  message: string;
};

type DecisionForm = {
  proposalId: string;
  decision: "ACCEPT" | "REJECT";
};

type TransferForm = {
  proposalId: string;
  action: "SIGN" | "REJECT";
};

type PosForm = {
  txReference: string;
  forceInvalid: boolean;
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
  const [proposalForm, setProposalForm] = useState<ProposalForm>({
    matricula: "",
    amount: "",
    fraction: "",
    message: "",
  });
  const [proposalStatus, setProposalStatus] = useState<string>("Nenhuma proposta enviada");
  const [proposalError, setProposalError] = useState<string>("");
  const [proposalInfo, setProposalInfo] = useState<string>("");
  const [decisionForm, setDecisionForm] = useState<DecisionForm>({
    proposalId: "",
    decision: "ACCEPT",
  });
  const [decisionStatus, setDecisionStatus] = useState<string>("Aguardando decisão");
  const [decisionError, setDecisionError] = useState<string>("");
  const [decisionInfo, setDecisionInfo] = useState<string>("");
  const [transferStatus, setTransferStatus] = useState<string>("Transferência não iniciada");
  const [transferError, setTransferError] = useState<string>("");
  const [transferInfo, setTransferInfo] = useState<string>("");
  const [transferForm, setTransferForm] = useState<TransferForm>({
    proposalId: "",
    action: "SIGN",
  });
  const [posForm, setPosForm] = useState<PosForm>({ txReference: "", forceInvalid: false });
  const [posStatus, setPosStatus] = useState<string>("Aguardando validação PoS");
  const [posError, setPosError] = useState<string>("");
  const [posInfo, setPosInfo] = useState<string>("");

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

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault();
    setProposalError("");
    setProposalInfo("");
    if (!token) {
      setProposalError("Faça login com a carteira antes de enviar uma proposta.");
      return;
    }
    try {
      setProposalStatus("Enviando proposta…");
      const amount = parseFloat(proposalForm.amount);
      const fraction = proposalForm.fraction ? parseFloat(proposalForm.fraction) : undefined;
      if (Number.isNaN(amount) || amount <= 0) {
        throw new Error("Valor da proposta inválido");
      }
      if (fraction !== undefined && (Number.isNaN(fraction) || fraction <= 0 || fraction > 100)) {
        throw new Error("Informe a fração entre 0.01 e 100%");
      }

      const resp = await sendProposal(
        {
          matricula: proposalForm.matricula,
          amount,
          fraction,
          message: proposalForm.message || undefined,
        },
        token
      );
      setProposalStatus("Proposta enviada");
      setProposalInfo(
        `Proposta #${resp.id} para ${resp.owner_wallet} (${resp.status}). Matrícula ${resp.matricula || proposalForm.matricula}`
      );
    } catch (e: any) {
      setProposalStatus("Falhou");
      setProposalError(e?.message || "Erro ao enviar proposta");
    }
  }

  const updateProposalField = (key: keyof ProposalForm, value: string) => {
    setProposalForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDecisionField = (key: keyof DecisionForm, value: string) => {
    setDecisionForm((prev) => ({ ...prev, [key]: value as DecisionForm[keyof DecisionForm] }));
  };

  const updateTransferField = (key: keyof TransferForm, value: string) => {
    setTransferForm((prev) => ({ ...prev, [key]: value as TransferForm[keyof TransferForm] }));
  };

  const updatePosField = (key: keyof PosForm, value: string | boolean) => {
    setPosForm((prev) => ({ ...prev, [key]: value as PosForm[keyof PosForm] }));
  };

  async function submitDecision(e: React.FormEvent) {
    e.preventDefault();
    setDecisionError("");
    setDecisionInfo("");
    if (!token) {
      setDecisionError("Faça login com a carteira antes de decidir uma proposta.");
      return;
    }
    try {
      setDecisionStatus("Enviando decisão…");
      const proposalId = parseInt(decisionForm.proposalId, 10);
      if (Number.isNaN(proposalId) || proposalId <= 0) {
        throw new Error("ID da proposta inválido");
      }
      const resp = await decideProposal(proposalId, decisionForm.decision, token);
      setDecisionStatus("Decisão registrada");
      setDecisionInfo(
        `Proposta #${resp.id} marcada como ${resp.status} para comprador ${resp.proposer_wallet}`
      );
    } catch (e: any) {
      setDecisionStatus("Falhou");
      setDecisionError(e?.message || "Erro ao decidir proposta");
    }
  }

  async function submitInitiateTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTransferError("");
    setTransferInfo("");
    if (!token) {
      setTransferError("Faça login com a carteira antes de iniciar a transferência.");
      return;
    }
    try {
      setTransferStatus("Iniciando fluxo de multiassinatura…");
      const proposalId = parseInt(transferForm.proposalId, 10);
      if (Number.isNaN(proposalId) || proposalId <= 0) {
        throw new Error("ID da proposta inválido");
      }
      const resp = await initiateTransfer(proposalId, token);
      setTransferStatus("Fluxo criado");
      setTransferInfo(
        `Transferência #${resp.id} ligada à proposta ${resp.proposal_id}. Assinaturas: ` +
          `owner=${resp.owner_signed}, buyer=${resp.buyer_signed}, regulator=${resp.regulator_signed}, financial=${resp.financial_signed}`
      );
    } catch (e: any) {
      setTransferStatus("Falhou");
      setTransferError(e?.message || "Erro ao iniciar transferência");
    }
  }

  async function submitSignTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTransferError("");
    setTransferInfo("");
    if (!token) {
      setTransferError("Faça login com a carteira antes de assinar/rejeitar.");
      return;
    }
    try {
      setTransferStatus("Enviando assinatura…");
      const proposalId = parseInt(transferForm.proposalId, 10);
      if (Number.isNaN(proposalId) || proposalId <= 0) {
        throw new Error("ID da proposta inválido");
      }
      const resp = await signTransfer(proposalId, transferForm.action, token);
      setTransferStatus("Assinatura registrada");
      setTransferInfo(
        `Transferência #${resp.id} status=${resp.status}. Assinaturas: owner=${resp.owner_signed}, buyer=${resp.buyer_signed}, regulator=${resp.regulator_signed}, financial=${resp.financial_signed}` +
          (resp.tx_hash ? ` | tx=${resp.tx_hash}` : "")
      );
    } catch (e: any) {
      setTransferStatus("Falhou");
      setTransferError(e?.message || "Erro ao registrar assinatura");
    }
  }

  async function submitPosValidation(e: React.FormEvent) {
    e.preventDefault();
    setPosError("");
    setPosInfo("");
    if (!token) {
      setPosError("Faça login antes de validar via PoS.");
      return;
    }
    try {
      setPosStatus("Validando transação (PoS)...");
      if (!posForm.txReference) {
        throw new Error("Informe uma referência de transação");
      }
      const resp = await validatePos(posForm.txReference, posForm.forceInvalid, token);
      setPosStatus("Validação concluída");
      setPosInfo(
        `Status ${resp.status} | approvals ${resp.approvals}/${resp.required} | validators=${resp.selected_validators.join(
          ", "
        )}${resp.tx_hash ? ` | tx=${resp.tx_hash}` : ""}`
      );
    } catch (e: any) {
      setPosStatus("Falhou");
      setPosError(e?.message || "Erro na validação PoS");
    }
  }

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

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Proposta de Compra/Divisão (PBI3)</h2>
        <form onSubmit={submitProposal}>
          <label style={styles.label}>
            Matrícula da propriedade
            <input
              style={styles.input}
              value={proposalForm.matricula}
              onChange={(e) => updateProposalField("matricula", e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            Valor ofertado
            <input
              style={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={proposalForm.amount}
              onChange={(e) => updateProposalField("amount", e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            Fração desejada (%)
            <input
              style={styles.input}
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={proposalForm.fraction}
              placeholder="Ex: 100 para compra total, 25 para 1/4"
              onChange={(e) => updateProposalField("fraction", e.target.value)}
            />
          </label>

          <label style={styles.label}>
            Mensagem (opcional)
            <textarea
              style={{ ...styles.input, minHeight: 80 }}
              value={proposalForm.message}
              onChange={(e) => updateProposalField("message", e.target.value)}
              placeholder="Detalhes da proposta, prazos, condições…"
            />
          </label>

          <button type="submit" style={styles.buttonPrimary}>
            Enviar proposta ao proprietário
          </button>
        </form>

        <div style={{ marginTop: 8 }}>
          <strong>Status:</strong> {proposalStatus}
        </div>
        {proposalInfo && (
          <div style={{ marginTop: 6 }}>
            <strong>Retorno:</strong> {proposalInfo}
          </div>
        )}
        {proposalError && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Erro: {proposalError}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Decidir Proposta (PBI4)</h2>
        <form onSubmit={submitDecision}>
          <label style={styles.label}>
            ID da proposta
            <input
              style={styles.input}
              type="number"
              min="1"
              value={decisionForm.proposalId}
              onChange={(e) => updateDecisionField("proposalId", e.target.value)}
              required
            />
          </label>

          <label style={styles.label}>
            Decisão
            <select
              style={{ ...styles.input, color: "#e2e8f0" }}
              value={decisionForm.decision}
              onChange={(e) => updateDecisionField("decision", e.target.value)}
            >
              <option value="ACCEPT">Aceitar</option>
              <option value="REJECT">Rejeitar</option>
            </select>
          </label>

          <button type="submit" style={styles.buttonPrimary}>
            Registrar decisão
          </button>
        </form>

        <div style={{ marginTop: 8 }}>
          <strong>Status:</strong> {decisionStatus}
        </div>
        {decisionInfo && (
          <div style={{ marginTop: 6 }}>
            <strong>Retorno:</strong> {decisionInfo}
          </div>
        )}
        {decisionError && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Erro: {decisionError}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Multiassinatura de Transferência (PBI5)</h2>
        <p style={{ color: "#9ca3af", marginTop: 0 }}>
          Exige assinaturas do proprietário, comprador, regulador e agente financeiro antes da
          execução na blockchain (mockável).
        </p>
        <form onSubmit={submitInitiateTransfer} style={{ marginBottom: 12 }}>
          <label style={styles.label}>
            ID da proposta (ACEITA)
            <input
              style={styles.input}
              type="number"
              min="1"
              value={transferForm.proposalId}
              onChange={(e) => updateTransferField("proposalId", e.target.value)}
              required
            />
          </label>
          <button type="submit" style={styles.buttonPrimary}>
            Iniciar fluxo de transferência
          </button>
        </form>

        <form onSubmit={submitSignTransfer}>
          <label style={styles.label}>
            ID da proposta (para assinar)
            <input
              style={styles.input}
              type="number"
              min="1"
              value={transferForm.proposalId}
              onChange={(e) => updateTransferField("proposalId", e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Ação
            <select
              style={{ ...styles.input, color: "#e2e8f0" }}
              value={transferForm.action}
              onChange={(e) => updateTransferField("action", e.target.value as "SIGN" | "REJECT")}
            >
              <option value="SIGN">Assinar</option>
              <option value="REJECT">Rejeitar</option>
            </select>
          </label>
          <button type="submit" style={styles.buttonPrimary}>
            Enviar assinatura/decisão
          </button>
        </form>

        <div style={{ marginTop: 8 }}>
          <strong>Status:</strong> {transferStatus}
        </div>
        {transferInfo && (
          <div style={{ marginTop: 6 }}>
            <strong>Retorno:</strong> {transferInfo}
          </div>
        )}
        {transferError && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Erro: {transferError}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Validação por Proof of Stake (PBI6)</h2>
        <p style={{ color: "#9ca3af", marginTop: 0 }}>
          Seleciona validadores por stake configurado e registra o resultado. Use uma referência de
          transação (ex: hash ou ID interno) e, se quiser simular falha, marque a opção abaixo.
        </p>
        <form onSubmit={submitPosValidation}>
          <label style={styles.label}>
            Referência da transação
            <input
              style={styles.input}
              value={posForm.txReference}
              onChange={(e) => updatePosField("txReference", e.target.value)}
              placeholder="ex: tx-123 ou hash"
              required
            />
          </label>
          <label style={{ ...styles.label, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={posForm.forceInvalid}
              onChange={(e) => updatePosField("forceInvalid", e.target.checked)}
            />
            Simular rejeição pelos validadores
          </label>
          <button type="submit" style={styles.buttonPrimary}>
            Validar via PoS
          </button>
        </form>

        <div style={{ marginTop: 8 }}>
          <strong>Status:</strong> {posStatus}
        </div>
        {posInfo && (
          <div style={{ marginTop: 6 }}>
            <strong>Retorno:</strong> {posInfo}
          </div>
        )}
        {posError && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Erro: {posError}
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
