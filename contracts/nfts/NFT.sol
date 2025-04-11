// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract NFT is ERC721, Ownable {
    uint256 public maxLevel;
    mapping(uint256 => uint256) public level;
    mapping(address => bool) public minter;
    mapping(uint256 => string) private levelURIs;
    uint256 public currentIndex = 1;

    modifier onlyMinter() {
        require(minter[msg.sender], "Only Minter");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxLevel
    ) ERC721(name, symbol) Ownable(_msgSender()) {
        maxLevel = _maxLevel;
    }

    event SetMinter(address minter, bool status, uint256 blockTime);
    event SetMaxLevel(uint256 maxLevel);
    event SetLevelURI(uint256 level, string uri);

    function setLevelURI(uint256 _level, string memory _uri) public onlyOwner {
        require(_level > 0 && _level <= maxLevel, "level wrong");
        levelURIs[_level] = _uri;
        emit SetLevelURI(_level, _uri);
    }

    function setAllLevelURIs(string[] memory _uris) public onlyOwner {
        require(_uris.length == maxLevel, "Invalid array length");
        for (uint256 i = 1; i <= maxLevel; i++) {
            levelURIs[i] = _uris[i - 1];
            emit SetLevelURI(i, _uris[i - 1]);
        }
    }

    function setMaxLevel(uint256 _maxLevel) external onlyOwner {
        maxLevel = _maxLevel;
        emit SetMaxLevel(_maxLevel);
    }

    function setMinter(address _minter, bool status) external onlyOwner {
        minter[_minter] = status;
        emit SetMinter(_minter, status, block.timestamp);
    }

    function mint(address to, uint256 _level) public onlyMinter {
        require(_level > 0 && _level <= maxLevel, "level wrong");
        _safeMint(to, currentIndex);
        level[currentIndex] = _level;
        currentIndex += 1;
    }

    function burn(uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(
            owner == _msgSender() ||
                isApprovedForAll(owner, _msgSender()) ||
                getApproved(tokenId) == _msgSender(),
            "Not owner nor approved"
        );
        _burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        ownerOf(tokenId);
        uint256 _level = level[tokenId];

        string memory levelSpecificURI = levelURIs[_level];
        require(
            bytes(levelSpecificURI).length > 0,
            "URI not set for this level"
        );

        return levelSpecificURI;
    }
}
