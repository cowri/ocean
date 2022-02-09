// SPDX-License-Identifier: MIT
// Cowri Labs Inc.

pragma solidity =0.8.4;

import {InteractionType} from "./Interactions.sol";

/**
 * A BalanceDelta structure tracks a user's intra-transaction balance change
 *  for a particular token
 * @param tokenId ID of the tracked token
 * @param delta a signed integer that records the user's accumulated debit
 *  or credit.
 *
 * BalanceDelta positiveDelta = BalanceDelta(0xDE..AD, 100);
 * BalanceDelta negativeDelta = BalanceDelta(0xBE..EF, -100);
 *
 * At the end of the transaction the deltas are applied to the user's balances
 *  to persist the effects of the transaction.
 */
struct BalanceDelta {
    uint256 tokenId;
    int256 delta;
}

/**
 * @dev Functions relating to the intra-transaction accounting system.
 * @dev This library relies on the fact that arrays in solidity are passed by
 *  reference, rather than by value.
 *
 * `self` is an array of BalanceDelta structures.
 *
 * See the BalanceDelta declaration in OceanStructs.sol for more information.
 *
 * @dev each function uses a greedy linear search, so if there are duplicate
 *  deltas for the same tokenId, only the first delta is operated on. The
 *  duplicates will always have {tokenID: $DUPLICATE, delta: 0}.  If an tokenId
 *  is missing, the library functions will revert the transaction.  If there is
 *  an unecessary tokenId or a duplicated tokenId, the only consequence is
 *  wasted gas, so the incentive for the user is to provide the minimal set of
 *  tokenIds.
 *
 * Because the delta is a signed integer, it can be positive or negative.
 *      A positive delta can be consumed by an unwrap or a computeOutputAmount
 *      A negative delta can be covered by a wrap or a computeInputAmount
 *
 * At the end of the transaction, positive deltas are minted to the user and
 *  negative deltas are burned from the user.  This is done using the ERC-1155's
 *  _mintBatch() and _burnBatch().  Each take an array of IDs and an array
 *  of amounts.  BalanceDelta => (ids[i], amounts[i])
 */
library LibBalanceDelta {
    /**
     * @dev a BalanceDelta holds an int256 delta while the caller passes
     *  a uint256.  We need to make sure the cast won't silently truncate
     *  the most significant bit.
     * @dev because solidity numbers are two's complement representation,
     *  the absolute value of the maximum value is one unit higher than the
     *  maximum value of the minimum value.  By testing against
     *  type(int256).max, we know that amount will safely cast to both positive
     *  and negative int256 values.
     */
    modifier safeCast(uint256 amount) {
        require(
            uint256(type(int256).max) > amount,
            "Delta :: amount > int256max"
        );
        _;
    }

    /**
     * @dev increase a given tokenId's delta by an amount.
     */
    function increaseBalanceDelta(
        BalanceDelta[] memory self,
        uint256 tokenId,
        uint256 amount
    ) internal pure safeCast(amount) {
        uint256 index = _findIndexOfTokenId(self, tokenId);
        self[index].delta += int256(amount);
        return;
    }

    /**
     * @dev decrease a given tokenId's delta by an amount.
     */
    function decreaseBalanceDelta(
        BalanceDelta[] memory self,
        uint256 tokenId,
        uint256 amount
    ) internal pure safeCast(amount) {
        uint256 index = _findIndexOfTokenId(self, tokenId);
        self[index].delta -= int256(amount);
        return;
    }

    /**
     * @dev Roll over occurs when we use a stored delta as the specifiedAmount
     *      for an interaction. Some interactions can consume all of a positive
     *      delta, while others can cover all of a negative delta.
     *
     * @dev All interactions take unsigned amounts.  Some interactions take the
     *  passed amount from a user, while other interactions give the passed
     *  amount to the user. This is why we only return positive deltas for some
     *  interaction types and only return negative deltas for the others, and
     *  why this function returns a uint256 when the underlying representation
     *  of the delta is an int256.
     *
     * EXAMPLE 1. Convert 100 DAI into as many USDC as possible
     *  wrap(token: DAI, amount: 100)
     *  |> computeOutputAmount(input: DAI, output: USDC, amount: GET_BALANCE_DELTA)
     *  |> unwrap(token: USDC, amount: GET_BALANCE_DELTA)
     *
     * EXAMPLE 2. Convert as few DAI as possible into exactly 100 USDC
     *  unwrap(token: USDC, amount: 100)
     *  |> computeInputAmount(input: DAI, output: USDC, amount: GET_BALANCE_DELTA)
     *  |> unwrap(token: DAI, amount: GET_BALANCE_DELTA)
     *
     *  +----------------------+----------------------+
     *  |  Positive roll over  |  Negative roll over  |
     *  +----------------------+----------------------+
     *  | Unwrap*              | Wrap*                |
     *  | ComputeOutputAmount  | computeInputAmount   |
     *  +----------------------+----------------------+
     */
    function getBalanceDelta(
        BalanceDelta[] memory self,
        InteractionType interaction,
        uint256 tokenId
    ) internal pure returns (uint256) {
        if (
            interaction == InteractionType.UnwrapErc20 ||
            interaction == InteractionType.UnwrapErc721 ||
            interaction == InteractionType.UnwrapErc1155 ||
            interaction == InteractionType.ComputeOutputAmount
        ) {
            return _getPositiveBalanceDelta(self, tokenId);
        } else {
            // interaction == (Wrap* || ComputeInputAmount)
            return _getNegativeBalanceDelta(self, tokenId);
        }
    }

    /**
     * @dev This function transforms the accumulated deltas into the arguments
     *  expected by ERC-1155 _mintBatch() and _burnBatch so that the caller
     *  can apply the deltas to the ledger.
     * @dev ERC-1155 expects an index by index pairing between ids and amounts
     *  +-------+-------+-----------+
     *  | index | ids[] | amounts[] |
     *  +-------+-------+-----------+
     *  |  0    |  808  |  35       | <= BalanceDelta(tokenId: 808, delta: 35)
     *  |  1    |  310  |  12       | <= BalanceDelta(tokenId: 310, delta: 12)
     *  |  2    |  408  |  19       | <= BalanceDelta(tokenId: 408, delta: 19)
     *  +-------+-------+-----------+
     * @dev Positive deltas are minted to the user's balances
     * @dev Negative deltas are burned from the user's balances
     * @dev for an entry where (delta == 0), nothing is done
     * @notice the returned arrays may be empty (arr.length == 0) or singleton
     *  arrays (arr.length == 1).
     * @return mintIds array of IDs expected by ERC-1155 _mintBatch
     * @return mintAmounts array of amounts expected by ERC-1155 _mintBatch
     * @return burnIds array of IDs expected by ERC-1155 _burnBatch
     * @return burnAmounts array of amounts expected by ERC-1155 _burnBatch
     */
    function createMintAndBurnArrays(BalanceDelta[] memory self)
        internal
        pure
        returns (
            uint256[] memory mintIds,
            uint256[] memory mintAmounts,
            uint256[] memory burnIds,
            uint256[] memory burnAmounts
        )
    {
        (uint256 numberOfMints, uint256 numberOfBurns) = _getMintsAndBurns(
            self
        );
        (mintIds, mintAmounts) = _createIDAndAmountArrays(numberOfMints);
        (burnIds, burnAmounts) = _createIDAndAmountArrays(numberOfBurns);
        _copyDeltasToMintAndBurnArrays(
            self,
            mintIds,
            mintAmounts,
            burnIds,
            burnAmounts
        );
    }

    /**
     * @dev Count the number of positive deltas and the number of negative
     *  deltas among the accumulated deltas.
     * @dev The return values of this function are used to allocate memory
     *  arrays.  This function is necessary because in-memory arrays in
     *  solidity do not support push() and pop() style operations.
     * @return numberOfMints the number of positive deltas
     * @return numberOfBurns the number of negative deltas
     */
    function _getMintsAndBurns(BalanceDelta[] memory self)
        private
        pure
        returns (uint256 numberOfMints, uint256 numberOfBurns)
    {
        for (uint256 i = 0; i < self.length; i++) {
            int256 delta = self[i].delta;
            if (delta > 0) {
                numberOfMints++;
            } else if (delta < 0) {
                numberOfBurns++;
            }
        }
        assert((numberOfMints + numberOfBurns) <= self.length);
    }

    /**
     * @dev this function ensures we're creating a pair of arrays with the same
     *  length
     * @dev This is branchless because `uint[] memory arr = new uint[](0);`
     *  produces a reference to an empty array called arr with property
     *  (arr.length == 0).  Being branchless/uniform reduces complexity both
     *  inside this function and in the calling context.
     * @param numberOfElements the size of the arrays we are going to allocate.
     * @return ids an array to hold ids for an ERC-1155 batch operation
     * @return amounts an array to hold amounts for an ERC-1155 batch operation
     */
    function _createIDAndAmountArrays(uint256 numberOfElements)
        private
        pure
        returns (uint256[] memory ids, uint256[] memory amounts)
    {
        ids = new uint256[](numberOfElements);
        amounts = new uint256[](numberOfElements);
    }

    /**
     * @dev Now that we have allocated a pair of mint arrays and a pair of burn
     *  arrays, we iterate over the balance deltas again, this time moving the
     *  positive deltas, along with their assosciated tokenIds into the mints
     *  arrays, and moving the negative deltas and their assosciated tokenIds
     *  into the burns arrays.
     */
    function _copyDeltasToMintAndBurnArrays(
        BalanceDelta[] memory self,
        uint256[] memory mintIds,
        uint256[] memory mintAmounts,
        uint256[] memory burnIds,
        uint256[] memory burnAmounts
    ) private pure {
        uint256 mintsSoFar = 0;
        uint256 burnsSoFar = 0;
        for (uint256 i = 0; i < self.length; i++) {
            int256 delta = self[i].delta;
            if (delta > 0) {
                _updateIDAndAmountArrays(
                    mintIds,
                    mintAmounts,
                    mintsSoFar,
                    self[i].tokenId,
                    uint256(delta)
                );
                mintsSoFar += 1;
            } else if (delta < 0) {
                _updateIDAndAmountArrays(
                    burnIds,
                    burnAmounts,
                    burnsSoFar,
                    self[i].tokenId,
                    uint256(-delta)
                );
                burnsSoFar += 1;
            }
        }
        assert(
            (mintsSoFar == mintIds.length) && (burnsSoFar == burnIds.length)
        );
    }

    /**
     * @dev similar to the creation function above, this function exists to
     *  ensure that the ids and amounts arrays are updated in lockstep.
     */
    function _updateIDAndAmountArrays(
        uint256[] memory ids,
        uint256[] memory amounts,
        uint256 index,
        uint256 tokenId,
        uint256 amount
    ) private pure {
        ids[index] = tokenId;
        amounts[index] = amount;
    }

    /**
     * @dev returns a delta for a interaction type that expects a positive delta
     *
     * SteInterps that take a positive delta:
     *   Unwrap*
     *   ComputeOutputAmount
     */
    function _getPositiveBalanceDelta(
        BalanceDelta[] memory self,
        uint256 tokenId
    ) private pure returns (uint256) {
        uint256 index = _findIndexOfTokenId(self, tokenId);
        int256 amount = self[index].delta;
        require(amount >= 0, "PosDelta :: amount < 0");
        return uint256(amount);
    }

    /**
     * @dev returns a delta for a interaction type that expects a negative delta
     *
     * Interactions that take a negative delta:
     *   Wrap*
     *   ComputeInputAmount
     */
    function _getNegativeBalanceDelta(
        BalanceDelta[] memory self,
        uint256 tokenId
    ) private pure returns (uint256) {
        uint256 index = _findIndexOfTokenId(self, tokenId);
        int256 amount = self[index].delta;
        require(amount <= 0, "NegDelta :: amount > 0");
        return uint256(-amount);
    }

    /**
     @dev a linear search for the first BalanceDelta with a certain tokenId
     @param tokenId the key we're searching for
     @return index the location of the key
     */
    function _findIndexOfTokenId(BalanceDelta[] memory self, uint256 tokenId)
        private
        pure
        returns (uint256 index)
    {
        for (index = 0; index < self.length; index++) {
            if (self[index].tokenId == tokenId) {
                return index;
            }
        }
        revert("Delta :: missing token ID");
    }
}
