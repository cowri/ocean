const { ethers } = require("hardhat")
const { expect } = require("chai")
const shellV2 = require("../utils-js");

describe("Interaction Tests", () => {
    let ocean
    let alice // Primitive Deployer
    let bob // Ocean Deployer
    let charlotte // Basic User
    let dina // Forwarder Deployer

    before("Deploy Ocean", async () => {
        [alice, bob, charlotte, dina] = await ethers.getSigners()
        const oceanContract = await ethers.getContractFactory("Ocean", bob)
        ocean = await oceanContract.deploy("")
    })

    describe("Forwarder Tests", () => {
        let forwarder
        let token

        before("Deploy forwarder, token", async () => {
            const forwarderContract = await ethers.getContractFactory("Forwarder", dina)
            forwarder = await forwarderContract.deploy()
            const erc20Contract = await ethers.getContractFactory("ERC20MintsToDeployer", alice)
            const decimals = "18"
            const mintAmount = shellV2.utils.numberWithFixedDecimals({ number: "100", decimals })
            token = await erc20Contract.deploy(mintAmount, decimals)
            await token.connect(alice).approve(ocean.address, mintAmount);

        })

        it("Alice approves forwarder as operator", async () => {
            await ocean.connect(alice).setApprovalForAll(forwarder.address, true)
            expect(await ocean.isApprovedForAll(alice.address, forwarder.address)).to.equal(true)
        })

        it("Alice forwards a wrap interaction", async () => {
            const interaction = shellV2.interactions.unitWrapERC20({
                address: token.address,
                amount: "1"
            })

            expect(
                await ocean.balanceOf(alice.address, token.address)
            ).to.equal(0)

            expect(
                await forwarder.connect(alice).singlePassthrough(interaction, ocean.address)
            ).to.have.property('hash')

            expect(
                await ocean.balanceOf(alice.address, token.address)
            ).to.equal(
                shellV2.utils.numberWithFixedDecimals({
                    number: "1",
                    decimals: "18"
                }))
        })

        it("Alice forwards a wrap and unwrap interaction", async () => {
            const interactions = [
                shellV2.interactions.unitWrapERC20({
                    address: token.address,
                    amount: "2"
                }),
                shellV2.interactions.unitUnwrapERC20({
                    address: token.address,
                    amount: "1"
                })
            ]
            const ids = [token.address]

            expect(
                await ocean.balanceOf(alice.address, token.address)
            ).to.equal(
                shellV2.utils.numberWithFixedDecimals({
                    number: "1",
                    decimals: "18"
                }))

            expect(
                await forwarder.connect(alice).multiplePassthrough(interactions, ids, ocean.address)
            ).to.have.property('hash')

            expect(
                await ocean.balanceOf(alice.address, token.address)
            ).to.equal(
                shellV2.utils.numberWithFixedDecimals({
                    number: "2",
                    decimals: "18"
                }))
        })

        it("Forward without approval reverts", async () => {
            const interaction = shellV2.interactions.unitWrapERC20({
                address: token.address,
                amount: "1"
            })

            await expect(
                forwarder.connect(charlotte).singlePassthrough(interaction, ocean.address)
            ).to.be.revertedWith('Forwarder not approved')
        })
    })

    describe("Interaction and BalanceDelta tests", () => {
        const decimals = "18"
        const mintAmount = shellV2.utils.numberWithFixedDecimals({
            number: "100",
            decimals
        })
        const transferAmount = mintAmount.div(2)
        let tokens
        let pools

        before("Deploy and distribute tokens", async () => {
            const erc20Contract = await ethers.getContractFactory("ERC20MintsToDeployer", alice)
            const tokenA = await erc20Contract.deploy(mintAmount, decimals)
            const tokenB = await erc20Contract.deploy(mintAmount, decimals)
            const tokenC = await erc20Contract.deploy(mintAmount, decimals)
            tokens = [tokenA, tokenB, tokenC]

            await Promise.all(tokens.map((token) => {
                return [
                    token.connect(alice).transfer(charlotte.address, transferAmount),
                    token.connect(alice).approve(ocean.address, transferAmount),
                    token.connect(charlotte).approve(ocean.address, transferAmount)
                ]
            }))
        })

        it("Transaction reverts when ids array is missing an ID", async () => {
            await expect(
                ocean.connect(alice).doMultipleInteractions(
                    [
                        shellV2.interactions.unitWrapERC20({
                            address: tokens[0].address,
                            amount: "1"
                        }),
                        shellV2.interactions.unitWrapERC20({
                            address: tokens[1].address,
                            amount: "1"
                        }),
                    ],
                    [
                        tokens[0].address
                    ]
                )
            ).to.be.revertedWith("Delta :: missing token ID")
        })

        it("Alice deploys and LPs into pool", async () => {
            const constantSumContract = await ethers.getContractFactory("ConstantSum", alice)
            const poolA = await constantSumContract.deploy(tokens[0].address, tokens[1].address, ocean.address)
            const shellA = await poolA.lpTokenId()

            // Pool won't swap with anyone but the Ocean.
            await expect(
                poolA.computeInputAmount(
                    0,
                    0,
                    0,
                    ethers.constants.AddressZero,
                    shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                )
            ).to.be.reverted

            // Pool won't swap when input <-> output relationship is not supported
            await expect(
                shellV2.executeInteraction({
                    ocean,
                    signer: alice,
                    interaction: shellV2.interactions.computeOutputAmount({
                        address: poolA.address,
                        inputToken: tokens[0].address,
                        outputToken: tokens[0].address,
                        specifiedAmount: 1,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    })
                })
            ).to.be.revertedWith("Invalid ComputeType")

            expect(await ocean.tokensToPrimitives(shellA)).to.equal(poolA.address)
            // LP into poolA, wrap necessary tokens
            await shellV2.executeInteractions({
                ocean,
                signer: alice,
                interactions: [
                    shellV2.interactions.computeOutputAmount({
                        address: poolA.address,
                        inputToken: tokens[0].address,
                        outputToken: shellA,
                        specifiedAmount: transferAmount,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: poolA.address,
                        inputToken: tokens[1].address,
                        outputToken: shellA,
                        specifiedAmount: transferAmount,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.wrapERC20({
                        address: tokens[0].address,
                        amount: ethers.constants.MaxUint256
                    }),
                    shellV2.interactions.wrapERC20({
                        address: tokens[1].address,
                        amount: ethers.constants.MaxUint256
                    })
                ]
            })
            const shellABalance = await ocean.balanceOf(alice.address, shellA)
            expect(shellABalance).to.equal(transferAmount.mul(2))
            await expect(poolA.getTokenSupply(0)).to.be.revertedWith("invalid tokenId")
            expect(await poolA.getTokenSupply(shellA)).to.equal(shellABalance)


            const poolB = await constantSumContract.deploy(tokens[2].address, shellA, ocean.address)
            const shellB = await poolB.lpTokenId()
            expect(await ocean.tokensToPrimitives(shellB)).to.equal(poolB.address)

            await shellV2.executeInteractions({
                ocean,
                signer: alice,
                interactions: [
                    shellV2.interactions.wrapERC20({
                        address: tokens[2].address,
                        amount: transferAmount
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: poolB.address,
                        inputToken: tokens[2].address,
                        outputToken: shellB,
                        specifiedAmount: transferAmount,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: poolB.address,
                        inputToken: shellA,
                        outputToken: shellB,
                        specifiedAmount: transferAmount,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                ]
            })
            expect(await ocean.balanceOf(alice.address, shellB)).to.equal(transferAmount.mul(2))
            pools = [poolA, poolB]
        })

        it("Charlotte does a forward swap", async () => {
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.wrapERC20({
                        address: tokens[0].address,
                        amount: transferAmount
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: tokens[0].address,
                        outputToken: tokens[1].address,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.unwrapERC20({
                        address: tokens[1].address,
                        amount: ethers.constants.MaxUint256
                    })
                ]
            })
            const finalCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[1].balanceOf(charlotte.address)
            ])

            expect(
                finalCharlotteBalances[0]
            ).to.equal(0)
            expect(
                finalCharlotteBalances[1]
            ).to.equal(transferAmount.add(transferAmount))
        })

        it("Charlotte does a backward swap", async () => {
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.unwrapERC20({
                        address: tokens[0].address,
                        amount: transferAmount
                    }),
                    shellV2.interactions.computeInputAmount({
                        address: pools[0].address,
                        inputToken: tokens[1].address,
                        outputToken: tokens[0].address,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.wrapERC20({
                        address: tokens[1].address,
                        amount: ethers.constants.MaxUint256
                    })
                ]
            })
            const finalCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[1].balanceOf(charlotte.address)
            ])

            expect(
                finalCharlotteBalances[0]
            ).to.equal(transferAmount)
            expect(
                finalCharlotteBalances[1]
            ).to.equal(transferAmount)
        })

        it("Can unwrap multiple tokens at once", async () => {
            await Promise.all([
                tokens[0].connect(charlotte).approve(ocean.address, transferAmount),
                tokens[1].connect(charlotte).approve(ocean.address, transferAmount)
            ])
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.unitWrapERC20({
                        address: tokens[0].address,
                        amount: "1"
                    }),
                    shellV2.interactions.unitWrapERC20({
                        address: tokens[1].address,
                        amount: "1"
                    })
                ]
            })
            const initialBalances = await ocean.balanceOfBatch(
                [charlotte.address, charlotte.address],
                [tokens[0].address, tokens[1].address]
            )
            initialBalances.map((balance) => {
                expect(balance).to.equal(shellV2.utils.numberWithFixedDecimals({
                    number: "1",
                    decimals: "18"
                }))
            })
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.unitUnwrapERC20({
                        address: tokens[0].address,
                        amount: "1"
                    }),
                    shellV2.interactions.unitUnwrapERC20({
                        address: tokens[1].address,
                        amount: "1"
                    })
                ]
            })
            const finalBalances = await ocean.balanceOfBatch(
                [charlotte.address, charlotte.address],
                [tokens[0].address, tokens[1].address]
            )
            finalBalances.map((balance) => {
                expect(balance).to.equal(0)
            })
        })

        it("Alice can burn LP tokens", async () => {
            const shellA = await pools[0].lpTokenId()
            const initial = await ocean.balanceOf(alice.address, shellA)
            await shellV2.executeInteractions({
                ocean,
                signer: alice,
                interactions: [
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: shellA,
                        outputToken: tokens[0].address,
                        specifiedAmount: 1,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: shellA,
                        outputToken: tokens[1].address,
                        specifiedAmount: 1,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                ]
            })
            expect(await ocean.balanceOf(alice.address, shellA)).to.equal(ethers.BigNumber.from(initial).sub(2))

        })

        it("Cannot use a negative delta for an unwrap", async () => {
            await expect(
                shellV2.executeInteractions({
                    ocean,
                    signer: charlotte,
                    interactions: [
                        shellV2.interactions.computeInputAmount({
                            address: pools[0].address,
                            inputToken: tokens[0].address,
                            outputToken: tokens[1].address,
                            specifiedAmount: shellV2.utils.numberWithFixedDecimals({
                                number: "1",
                                decimals
                            }),
                            metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                        }),
                        shellV2.interactions.unwrapERC20({
                            address: tokens[0].address,
                            amount: ethers.constants.MaxUint256
                        })
                    ]
                })
            ).to.be.revertedWith("PosDelta :: amount < 0")
        })

        it("Cannot use a positive delta for a wrap", async () => {
            await expect(
                shellV2.executeInteractions({
                    ocean,
                    signer: charlotte,
                    interactions: [
                        shellV2.interactions.computeInputAmount({
                            address: pools[0].address,
                            inputToken: tokens[0].address,
                            outputToken: tokens[1].address,
                            specifiedAmount: shellV2.utils.numberWithFixedDecimals({
                                number: "1",
                                decimals
                            }),
                            metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                        }),
                        shellV2.interactions.wrapERC20({
                            address: tokens[1].address,
                            amount: ethers.constants.MaxUint256
                        })
                    ]
                })
            ).to.be.revertedWith("NegDelta :: amount > 0")
        })

        it("Cannot use intra-transaction balances > MaxInt256", async () => {
            const erc20Contract = await ethers.getContractFactory("ERC20MintsToDeployer", alice)
            const evilToken = await erc20Contract.deploy(ethers.constants.MaxUint256, "18")
            evilToken.connect(alice).approve(ocean.address, ethers.constants.MaxUint256)
            const evilTransfer = ethers.BigNumber.from(ethers.constants.MaxUint256).sub(1)

            await expect(
                shellV2.executeInteractions({
                    ocean,
                    signer: alice,
                    interactions: [
                        shellV2.interactions.wrapERC20({
                            address: evilToken.address,
                            amount: evilTransfer
                        })
                    ]
                })
            ).to.be.revertedWith("Delta :: amount > int256max")
        })

        it("Cannot unwrap a token not owned", async () => {
            await expect(
                shellV2.executeInteractions({
                    ocean,
                    signer: dina,
                    interactions: [
                        shellV2.interactions.unwrapERC20({
                            address: tokens[0].address,
                            amount: "1"
                        })
                    ]
                })
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance")
        })

        it("Cannot unwrap multiple tokens not owned", async () => {
            await expect(
                shellV2.executeInteractions({
                    ocean,
                    signer: dina,
                    interactions: [
                        shellV2.interactions.unwrapERC20({
                            address: tokens[0].address,
                            amount: "1"
                        }),
                        shellV2.interactions.unwrapERC20({
                            address: tokens[1].address,
                            amount: "1"
                        }),
                    ]
                })
            ).to.be.revertedWith("ERC1155: burn amount exceeds balance")
        })

        it("Charlotte does a backwards meta-swap with a mint", async () => {
            const shellA = await pools[0].lpTokenId()
            const swapAmount = shellV2.utils.numberWithFixedDecimals({
                number: "1",
                decimals: "18"
            })
            const initialCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address),
            ])
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.unwrapERC20({
                        address: tokens[2].address,
                        amount: swapAmount
                    }),
                    shellV2.interactions.computeInputAmount({
                        address: pools[1].address,
                        inputToken: shellA,
                        outputToken: tokens[2].address,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),

                    shellV2.interactions.computeInputAmount({
                        address: pools[0].address,
                        inputToken: tokens[0].address,
                        outputToken: shellA,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.wrapERC20({
                        address: tokens[0].address,
                        amount: ethers.constants.MaxUint256
                    }),
                ]
            })
            const finalCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address),
            ])

            expect(
                finalCharlotteBalances[0]
            ).to.equal(initialCharlotteBalances[0].sub(swapAmount))
            expect(
                finalCharlotteBalances[1]
            ).to.equal(initialCharlotteBalances[1].add(swapAmount))
        })

        it("Charlotte does a backwards meta swap with a burn", async () => {
            const shellA = await pools[0].lpTokenId()
            const swapAmount = shellV2.utils.numberWithFixedDecimals({
                number: "1",
                decimals: "18"
            })
            const initialCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address),
            ])
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.unwrapERC20({
                        address: tokens[0].address,
                        amount: swapAmount
                    }),
                    shellV2.interactions.computeInputAmount({
                        address: pools[0].address,
                        inputToken: shellA,
                        outputToken: tokens[0].address,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),

                    shellV2.interactions.computeInputAmount({
                        address: pools[1].address,
                        inputToken: tokens[2].address,
                        outputToken: shellA,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.wrapERC20({
                        address: tokens[2].address,
                        amount: ethers.constants.MaxUint256
                    }),
                ]
            })
            const finalCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address),
            ])

            expect(
                finalCharlotteBalances[0]
            ).to.equal(initialCharlotteBalances[0].add(swapAmount))
            expect(
                finalCharlotteBalances[1]
            ).to.equal(initialCharlotteBalances[1].sub(swapAmount))
        })

        it("Charlotte does a 2 to 1 swap", async () => {
            const shellA = await pools[0].lpTokenId()
            const swapAmount = shellV2.utils.numberWithFixedDecimals({
                number: "1",
                decimals: "18"
            })
            const initialCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[1].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address)
            ])
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.wrapERC20({
                        address: tokens[0].address,
                        amount: swapAmount
                    }),
                    shellV2.interactions.wrapERC20({
                        address: tokens[1].address,
                        amount: swapAmount
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: tokens[0].address,
                        outputToken: shellA,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: tokens[1].address,
                        outputToken: shellA,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[1].address,
                        inputToken: shellA,
                        outputToken: tokens[2].address,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.unwrapERC20({
                        address: tokens[2].address,
                        amount: ethers.constants.MaxUint256
                    })
                ]
            })
            const finalCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[1].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address)
            ])

            expect(
                finalCharlotteBalances[0]
            ).to.equal(initialCharlotteBalances[0].sub(swapAmount))
            expect(
                finalCharlotteBalances[1]
            ).to.equal(initialCharlotteBalances[1].sub(swapAmount))
            expect(
                finalCharlotteBalances[2]
            ).to.equal(initialCharlotteBalances[2].add(swapAmount).add(swapAmount))
        })

        it("Charlotte does a 1 to 2 swap", async () => {
            const shellA = await pools[0].lpTokenId()
            const swapAmount = shellV2.utils.numberWithFixedDecimals({
                number: "2",
                decimals: "18"
            })
            const splitSwapAmount = shellV2.utils.numberWithFixedDecimals({
                number: "1",
                decimals: "18"
            })
            const initialCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[1].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address)
            ])
            await shellV2.executeInteractions({
                ocean,
                signer: charlotte,
                interactions: [
                    shellV2.interactions.wrapERC20({
                        address: tokens[2].address,
                        amount: swapAmount
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[1].address,
                        inputToken: tokens[2].address,
                        outputToken: shellA,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: shellA,
                        outputToken: tokens[1].address,
                        specifiedAmount: splitSwapAmount,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.computeOutputAmount({
                        address: pools[0].address,
                        inputToken: shellA,
                        outputToken: tokens[0].address,
                        specifiedAmount: ethers.constants.MaxUint256,
                        metadata: shellV2.constants.THIRTY_TWO_BYTES_OF_ZERO
                    }),
                    shellV2.interactions.unwrapERC20({
                        address: tokens[0].address,
                        amount: ethers.constants.MaxUint256
                    }),
                    shellV2.interactions.unwrapERC20({
                        address: tokens[1].address,
                        amount: ethers.constants.MaxUint256
                    }),
                ]
            })
            const finalCharlotteBalances = await Promise.all([
                tokens[0].balanceOf(charlotte.address),
                tokens[1].balanceOf(charlotte.address),
                tokens[2].balanceOf(charlotte.address)
            ])

            expect(
                finalCharlotteBalances[0]
            ).to.equal(initialCharlotteBalances[0].add(splitSwapAmount))
            expect(
                finalCharlotteBalances[1]
            ).to.equal(initialCharlotteBalances[1].add(splitSwapAmount))
            expect(
                finalCharlotteBalances[2]
            ).to.equal(initialCharlotteBalances[2].sub(swapAmount))
        })
    })
})