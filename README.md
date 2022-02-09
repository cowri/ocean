# Shell v2 Ocean

If you aren't familiar with solidity, the [white paper](Ocean_-_Shell_v2_Part_2.pdf) outlines the high level behavior and the key implementation details of the code in this repository.

## What is the Ocean?
The Ocean is a new paradigm for DeFi that is designed to seamlessly and efficiently compose any type of primitive: AMMs, lending pools, algorithmic stablecoins, NFT markets, or even primitives yet to be invented. Composing primitives on the Ocean can save up to four times the marginal gas cost and requires no additional smart contracts beyond the core protocol. Not only are primitives built on the Ocean simpler, they also become part of a larger, composable ecosystem.

## Code in this repo

The code is heavily commented.

The top level contract is `contracts/Ocean.sol`, which manages interactions and fees.  It inherits from `contracts/OceanERC1155.sol`, which implements the shared multitoken ledger.  The Ocean is deployed as a single contract.

### Ocean Implementation
The interfaces are declared in:
 - [`contracts/Interactions.sol`](contracts/Interactions.sol)
 - [`contracts/IOceanToken.sol`](contracts/IOceanToken.sol)
 - [`contracts/IOceanFeeChange.sol`](contracts/IOceanFeeChange.sol)
 - [`contracts/IOceanPrimitive.sol`](contracts/IOceanPrimitive.sol)

The key data structures are declared in:
 - [`contracts/Interactions.sol`](contracts/Interactions.sol)
 - [`contracts/BalanceDelta.sol`](contracts/BalanceDelta.sol)

There is a library for managing BalanceDelta arrays:
 - [`contracts/BalanceDelta.sol`](contracts/BalanceDelta.sol)

### Testing
The smart contracts necessary for testing the ocean are in:
 - [`contracts/test/*`](contracts/test)

The unit tests, which are used to generate the coverage report, are in:
 - [`test/*`](test/)

The gas tests, which were used to generate data for the white paper, are in:
 - [`test-gas/GasCost.js`](test-gas/GasCost.js)

To compile the contracts and run the tests yourself, you can clone this repository and run
```shell
npm install
```
to install the development environment, and then you can run
```shell
npm run coverage
npm run gas-costs
```
The coverage report will be located at `coverage/index.html`, and can be viewed with your web browser.
