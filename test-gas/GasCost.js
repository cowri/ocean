const { ethers } = require("hardhat")
const { expect } = require("chai")
const shellV2 = require("../utils-js");

/**
 * 1) end-to-end swap 
 *  meaning ERC-20 x to ERC-20 y 
 *  then ERC-20 y to ERC-20 z
 *  ...
 * 
 * 2) chain a swap through n pools
 *  meaning ERC-20 x to ocean y
 *  then ocean y to ocean z
 *  ...
 * 
 * 3) split a swap through n pools
 *  meaning ERC-20 x to ERC-20 y
 *  only one wrap, then n swaps, then one unwrap
 *
 * We are interested in the marginal gas cost as n goes from 1 to 10. 
 */

describe("Gas Cost Tests", () => {
    let ocean
    let alice // deploys tokens and pools, is an LP
    let bob // deploys ocean
    let charlotte // trades with pools

    before("Deploy Ocean", async () => {
        [alice, bob, charlotte] = await ethers.getSigners()
        const oceanContract = await ethers.getContractFactory("Ocean", bob)
        ocean = await oceanContract.deploy("")
    })

    describe("End-to-End Swap, n pools", () => {
        const decimals = "18"
        const unitAmount = shellV2.utils.numberWithFixedDecimals({ number: "100", decimals })
        const transferAmount = unitAmount.div(2)
        const initialUnitAmount = transferAmount.div(2)
        let tokens
        let pools
        let gasUsed = []

        before("Deploy 10 Pools and 11 ERC-20s", async () => {
            const tokensAndPools = await deploy10PoolsAnd11Tokens({ ocean, alice, charlotte, unitAmount, decimals, initialUnitAmount })
            tokens = tokensAndPools.tokens
            pools = tokensAndPools.pools
        })

        before("Pools have balances, alice has LP tokens, charlotte has tokens", async () => {
            const expectedPoolBalance = initialUnitAmount
            const expectedLpTokens = expectedPoolBalance.mul("2")
            const expectedCharlotteBalance = transferAmount
            const balanceCheckFns = pools.map(({ pool, xToken, yToken, shell }, index) => {
                return ocean.balanceOfBatch(
                    [pool, pool, alice.address],
                    [xToken, yToken, shell]
                )
            })
            const balancesPerPool = await Promise.all(balanceCheckFns)

            balancesPerPool.map(([
                poolBalanceX,
                poolBalanceY,
                aliceLPToken
            ]) => {
                expect(poolBalanceX).to.equal(expectedPoolBalance)
                expect(poolBalanceY).to.equal(expectedPoolBalance)
                expect(aliceLPToken).to.equal(expectedLpTokens)
            })

            const charlotteCheckFns = tokens.map((token) => {
                return token.balanceOf(charlotte.address)
            })

            const charlottesBalances = await Promise.all(charlotteCheckFns)

            charlottesBalances.map(balance => expect(balance).to.equal(expectedCharlotteBalance))
        })

        it("N = 1", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 1 })
            gasUsed.push(gas)
        })

        it("N = 2", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 2 })
            gasUsed.push(gas)
        })

        it("N = 3", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 3 })
            gasUsed.push(gas)
        })

        it("N = 4", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 4 })
            gasUsed.push(gas)
        })

        it("N = 5", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 5 })
            gasUsed.push(gas)
        })

        it("N = 6", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 6 })
            gasUsed.push(gas)
        })

        it("N = 7", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 7 })
            gasUsed.push(gas)
        })

        it("N = 8", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 8 })
            gasUsed.push(gas)
        })

        it("N = 9", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 9 })
            gasUsed.push(gas)
        })

        it("N = 10", async () => {
            const gas = await endToEndForN({ ocean, pools, signer: charlotte, n: 10 })
            gasUsed.push(gas)
        })

        it("Summary", () => {
            gasUsed.map((amount, i) => {
                console.log(`N: ${i + 1}, gas used: ${amount}`)
            })
        })
    })


    describe("Chained Swaps through n pools", () => {
        const decimals = "18"
        const unitAmount = shellV2.utils.numberWithFixedDecimals({ number: "100", decimals })
        const transferAmount = unitAmount.div(2)
        const initialUnitAmount = transferAmount.div(2)
        let tokens
        let pools
        let gasUsed = []

        before("Deploy 10 Pools and 11 ERC-20s", async () => {
            const tokensAndPools = await deploy10PoolsAnd11Tokens({ ocean, alice, charlotte, unitAmount, decimals, initialUnitAmount })
            tokens = tokensAndPools.tokens
            pools = tokensAndPools.pools
        })

        before("Pools have balances, alice has LP tokens, charlotte has tokens", async () => {
            const expectedPoolBalance = initialUnitAmount
            const expectedLpTokens = expectedPoolBalance.mul("2")
            const expectedCharlotteBalance = transferAmount
            const balanceCheckFns = pools.map(({ pool, xToken, yToken, shell }, index) => {
                return ocean.balanceOfBatch(
                    [pool, pool, alice.address],
                    [xToken, yToken, shell]
                )
            })
            const balancesPerPool = await Promise.all(balanceCheckFns)

            balancesPerPool.map(([
                poolBalanceX,
                poolBalanceY,
                aliceLPToken
            ]) => {
                expect(poolBalanceX).to.equal(expectedPoolBalance)
                expect(poolBalanceY).to.equal(expectedPoolBalance)
                expect(aliceLPToken).to.equal(expectedLpTokens)
            })

            const charlotteCheckFns = tokens.map((token) => {
                return token.balanceOf(charlotte.address)
            })

            const charlottesBalances = await Promise.all(charlotteCheckFns)

            charlottesBalances.map(balance => expect(balance).to.equal(expectedCharlotteBalance))
        })

        it("N = 1", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 1 })
            gasUsed.push(gas)
        })

        it("N = 2", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 2 })
            gasUsed.push(gas)
        })

        it("N = 3", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 3 })
            gasUsed.push(gas)
        })

        it("N = 4", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 4 })
            gasUsed.push(gas)
        })

        it("N = 5", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 5 })
            gasUsed.push(gas)
        })

        it("N = 6", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 6 })
            gasUsed.push(gas)
        })

        it("N = 7", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 7 })
            gasUsed.push(gas)
        })

        it("N = 8", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 8 })
            gasUsed.push(gas)
        })

        it("N = 9", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 9 })
            gasUsed.push(gas)
        })

        it("N = 10", async () => {
            const gas = await chainedSwapsForN({ ocean, pools, signer: charlotte, n: 10 })
            gasUsed.push(gas)
        })

        it("Summary", () => {
            gasUsed.map((amount, i) => {
                console.log(`N: ${i + 1}, gas used: ${amount}`)
            })
        })
    })

    describe("Split Swaps through n pools", () => {
        const decimals = "18"
        const unitAmount = shellV2.utils.numberWithFixedDecimals({ number: "2000", decimals })
        const transferAmount = unitAmount.div(2)
        const initialUnitAmount = transferAmount.div(10)
        let tokens
        let pools
        let gasUsed = []

        before("Deploy 10 pools and 2 ERC-20s", async () => {
            const erc20Contract = await ethers.getContractFactory("ERC20MintsToDeployer", alice)
            const createTokenFns = Array.from({ length: 2 }, () => {
                return setUpToken({ ocean, tokenFactory: erc20Contract, decimals, mintAmount: unitAmount, alice, charlotte })
            })
            tokens = await Promise.all(createTokenFns)

            const constantSumContract = await ethers.getContractFactory("ConstantSum", alice)
            const createPoolsFns = Array.from({ length: 10 }, () => {
                return setUpPool({
                    ocean,
                    poolFactory: constantSumContract,
                    xToken: tokens[0].address,
                    yToken: tokens[1].address,
                    initialUnitAmount,
                    alice
                })
            })
            pools = await Promise.all(createPoolsFns)
        })

        before("Pools have balances, alice has LP tokens, charlotte has tokens", async () => {
            const expectedPoolBalance = initialUnitAmount
            const expectedLpTokens = expectedPoolBalance.mul("2")
            const expectedCharlotteBalance = transferAmount
            const balanceCheckFns = pools.map(({ pool, xToken, yToken, shell }, index) => {
                return ocean.balanceOfBatch(
                    [pool, pool, alice.address],
                    [xToken, yToken, shell]
                )

            })
            const balancesPerPool = await Promise.all(balanceCheckFns)

            balancesPerPool.map(([
                poolBalanceX,
                poolBalanceY,
                aliceLPToken
            ]) => {
                expect(poolBalanceX).to.equal(expectedPoolBalance)
                expect(poolBalanceY).to.equal(expectedPoolBalance)
                expect(aliceLPToken).to.equal(expectedLpTokens)
            })

            const charlotteCheckFns = tokens.map((token) => {
                return token.balanceOf(charlotte.address)
            })

            const charlottesBalances = await Promise.all(charlotteCheckFns)

            charlottesBalances.map(balance => expect(balance).to.equal(expectedCharlotteBalance))
        })

        it("N = 1", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 1 })
            gasUsed.push(gas)
        })

        it("N = 2", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 2 })
            gasUsed.push(gas)
        })

        it("N = 3", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 3 })
            gasUsed.push(gas)
        })

        it("N = 4", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 4 })
            gasUsed.push(gas)
        })

        it("N = 5", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 5 })
            gasUsed.push(gas)
        })

        it("N = 6", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 6 })
            gasUsed.push(gas)
        })

        it("N = 7", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 7 })
            gasUsed.push(gas)
        })

        it("N = 8", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 8 })
            gasUsed.push(gas)
        })

        it("N = 9", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 9 })
            gasUsed.push(gas)
        })

        it("N = 10", async () => {
            const gas = await parallelSwapsForN({ ocean, pools, signer: charlotte, n: 10 })
            gasUsed.push(gas)
        })

        it("Summary", () => {
            gasUsed.map((amount, i) => {
                console.log(`N: ${i + 1}, gas used: ${amount}`)
            })
        })
    })
})

const setUpToken = async ({ ocean, tokenFactory, mintAmount, decimals, alice, charlotte }) => {
    const transferAmount = mintAmount.div(2)
    const wrapAmount = transferAmount

    const token = await tokenFactory.deploy(mintAmount, decimals)

    await Promise.all([
        token.connect(alice).transfer(charlotte.address, transferAmount),
        token.connect(alice).approve(ocean.address, transferAmount),
        token.connect(charlotte).approve(ocean.address, transferAmount)
    ])

    const interaction = shellV2.interactions.wrapERC20({
        address: token.address,
        amount: wrapAmount
    })

    await shellV2.executeInteraction({ ocean, signer: alice, interaction })

    return token
}

const setUpPool = async ({ ocean, poolFactory, xToken, yToken, initialUnitAmount, alice }) => {
    const pool = await poolFactory.deploy(xToken, yToken, ocean.address)
    const shell = await pool.lpTokenId()
    const interactions = []
    interactions.push(shellV2.interactions.computeOutputAmount({
        address: pool.address,
        inputToken: xToken,
        outputToken: shell,
        specifiedAmount: initialUnitAmount,
        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
    }))
    interactions.push(shellV2.interactions.computeOutputAmount({
        address: pool.address,
        inputToken: yToken,
        outputToken: shell,
        specifiedAmount: initialUnitAmount,
        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
    }))

    await shellV2.executeInteractions({ ocean: ocean, signer: alice, interactions: interactions })
    return { pool: pool.address, xToken, yToken, shell }
}

const deploy10PoolsAnd11Tokens = async ({ ocean, alice, charlotte, unitAmount, decimals, initialUnitAmount }) => {
    const erc20Contract = await ethers.getContractFactory("ERC20MintsToDeployer", alice)
    const createTokenFns = Array.from({ length: 11 }, () => {
        return setUpToken({ ocean, tokenFactory: erc20Contract, mintAmount: unitAmount, decimals, alice, charlotte })
    })
    const tokens = await Promise.all(createTokenFns)

    const constantSumContract = await ethers.getContractFactory("ConstantSum", alice)
    const createPoolsFns = Array.from({ length: 10 }, (_, index) => {
        return setUpPool({
            ocean,
            poolFactory: constantSumContract,
            xToken: tokens[index].address,
            yToken: tokens[index + 1].address,
            initialUnitAmount,
            alice
        })
    })
    const pools = await Promise.all(createPoolsFns)

    return { tokens, pools }
}

const executeAndReturnGasUsed = async (args) => {
    const response = await shellV2.executeInteractions(args)
    const receipt = await response.wait(1)
    return receipt.gasUsed
}

const endToEndForN = async ({
    ocean,
    pools,
    signer,
    n
}) => {
    const poolsUnderTest = pools.slice(0, n)
    const interactionsArrays = Array.from({ length: n }, (_, index) => {
        return [
            shellV2.interactions.unitWrapERC20({
                address: poolsUnderTest[index].xToken,
                amount: "1"
            }),
            shellV2.interactions.computeOutputAmount({
                address: poolsUnderTest[index].pool,
                inputToken: poolsUnderTest[index].xToken,
                outputToken: poolsUnderTest[index].yToken,
                specifiedAmount: shellV2.utils.numberWithFixedDecimals({ number: "1", decimals: "18" }),
                metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
            }),
            shellV2.interactions.unwrapERC20({
                address: poolsUnderTest[index].yToken,
                amount: ethers.constants.MaxUint256
            })
        ]
    })

    const gasFns = interactionsArrays.map((interactions) => {
        return executeAndReturnGasUsed({ ocean, signer, interactions })
    })

    const gasCosts = await Promise.all(gasFns)

    const totalGas = gasCosts.reduce((acc, curr) => acc.add(curr))
    return totalGas
}

const chainedSwapsForN = async ({
    ocean,
    pools,
    signer,
    n
}) => {
    const poolsUnderTest = pools.slice(0, n)
    const wrapInteraction = [
        shellV2.interactions.unitWrapERC20({
            address: poolsUnderTest[0].xToken,
            amount: "1"
        })
    ]
    const middleInteractions = poolsUnderTest.map((poolObject) => {
        return shellV2.interactions.computeOutputAmount({
            address: poolObject.pool,
            inputToken: poolObject.xToken,
            outputToken: poolObject.yToken,
            specifiedAmount: shellV2.utils.numberWithFixedDecimals({ number: "1", decimals: "18" }),
            metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
        })
    })
    const interactions = wrapInteraction.concat(middleInteractions)
    interactions.push(shellV2.interactions.unwrapERC20({
        address: poolsUnderTest[n - 1].yToken,
        amount: ethers.constants.MaxUint256
    }))

    return await executeAndReturnGasUsed({ ocean, signer, interactions })
}

const parallelSwapsForN = async ({
    ocean,
    pools,
    signer,
    n
}) => {
    const poolsUnderTest = pools.slice(0, n)
    const wrapInteraction = [
        shellV2.interactions.unitWrapERC20({
            address: poolsUnderTest[0].xToken,
            amount: (n).toString()
        })
    ]
    const middleInteractions = poolsUnderTest.map((poolObject) => {
        return shellV2.interactions.computeOutputAmount({
            address: poolObject.pool,
            inputToken: poolObject.xToken,
            outputToken: poolObject.yToken,
            specifiedAmount: shellV2.utils.numberWithFixedDecimals({ number: "1", decimals: "18" }),
            metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
        })
    })
    const interactions = wrapInteraction.concat(middleInteractions)
    interactions.push(shellV2.interactions.unwrapERC20({
        address: poolsUnderTest[n - 1].yToken,
        amount: ethers.constants.MaxUint256
    }))

    return await executeAndReturnGasUsed({ ocean, signer, interactions })
}
