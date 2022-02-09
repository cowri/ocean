// SPDX-License-Identifier: unlicensed
// Cowri Labs Inc.

pragma solidity =0.8.4;

interface IOceanFeeChange {
    function changeUnwrapFee(uint256 nextUnwrapFeeDivisor) external;
}
