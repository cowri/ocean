// SPDX-License-Identifier: unlicensed
// Cowri Labs Inc.

pragma solidity =0.8.4;

/**
 * @title Interface for external contracts that issue tokens on the Ocean's
 *  public multitoken ledger
 * @dev check the implementation in OceanERC1155 for a deeper understanding
 */
interface IOceanToken {
    function registerNewTokens(
        uint256 currentNumberOfTokens,
        uint256 numberOfAdditionalTokens
    ) external returns (uint256[] memory);
}
