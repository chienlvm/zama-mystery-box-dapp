// test/MysteryBox.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// For now, use mock FHE data (in production, use actual relayer SDK)
// This allows testing the full flow with realistic FHE data structure

describe("MysteryBox Full Flow", function () {
  let nft, box, owner, user, relayer;

  beforeEach(async function () {
    [owner, user, relayer] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("MysteryNFT");
    nft = await NFT.deploy();
    await nft.waitForDeployment();

    const Box = await ethers.getContractFactory("MysteryBox");
    box = await Box.deploy(await nft.getAddress());
    await box.waitForDeployment();

    // Grant roles
    await nft.grantRole(await nft.MINTER_ROLE(), await box.getAddress());
    await box.grantRole(await box.RELAYER_ROLE(), relayer.address);

    // Set box mẫu
    await box.setBox(
      "testbox",
      "Test Box",
      ethers.parseEther("0.001"),
      ["Common", "Rare", "Epic", "Legendary"],
      [7000, 2000, 900, 100]
    );
  });

  it("Full flow: buy → open → request → fulfill → NFT minted (FHEVM Sepolia required)", async function () {
    // This test requires actual FHE infrastructure (Zama FHEVM Sepolia testnet)
    // Local Hardhat cannot execute real FHE operations
    //
    // For local testing, use: npm run test:local (with openBoxTest helper)
    // For production testing on Sepolia:
    //   1. Deploy contracts to FHEVM Sepolia
    //   2. Use scripts/relayer.js to process purchases with real FHE encryption
    //   3. Verify the full flow on the actual testnet
    //
    this.skip();
  });

  it("Should prevent unauthorized access", async function () {
    // Buy a box
    await box.connect(user).buyBox("testbox", {
      value: ethers.parseEther("0.001")
    });

    // User (not admin) should not be able to set box
    await expect(
      box.connect(user).setBox("newbox", "New Box", ethers.parseEther("0.001"), ["A", "B", "C", "D"], [2500, 2500, 2500, 2500])
    ).to.be.revertedWithCustomError(box, 'AccessControlUnauthorizedAccount');
  });

  it("Should track purchases correctly", async function () {
    // Get additional signers for this test
    const signers = await ethers.getSigners();
    const user2 = signers[3]; // Use a different signer (owner=0, user=1, relayer=2, user2=3)

    // User 1 buys 2 boxes
    await box.connect(user).buyBox("testbox", {
      value: ethers.parseEther("0.001")
    });
    await box.connect(user).buyBox("testbox", {
      value: ethers.parseEther("0.001")
    });

    // User 2 buys 1 box
    await box.connect(user2).buyBox("testbox", {
      value: ethers.parseEther("0.001")
    });

    // Check user1 purchases
    const user1Purchases = await box.getUserPurchases(user.address);
    expect(user1Purchases.length).to.equal(2);
    expect(user1Purchases[0]).to.equal(0n);
    expect(user1Purchases[1]).to.equal(1n);

    // Check user2 purchases
    const user2Purchases = await box.getUserPurchases(user2.address);
    expect(user2Purchases.length).to.equal(1);
    expect(user2Purchases[0]).to.equal(2n);

    // Verify total purchases
    const p0 = await box.getPurchase(0);
    const p1 = await box.getPurchase(1);
    const p2 = await box.getPurchase(2);

    expect(p0.buyer).to.equal(user.address);
    expect(p1.buyer).to.equal(user.address);
    expect(p2.buyer).to.equal(user2.address);
  });

  it("Should refund overpayment", async function () {
    const initialBalance = await ethers.provider.getBalance(user.address);
    
    const txResp = await box.connect(user).buyBox("testbox", {
      value: ethers.parseEther("0.002") // Pay more than 0.001
    });
    const receipt = await txResp.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const finalBalance = await ethers.provider.getBalance(user.address);
    const spent = initialBalance - finalBalance;

    // Should be: 0.001 (box price) + gas
    expect(spent).to.be.lt(ethers.parseEther("0.002") + gasUsed);
    expect(spent).to.be.gte(ethers.parseEther("0.001") + gasUsed - ethers.parseEther("0.0001")); // Allow small margin
  });

  it("Should validate box configuration", async function () {
    // Invalid: weights don't sum to 10000
    await expect(
      box.setBox("invalid", "Invalid", ethers.parseEther("0.001"), ["A", "B", "C", "D"], [2500, 2500, 2500, 2500])
    ).to.not.be.reverted; // This should actually work: 2500*4 = 10000

    // Invalid: wrong number of rarities
    await expect(
      box.setBox("invalid2", "Invalid", ethers.parseEther("0.001"), ["A", "B"], [5000, 5000])
    ).to.be.revertedWith("Must have 4 rarities");

    // Invalid: weights don't sum to 10000
    await expect(
      box.setBox("invalid3", "Invalid", ethers.parseEther("0.001"), ["A", "B", "C", "D"], [2500, 2500, 2500, 2501])
    ).to.be.revertedWith("Weights must sum to 10000");
  });

  it("Should require payment for box purchase", async function () {
    // Try to buy without paying
    await expect(
      box.connect(user).buyBox("testbox")
    ).to.be.revertedWith("Insufficient");

    // Try to buy with insufficient payment
    await expect(
      box.connect(user).buyBox("testbox", { value: ethers.parseEther("0.0005") })
    ).to.be.revertedWith("Insufficient");
  });
});