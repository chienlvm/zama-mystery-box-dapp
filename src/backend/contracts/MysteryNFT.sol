// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MysteryNFT
 * @dev ERC721 NFT được mint từ MysteryBox khi mở hộp thành công
 *      Rarity được lưu plaintext sau khi FHE decrypt
 *      Metadata được lưu trên IPFS và set URI sau khi mint
 */
contract MysteryNFT is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    uint256 private _nextTokenId = 1;

    // tokenId => rarity đã được reveal
    mapping(uint256 => string) public revealedRarity;

    constructor() ERC721("Mystery Box NFT", "MBOX") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender); // để test nhanh, sau này sẽ grant cho MysteryBox
    }

    /**
     * @dev Mint NFT cho người chơi + lưu rarity
     */
    function safeMint(address to, string calldata rarity) 
        external 
        onlyRole(MINTER_ROLE) 
        returns (uint256 tokenId) 
    {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        revealedRarity[tokenId] = rarity;
    }

    /**
     * @dev Set IPFS metadata URI cho NFT sau khi upload
     * Chỉ MINTER_ROLE (relayer) có thể gọi
     */
    function setTokenURI(uint256 tokenId, string memory uri) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        _setTokenURI(tokenId, uri);
    }

    /**
     * @dev Override tokenURI để ưu tiên IPFS URI
     * Nếu có IPFS URI → return IPFS
     * Nếu không → fallback to on-chain data URI
     */
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory)
    {
        _requireOwned(tokenId);

        // Try to get IPFS URI first (set by setTokenURI)
        string memory ipfsURI = super.tokenURI(tokenId);
        
        // If IPFS URI exists, return it
        if (bytes(ipfsURI).length > 0) {
            return ipfsURI;
        }
        
        // Fallback: Generate on-chain data URI
        string memory rarity = bytes(revealedRarity[tokenId]).length > 0 
            ? revealedRarity[tokenId] 
            : "???";

        return string(abi.encodePacked(
            "data:application/json;base64,",
            base64Encode(bytes(string(abi.encodePacked(
                '{"name":"Mystery Box #', toString(tokenId),
                '","description":"FHE-powered Mystery Box NFT",',
                '"image":"ipfs://bafybeihnwb4v2v2x2l3b5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m5m/mystery.gif",',
                '"attributes":[{"trait_type":"Rarity","value":"', rarity, '"}]}'
            ))))
        ));
    }

    // Fix lỗi supportsInterface khi inherit cả ERC721 + ERC721URIStorage + AccessControl
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }    // Helper uint256 → string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }

    // Helper Base64 encode (OZ v5 không có sẵn, thêm nhẹ)
    function base64Encode(bytes memory data) internal pure returns (string memory) {
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 length = data.length;
        bytes memory result = new bytes(((length + 2) / 3) * 4);

        uint256 i;
        uint256 j;
        uint256 buffer;
        for (i = 0; i < length; i += 3) {
            buffer = uint256(uint8(data[i])) << 16;
            if (i + 1 < length) buffer |= uint256(uint8(data[i + 1])) << 8;
            if (i + 2 < length) buffer |= uint256(uint8(data[i + 2]));

            for (uint256 k = 0; k < 4; k++) {
                if (i + k < length + 2) {
                    result[j++] = bytes1(bytes(table)[buffer >> 18]);
                    buffer <<= 6;
                } else if (i + k == length + 1) {
                    result[j++] = '=';
                }
            }
        }
        // Adjust length
        assembly { mstore(result, j) }
        return string(result);
    }
}