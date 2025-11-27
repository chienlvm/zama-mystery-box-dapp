// deploy/01_deploy.js
const { ethers } = require("hardhat");

async function main() {
  // Deploy contracts using DEPLOYER_PRIVATE_KEY (admin with DEFAULT_ADMIN_ROLE)
  // This account will be the admin on both MysteryBox and MysteryNFT contracts.
  let deployer;
  const signers = await ethers.getSigners();
  if (signers && signers.length > 0) {
    deployer = signers[0];
  } else {
    // DEPLOYER_PRIVATE_KEY is the primary admin key for deployment
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk) {
      console.error('No signer available from Hardhat and no DEPLOYER_PRIVATE_KEY in .env');
      console.error('Set DEPLOYER_PRIVATE_KEY in your .env or configure network accounts in hardhat.config.js');
      console.error('DEPLOYER_PRIVATE_KEY should be the admin account with DEFAULT_ADMIN_ROLE');
      process.exit(1);
    }
    deployer = new ethers.Wallet(pk, ethers.provider);
  }

  console.log("Deploying contracts with account:", deployer.address);
  // Use provider to fetch balance (works for both Hardhat signers and Wallet fallback)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // 1. Deploy MysteryNFT
  // Create contract factories bound to the deployer so transactions can be sent on external networks
  const MysteryNFT = await ethers.getContractFactory("MysteryNFT", deployer);
  const nft = await MysteryNFT.deploy();
  await nft.waitForDeployment();
  console.log("MysteryNFT deployed to:", await nft.getAddress());

  // 2. Deploy MysteryBox (pass NFT address)
  const MysteryBox = await ethers.getContractFactory("MysteryBox", deployer);
  const box = await MysteryBox.deploy(await nft.getAddress());
  await box.waitForDeployment();
  console.log("MysteryBox deployed to:", await box.getAddress());

  // 3. Grant MINTER_ROLE cho MysteryBox contract
  const MINTER_ROLE = await nft.MINTER_ROLE();
  await nft.grantRole(MINTER_ROLE, await box.getAddress());
  console.log("Granted MINTER_ROLE to MysteryBox");

  // 4. Set box mẫu (Bronze, Silver, Gold) - 5 rarities: Common, Uncommon, Rare, Epic, Legendary
  const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  
  // Weights must sum to 10000 (100%)
  // Bronze: High chance Common/Uncommon, low chance rare+
  const bronzeWeights = [5000, 3000, 1500, 400, 100];   // 50% Common, 30% Uncommon, 15% Rare, 4% Epic, 1% Legendary
  // Silver: Balanced mid-tier
  const silverWeights = [2500, 3500, 2500, 1000, 500];  // 25% Common, 35% Uncommon, 25% Rare, 10% Epic, 5% Legendary
  // Gold: High chance Epic/Legendary
  const goldWeights   = [500, 1500, 3000, 3000, 2000];  // 5% Common, 15% Uncommon, 30% Rare, 30% Epic, 20% Legendary

  await box.setBox("bronze", "Bronze Box", ethers.parseEther("0.001"), rarities, bronzeWeights);
  await box.setBox("silver", "Silver Box", ethers.parseEther("0.005"), rarities, silverWeights);
  await box.setBox("gold",   "Gold Box",   ethers.parseEther("0.02"),  rarities, goldWeights);
  console.log("Sample boxes (bronze/silver/gold) set up with 5 rarities");

  const nftAddress = await nft.getAddress();
  const boxAddress = await box.getAddress();

  console.log("\n=== Deployment Complete ===");
  console.log("MysteryNFT :", nftAddress);
  console.log("MysteryBox :", boxAddress);
  console.log("Use these 2 addresses in relayer.js and frontend!");

  // 5. Save deployment addresses to deployments.json
  const fs = require('fs');
  const path = require('path');
  const deploymentsPath = path.resolve(__dirname, '..', 'deployments.json');
  
  const deployments = {
    nft: {
      address: nftAddress
    },
    box: {
      address: boxAddress
    }
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("\n✅ Deployment addresses saved to deployments.json");
  console.log("\nNext steps:");
  console.log("1. Update BOX_ADDRESS in .env with:", boxAddress);
  console.log("2. Run: node scripts/grantRoles.js");
  console.log("3. Test: node scripts/simulatePurchase.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deploy failed:", error);
    process.exit(1);
  });