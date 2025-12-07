# projeto_tcc

## PBI2 – Registro de Propriedade

- Backend: `POST /properties` (Bearer JWT do login SIWE). Payload:
  ```json
  {
    "matricula": "123-ABC",
    "previous_owner": "0x000... (opcional)",
    "current_owner": "0x...",
    "latitude": -23.5,
    "longitude": -46.6
  }
  ```
- Resposta: inclui `tx_hash` (mock se `ETH_MOCK=true`) e dados salvos em banco.
- Autenticação SIWE: `/auth/siwe/start` e `/auth/siwe/verify` (já usados no frontend).

### Configuração Ethereum (padrão mock)
- Por padrão não envia transação real (`ETH_MOCK=true`). Para usar rede (ex. Sepolia):
  - `ETH_MOCK=false`
  - `ETH_RPC_URL=https://sepolia.infura.io/v3/<token>` (ou outro provider)
  - `PROPERTY_CONTRACT_ADDRESS=0x...` (implantado a partir de `backend/contracts/PropertyRegistry.sol`)
  - `ETH_PRIVATE_KEY=<chave para assinar>`
  - `ETH_FROM_ADDRESS=<opcional, endereço correspondente à chave>`

### Frontend
- Página única em `frontend/src/pages/index.tsx`:
  - Conecta carteira (SIWE) e exibe JWT/role.
  - Formulário para registrar propriedade (usa API acima). 

### Roles para `/admin/assign-role`
- Envie `role` com um dos valores: `USER`, `REGULATOR`, `FINANCIAL`.
- Payload:
  ```json
  {
    "wallet": "0xabc...",
    "role": "REGULATOR",
    "admin_secret": "changeme-admin"
  }
  ```
