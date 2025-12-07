// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Registro simplificado de propriedades para POC
/// @notice Não pronta para produção; apenas demonstração.
contract PropertyRegistry {
    struct Property {
        string matricula;
        string previousOwner;
        string currentOwner;
        int256 latitudeE6;
        int256 longitudeE6;
        address submittedBy;
        uint256 registeredAt;
    }

    mapping(string => Property) public properties;
    event PropertyRegistered(string indexed matricula, string currentOwner, string txHash);

    function registerProperty(
        string memory matricula,
        string memory previousOwner,
        string memory currentOwner,
        int256 latitudeE6,
        int256 longitudeE6
    ) public {
        // Simples: sobrescreve se já existir, mantendo rastreabilidade por evento.
        properties[matricula] = Property({
            matricula: matricula,
            previousOwner: previousOwner,
            currentOwner: currentOwner,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            submittedBy: msg.sender,
            registeredAt: block.timestamp
        });
        emit PropertyRegistered(matricula, currentOwner, _toHexString(msg.sender));
    }

    function _toHexString(address account) internal pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes16 hexSymbols = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = hexSymbols[uint8(value[i] >> 4)];
            str[3 + i * 2] = hexSymbols[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
