const express = require("express");
const { Relayer } = require("@openzeppelin/defender-sdk-relay-signer-client");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Enable CORS for http://localhost:5173
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log incoming requests
app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// Initialize Relayer client with hardcoded credentials
const relaySigner = new Relayer({
  apiKey: process.env.DEFENDER_API_KEY, // Replace with new API Key
  apiSecret: process.env.DEFENDER_API_SECRET, // Replace with new API Secret
});

console.log("Relay Signer Initialized");

app.post("/relay", async (req, res) => {
  try {
    const { to, data, gasLimit, chainId, speed } = req.body;
    if (!to || !gasLimit || !chainId) {
      console.log("Missing required fields:", { to, data, gasLimit, chainId });
      return res
        .status(400)
        .json({ error: "Missing required fields: to, gasLimit, or chainId" });
    }

    console.log("Relaying transaction:", {
      to,
      data,
      gasLimit,
      chainId,
      speed,
    });

    // Test relayer connection
    try {
      const relayerInfo = await relaySigner.getRelayer();
      console.log("Relayer Info:", relayerInfo);
    } catch (error) {
      console.error("Relayer Connection Error:", {
        message: error.message,
        response: error.response
          ? {
              status: error.response.status,
              data: error.response.data,
              headers: error.response.headers,
            }
          : null,
        stack: error.stack,
      });
      throw new Error(`Failed to connect to relayer: ${error.message}`);
    }

    // Prepare transaction
    const tx = {
      to,
      data: data || "0x",
      gasLimit: Number(gasLimit),
      chainId: Number(chainId),
      speed: speed || "fast",
      value: "0", // Explicitly set to avoid undefined
    };

    console.log("Sending transaction:", tx);

    // Send transaction
    const response = await relaySigner.sendTransaction(tx);
    console.log("Relayer response:", response);

    return res.json({ hash: response.hash });
  } catch (error) {
    console.error("Relay Error:", {
      message: error.message,
      response: error.response
        ? {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers,
          }
        : null,
      stack: error.stack,
    });

    if (
      error.message.includes("authentication") ||
      error.message.includes("Failed to connect to relayer") ||
      error.message.includes("API key and secret are required")
    ) {
      return res
        .status(500)
        .json({
          error: "Authentication failed: Invalid or missing API credentials",
        });
    }
    if (error.message.includes("Insufficient funds")) {
      return res.status(403).json({ error: "Relayer has insufficient funds" });
    }
    if (error.message.includes("status code 400")) {
      return res.status(400).json({
        error: "Invalid transaction parameters",
        details:
          error.response && error.response.data
            ? error.response.data
            : error.message,
      });
    }
    return res.status(500).json({ error: `Relay error: ${error.message}` });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
