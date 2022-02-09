// SPDX-License-Identifier: MIT
// Cowri Labs Inc.

pragma solidity =0.8.4;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IOceanPrimitive} from "../IOceanPrimitive.sol";
import {IOceanToken} from "../IOceanToken.sol";

contract ConstantSum is IOceanPrimitive {
    address public immutable ocean;
    uint256 public immutable xToken;
    uint256 public immutable yToken;
    uint256 public immutable lpTokenId;

    uint256 lpTokenSupply;

    enum ComputeType {
        Deposit,
        InitialDeposit,
        InitialClaim,
        Swap,
        Withdraw
    }

    constructor(
        uint256 xToken_,
        uint256 yToken_,
        address ocean_
    ) {
        ocean = ocean_;
        xToken = xToken_;
        yToken = yToken_;
        uint256[] memory registeredToken = IOceanToken(ocean_)
            .registerNewTokens(0, 1);
        lpTokenId = registeredToken[0];
    }

    modifier onlyOcean() {
        require(msg.sender == ocean);
        _;
    }

    function computeOutputAmount(
        uint256 inputToken,
        uint256 outputToken,
        uint256 inputAmount,
        address,
        bytes32
    ) external override onlyOcean returns (uint256 outputAmount) {
        ComputeType action = _determineComputeType(inputToken, outputToken);
        if (action == ComputeType.Swap) {
            outputAmount = _swap(inputAmount);
        } else if (action == ComputeType.Deposit) {
            outputAmount = _deposit(inputAmount);
        } else {
            assert(action == ComputeType.Withdraw);
            outputAmount = _withdraw(inputAmount);
        }
    }

    function computeInputAmount(
        uint256 inputToken,
        uint256 outputToken,
        uint256 outputAmount,
        address,
        bytes32
    ) external override onlyOcean returns (uint256 inputAmount) {
        ComputeType action = _determineComputeType(inputToken, outputToken);
        if (action == ComputeType.Swap) {
            inputAmount = _swap(outputAmount);
        } else if (action == ComputeType.Deposit) {
            inputAmount = _deposit(outputAmount);
        } else {
            assert(action == ComputeType.Withdraw);
            inputAmount = _withdraw(outputAmount);
        }
    }

    function getTokenSupply(uint256 tokenId)
        external
        view
        override
        returns (uint256 totalSupply)
    {
        require(tokenId == lpTokenId, "invalid tokenId");
        totalSupply = lpTokenSupply;
    }

    function _determineComputeType(uint256 inputToken, uint256 outputToken)
        private
        view
        returns (ComputeType computeType)
    {
        if (
            ((inputToken == xToken) && (outputToken == yToken)) ||
            ((inputToken == yToken) && (outputToken == xToken))
        ) {
            return ComputeType.Swap;
        } else if (
            ((inputToken == xToken) || (inputToken == yToken)) &&
            (outputToken == lpTokenId)
        ) {
            return ComputeType.Deposit;
        } else if (
            (inputToken == lpTokenId) &&
            ((outputToken == xToken) || (outputToken == yToken))
        ) {
            return ComputeType.Withdraw;
        } else {
            revert("Invalid ComputeType");
        }
    }

    function _swap(uint256 amount) private pure returns (uint256) {
        return amount;
    }

    function _deposit(uint256 amount) private returns (uint256) {
        lpTokenSupply += amount;
        return amount;
    }

    function _withdraw(uint256 amount) private returns (uint256) {
        lpTokenSupply -= amount;
        return amount;
    }
}
