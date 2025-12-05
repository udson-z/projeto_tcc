import os
import secrets
from typing import Optional

from eth_account import Account
from web3 import Web3
from web3.middleware import geth_poa_middleware

# ABI simplificada de um contrato de registro de propriedades.
PROPERTY_REGISTRY_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "matricula", "type": "string"},
            {"internalType": "string", "name": "previousOwner", "type": "string"},
            {"internalType": "string", "name": "currentOwner", "type": "string"},
            {"internalType": "int256", "name": "latitudeE6", "type": "int256"},
            {"internalType": "int256", "name": "longitudeE6", "type": "int256"},
        ],
        "name": "registerProperty",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


def _get_web3() -> Web3:
    rpc = os.getenv("ETH_RPC_URL")
    if not rpc:
        raise RuntimeError("ETH_RPC_URL não configurada")
    w3 = Web3(Web3.HTTPProvider(rpc))
    # Redes de teste PoA (ex: Sepolia) precisam do middleware.
    try:
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    except Exception:
        pass
    if not w3.is_connected():
        raise RuntimeError("Falha ao conectar no nó Ethereum")
    return w3


def _get_contract(w3: Web3):
    address = os.getenv("PROPERTY_CONTRACT_ADDRESS")
    if not address:
        raise RuntimeError("PROPERTY_CONTRACT_ADDRESS não configurado")
    return w3.eth.contract(
        address=Web3.to_checksum_address(address),
        abi=PROPERTY_REGISTRY_ABI,
    )


def register_property_onchain(
    *,
    matricula: str,
    previous_owner: Optional[str],
    current_owner: str,
    latitude: float,
    longitude: float,
) -> str:
    """
    Registra a propriedade no contrato. Por padrão roda em modo mock (ETH_MOCK=true)
    e apenas retorna um hash sintético.
    """
    if os.getenv("ETH_MOCK", "true").lower() == "true":
        return f"mock-{secrets.token_hex(16)}"

    private_key = os.getenv("ETH_PRIVATE_KEY")
    from_address = os.getenv("ETH_FROM_ADDRESS")
    if not private_key:
        raise RuntimeError("ETH_PRIVATE_KEY não configurada")

    w3 = _get_web3()
    contract = _get_contract(w3)

    sender = (
        Web3.to_checksum_address(from_address)
        if from_address
        else Account.from_key(private_key).address
    )
    nonce = w3.eth.get_transaction_count(sender)
    # Guarda coordenadas como inteiro em micrograus para evitar ponto flutuante no contrato.
    latitude_e6 = int(latitude * 1_000_000)
    longitude_e6 = int(longitude * 1_000_000)

    tx = contract.functions.registerProperty(
        matricula,
        previous_owner or "",
        current_owner,
        latitude_e6,
        longitude_e6,
    ).build_transaction(
        {
            "from": sender,
            "nonce": nonce,
            "gas": 500_000,
            "maxFeePerGas": w3.to_wei("2", "gwei"),
            "maxPriorityFeePerGas": w3.to_wei("1", "gwei"),
        }
    )

    signed = w3.eth.account.sign_transaction(tx, private_key=private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    return tx_hash.hex()
