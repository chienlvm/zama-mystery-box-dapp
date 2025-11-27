require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const RPC = process.env.SEPOLIA_RPC_URL || process.env.ZAMA_PROVIDER_URL;
  if (!RPC) throw new Error('Missing SEPOLIA_RPC_URL or ZAMA_PROVIDER_URL in .env');

  // DEPLOYER_PRIVATE_KEY: Admin account with DEFAULT_ADMIN_ROLE on both contracts
  // This account has permission to grant roles to other accounts
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) throw new Error('Missing DEPLOYER_PRIVATE_KEY in .env (admin needed to grant roles)');

  // RELAYER_PRIVATE_KEY: Relayer service account that needs RELAYER_ROLE on MysteryBox
  // This account will call openBox() and fulfillDecryption() functions
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerKey) throw new Error('Missing RELAYER_PRIVATE_KEY in .env (the relayer account to grant)');

  const provider = new ethers.JsonRpcProvider(RPC);
  const admin = new ethers.Wallet(deployerKey, provider);

  // load MysteryBox artifact
  const boxAbi = require('../artifacts/contracts/MysteryBox.sol/MysteryBox.json').abi;

  // determine BOX address
  const deploymentsPath = path.resolve(__dirname, '..', 'deployments.json');
  let BOX_ADDRESS = process.env.BOX_ADDRESS || '';
  if (!BOX_ADDRESS && fs.existsSync(deploymentsPath)) {
    try { const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8')); BOX_ADDRESS = BOX_ADDRESS || deployments.box?.address || ''; } catch (e) {}
  }
  if (!BOX_ADDRESS) throw new Error('BOX_ADDRESS not set in .env or deployments.json');

  const box = new ethers.Contract(BOX_ADDRESS, boxAbi, admin);

  // grant RELAYER_ROLE to relayer address
  const relayerAddr = (new ethers.Wallet(relayerKey)).address;
  const relayerRole = await box.RELAYER_ROLE();
  console.log('RELAYER_ROLE selector:', relayerRole);
  const has = await box.hasRole(relayerRole, relayerAddr);
  if (has) {
    console.log('Relayer already has RELAYER_ROLE:', relayerAddr);
  } else {
    console.log('Granting RELAYER_ROLE to', relayerAddr, 'from admin', admin.address);
    const tx = await box.grantRole(relayerRole, relayerAddr);
    console.log('grantRole tx hash:', tx.hash);
    await tx.wait();
    console.log('RELAYER_ROLE granted');
  }

  // Ensure MysteryBox can mint on MysteryNFT (grant MINTER_ROLE to MysteryBox)
  try {
    const nftAddress = await box.nft();
    if (nftAddress && nftAddress !== ethers.ZeroAddress) {
      const nftAbi = require('../artifacts/contracts/MysteryNFT.sol/MysteryNFT.json').abi;
      const nft = new ethers.Contract(nftAddress, nftAbi, admin);
      const minterRole = await nft.MINTER_ROLE();
      const boxHasMinter = await nft.hasRole(minterRole, BOX_ADDRESS);
      if (boxHasMinter) {
        console.log('MysteryBox already has MINTER_ROLE on MysteryNFT');
      } else {
        console.log('Granting MINTER_ROLE on MysteryNFT to MysteryBox:', BOX_ADDRESS);
        const tx2 = await nft.grantRole(minterRole, BOX_ADDRESS);
        console.log('grantRole (minter) tx hash:', tx2.hash);
        await tx2.wait();
        console.log('MINTER_ROLE granted to MysteryBox');
      }
    } else {
      console.warn('Could not read nft() from MysteryBox or nft address is zero; skipping MINTER_ROLE grant');
    }
  } catch (e) {
    console.warn('Skipping MINTER_ROLE grant due to error:', e && e.message ? e.message : e);
  }

  console.log('Done. Verify roles with check script or etherscan.');
}

main().catch(e => { console.error(e); process.exit(1); });
