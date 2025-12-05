import { useEffect, useState } from 'react';
async function connect() {
if (!(window as any).ethereum) {
alert('MetaMask não encontrada');
return;
}
const provider = new BrowserProvider((window as any).ethereum);
await provider.send('eth_requestAccounts', []);
const signer = await provider.getSigner();
const addr = await signer.getAddress();
setAccount(addr);


// SIWE start
setStatus('Gerando nonce…');
const { nonce } = await startSiwe();


// Monta mensagem SIWE mínima compatível com backend
const domain = window.location.host;
const uri = window.location.origin;
const chainId = Number(process.env.NEXT_PUBLIC_SIWE_CHAIN_ID || 11155111);
const issuedAt = new Date().toISOString().replace(/\..+/, 'Z');


const message = `${domain} wants you to sign in with your Ethereum account:\n${addr}\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;


setStatus('Assinando mensagem…');
const signature = await signer.signMessage(message);


setStatus('Verificando assinatura…');
const out = await verifySiwe(addr, message, signature);
setToken(out.token);
setRole(out.role);
setStatus('Autenticado');
}


return (
<main style={{maxWidth: 720, margin: '2rem auto', fontFamily: 'sans-serif'}}>
<h1>POC – Autenticação por Carteira</h1>
<button onClick={connect} style={{padding: '0.75rem 1rem', fontSize: 16}}>
Conectar Carteira (SIWE)
</button>


<div style={{marginTop: 16}}>
<strong>Status:</strong> {status}
</div>
{account && <div><strong>Wallet:</strong> {account}</div>}
{role && <div><strong>Papel:</strong> {role}</div>}


{token && (
<div style={{marginTop: 16}}>
<details>
<summary>JWT</summary>
<code style={{display:'block', wordBreak:'break-all'}}>{token}</code>
</details>
</div>
)}


<hr style={{margin: '2rem 0'}} />
<p>
Após autenticar, use o endpoint <code>/admin/assign-role</code> para atribuir papéis às wallets
(USER/REGULATOR/FINANCIAL) usando o <code>ADMIN_SECRET</code> (apenas para fins de POC).
</p>
</main>
);
}