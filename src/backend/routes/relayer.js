const express = require("express");
const { ethers } = require("ethers");
const { verifyToken } = require("./auth");

const router = express.Router();

// Mock encrypted state storage (in production, use persistent DB)
const decryptionRequests = new Map();
let decryptionRequestIdCounter = 1;

/**
 * POST /api/relayer/sign
 * Relayer endpoint: sign a payload for submission to Box contract
 * Body: { purchaseId, buyer, boxId, payload }
 * Returns: { signature, nonce }
 */
router.post("/sign", verifyToken, async (req, res) => {
  try {
    const { purchaseId, buyer, boxId, payload } = req.body;

    if (!purchaseId || !buyer || !boxId || !payload) {
      return res
        .status(400)
        .json({ error: "Missing required fields: purchaseId, buyer, boxId, payload" });
    }

    // Ensure user is authorized relayer (in production, check RelayerManager contract)
    const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
    if (!RELAYER_PRIVATE_KEY) {
      return res.status(500).json({ error: "Relayer not configured" });
    }

    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY);

    // Compute payload hash
    const payloadHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "string", "bytes"], [buyer, boxId, payload])
    );

    // Sign using EIP-191 (simple signature)
    // In production, use EIP-712 with domain separator
    const messageHash = ethers.hashMessage(ethers.toBeHex(payloadHash));
    const signature = await relayerWallet.signMessage(ethers.toBeArray(payloadHash));

    res.json({
      success: true,
      signature,
      payloadHash,
      nonce: req.user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /sign:", error);
    res.status(500).json({ error: "Failed to sign payload", details: error.message });
  }
});

/**
 * POST /api/decrypt/request
 * Request async decryption for a purchase
 * Body: { purchaseId, encryptedHandle }
 * Returns: { decryptionRequestId }
 */
router.post("/request", verifyToken, async (req, res) => {
  try {
    const { purchaseId, encryptedHandle } = req.body;

    if (!purchaseId || !encryptedHandle) {
      return res.status(400).json({ error: "Missing purchaseId or encryptedHandle" });
    }

    const requestId = decryptionRequestIdCounter++;

    // Store decryption request
    decryptionRequests.set(requestId, {
      purchaseId,
      encryptedHandle,
      status: "pending",
      requestedAt: new Date(),
      submittedBy: req.user.id,
    });

    // In production, submit to FHE oracle/Zama Relayer SDK
    // For now, simulate async decryption with timeout
    simulateDecryption(requestId, purchaseId);

    res.json({
      success: true,
      decryptionRequestId: requestId,
      status: "pending",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /request:", error);
    res.status(500).json({ error: "Failed to request decryption", details: error.message });
  }
});

/**
 * GET /api/decrypt/status/:decryptionRequestId
 * Poll decryption status
 * Returns: { status, rarityTier, decryptionProof }
 */
router.get("/status/:decryptionRequestId", verifyToken, async (req, res) => {
  try {
    const { decryptionRequestId } = req.params;
    const requestId = parseInt(decryptionRequestId, 10);

    if (!decryptionRequests.has(requestId)) {
      return res.status(404).json({ error: "Decryption request not found" });
    }

    const request = decryptionRequests.get(requestId);

    res.json({
      success: true,
      decryptionRequestId: requestId,
      status: request.status,
      rarityTier: request.rarityTier || null,
      proof: request.proof || null,
      fulfillmentTx: request.fulfillmentTx || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /status:", error);
    res.status(500).json({ error: "Failed to fetch status", details: error.message });
  }
});

/**
 * POST /api/decrypt/fulfill
 * Oracle endpoint: submit plaintext decryption result
 * Body: { decryptionRequestId, rarityTier, proof }
 * Returns: { fulfillmentTx }
 */
router.post("/fulfill", verifyToken, async (req, res) => {
  try {
    const { decryptionRequestId, rarityTier, proof } = req.body;

    if (!decryptionRequestId || !rarityTier) {
      return res.status(400).json({ error: "Missing decryptionRequestId or rarityTier" });
    }

    const requestId = parseInt(decryptionRequestId, 10);
    if (!decryptionRequests.has(requestId)) {
      return res.status(404).json({ error: "Decryption request not found" });
    }

    const request = decryptionRequests.get(requestId);
    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    // Update request with fulfillment
    request.status = "fulfilled";
    request.rarityTier = rarityTier;
    request.proof = proof || null;
    request.fulfilledAt = new Date();

    // In production, call Box.fulfillDecryption on contract
    // For now, simulate with mock tx hash
    const mockTxHash = ethers.id(`fulfill-${requestId}-${Date.now()}`);
    request.fulfillmentTx = mockTxHash;

    res.json({
      success: true,
      decryptionRequestId: requestId,
      rarityTier,
      fulfillmentTx: mockTxHash,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /fulfill:", error);
    res.status(500).json({ error: "Failed to fulfill decryption", details: error.message });
  }
});

/**
 * GET /api/relayer/health
 * Health check for relayer service
 */
router.get("/health", async (req, res) => {
  try {
    const pendingCount = Array.from(decryptionRequests.values()).filter(
      (r) => r.status === "pending"
    ).length;
    const fulfilledCount = Array.from(decryptionRequests.values()).filter(
      (r) => r.status === "fulfilled"
    ).length;

    res.json({
      success: true,
      status: "operational",
      relayerAddress: process.env.RELAYER_ADDRESS || "not configured",
      pendingDecryptions: pendingCount,
      fulfilledDecryptions: fulfilledCount,
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("Error in health check:", error);
    res.status(500).json({ error: "Health check failed" });
  }
});

// ============ Helper Functions ============

/**
 * Simulate async decryption (mock oracle behavior)
 * In production, replace with actual Zama/FHE oracle call
 */
function simulateDecryption(requestId, purchaseId) {
  // Simulate 3-5 second decryption delay
  const delay = Math.random() * 2000 + 3000;

  setTimeout(() => {
    if (decryptionRequests.has(requestId)) {
      const request = decryptionRequests.get(requestId);

      // Mock rarity selection based on purchaseId hash
      const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
      const hash = ethers.keccak256(ethers.toBeHex(purchaseId));
      const rarityIndex = parseInt(hash.slice(2, 10), 16) % rarities.length;
      const selectedRarity = rarities[rarityIndex];

      request.status = "decrypted";
      request.rarityTier = selectedRarity;
      request.decryptedAt = new Date();

      console.log(
        `[Decryption Simulation] Request ${requestId}: Purchase ${purchaseId} -> ${selectedRarity}`
      );
    }
  }, delay);
}

module.exports = router;
