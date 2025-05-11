// ***HARDHAT LOCAL SERVER*****
const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Define required environment variables
const requiredEnvVars = {
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  USDT_ADDRESS: process.env.USDT_ADDRESS,
  STAKING_ADDRESS: process.env.STAKING_ADDRESS,
  RPC_URL: process.env.RPC_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  PORT: process.env.PORT || 3001, // Default to 3001 if not specified
};

// Validate required environment variables
const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingEnvVars.length > 0) {
  console.error("Missing environment variables:", missingEnvVars);
  throw new Error(
    `Missing environment variables: ${missingEnvVars.join(
      ", "
    )}. Please check your .env file.`
  );
}

// Validate contract addresses
if (!ethers.isAddress(requiredEnvVars.USDT_ADDRESS)) {
  console.error("Invalid USDT contract address:", requiredEnvVars.USDT_ADDRESS);
  throw new Error("Invalid USDT contract address");
}
if (!ethers.isAddress(requiredEnvVars.STAKING_ADDRESS)) {
  console.error(
    "Invalid Staking contract address:",
    requiredEnvVars.STAKING_ADDRESS
  );
  throw new Error("Invalid Staking contract address");
}

// Validate private key
if (!requiredEnvVars.PRIVATE_KEY.match(/^0x[a-fA-F0-9]{64}$/)) {
  console.error("Invalid private key");
  throw new Error("Invalid private key format");
}

const app = express();

// CORS configuration
app.use(
  cors({
    origin: requiredEnvVars.FRONTEND_URL,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

app.use(express.json());

// Contract addresses and ABIs
const USDT_ADDRESS = requiredEnvVars.USDT_ADDRESS;
const STAKING_ADDRESS = requiredEnvVars.STAKING_ADDRESS;
const MockUSDT_ABI = require("../stake-app/src/abis/MockUSDT.json").abi;
const StakingContract_ABI =
  require("../stake-app/src/abis/StakingContract.json").abi;

// Initialize provider and signer
const provider = new ethers.JsonRpcProvider(requiredEnvVars.RPC_URL);
const signer = new ethers.Wallet(requiredEnvVars.PRIVATE_KEY, provider);

// Select ABI based on contract address
const getContractAbi = (contractAddress) => {
  if (contractAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
    return MockUSDT_ABI;
  } else if (contractAddress.toLowerCase() === STAKING_ADDRESS.toLowerCase()) {
    return StakingContract_ABI;
  } else {
    throw new Error("Unknown contract address");
  }
};

app.post("/relay", async (req, res) => {
  try {
    const { contractAddress, functionName, args, userAddress, signature } =
      req.body;
    console.log("Received request:", {
      contractAddress,
      functionName,
      args,
      userAddress,
      signature,
    });

    // Validate inputs
    if (!ethers.isAddress(contractAddress)) {
      return res.status(400).json({ error: "Invalid contract address" });
    }
    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid user address" });
    }
    if (!functionName || typeof functionName !== "string") {
      return res.status(400).json({ error: "Invalid function name" });
    }
    if (!Array.isArray(args)) {
      return res.status(400).json({ error: "Invalid arguments" });
    }
    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Get ABI for the contract
    const abi = getContractAbi(contractAddress);
    const contract = new ethers.Contract(contractAddress, abi, signer);

    // Split signature into v, r, s
    let v, r, s;
    try {
      const sig = ethers.Signature.from(signature);
      v = sig.v;
      r = sig.r;
      s = sig.s;
    } catch (err) {
      return res.status(400).json({ error: "Invalid signature format" });
    }

    // Execute the transaction
    const tx = await contract[functionName](...args, v, r, s);
    console.log("Transaction sent:", tx.hash);
    let receipt;
    try {
      receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt.hash);
      console.log("Receipt details:", {
        hash: receipt.hash,
        status: receipt.status,
      });
    } catch (waitError) {
      console.error("Error waiting for transaction confirmation:", waitError);
      // Still return tx.hash since transaction was sent
    }

    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    console.error("Relayer error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = requiredEnvVars.PORT;
app.listen(PORT, () => console.log(`Relayer running on port ${PORT}`));


// ***SEPOLIA SEVER****
// const express = require("express");
// const { ethers } = require("ethers");
// const cors = require("cors");

// const app = express();

// // CORS configuration
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     methods: ["GET", "POST", "OPTIONS"],
//     allowedHeaders: ["Content-Type"],
//     credentials: true,
//   })
// );

// app.use(express.json());

// // Contract addresses and ABIs
// const USDT_ADDRESS = "0xa41E112B3d9C1306216D4bcaaF18E4fAea9E76C2";
// const STAKING_ADDRESS = "0xE3173947e76825fD3d9720f1a2EEf032F90fE3F2";
// const MockUSDT_ABI = require("../stake-app/src/abis/MockUSDT.json").abi;
// const StakingContract_ABI =
//   require("../stake-app/src/abis/StakingContract.json").abi;

// // Initialize provider and signer
// const provider = new ethers.JsonRpcProvider(
//   process.env.SEPOLIA_RPC_URL ||
//     "https://eth-sepolia.g.alchemy.com/v2/qOOms_CAU50nNlmhqbIVSaQ1Zrvl5svr"
// );
// const signer = new ethers.Wallet(
//   process.env.PRIVATE_KEY ||
//     "89e008ed80de4a86912dc2d4f9b59622a67fb73b48349933a69d099c6aac7aa8",
//   provider
// );

// // Select ABI based on contract address
// const getContractAbi = (contractAddress) => {
//   if (contractAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
//     return MockUSDT_ABI;
//   } else if (contractAddress.toLowerCase() === STAKING_ADDRESS.toLowerCase()) {
//     return StakingContract_ABI;
//   } else {
//     throw new Error("Unknown contract address");
//   }
// };

// app.post("/relay", async (req, res) => {
//   try {
//     const { contractAddress, functionName, args, userAddress, signature } =
//       req.body;

//     // Validate inputs
//     if (!ethers.isAddress(contractAddress)) {
//       return res.status(400).json({ error: "Invalid contract address" });
//     }
//     if (!ethers.isAddress(userAddress)) {
//       return res.status(400).json({ error: "Invalid user address" });
//     }
//     if (!functionName || typeof functionName !== "string") {
//       return res.status(400).json({ error: "Invalid function name" });
//     }
//     if (!Array.isArray(args)) {
//       return res.status(400).json({ error: "Invalid arguments" });
//     }
//     if (!signature || typeof signature !== "string") {
//       return res.status(400).json({ error: "Invalid signature" });
//     }

//     // Get ABI for the contract
//     const abi = getContractAbi(contractAddress);
//     const contract = new ethers.Contract(contractAddress, abi, signer);

//     // Split signature into v, r, s
//     let v, r, s;
//     try {
//       const sig = ethers.Signature.from(signature);
//       v = sig.v;
//       r = sig.r;
//       s = sig.s;
//     } catch (err) {
//       return res.status(400).json({ error: "Invalid signature format" });
//     }

//     // Execute the transaction
//     const tx = await contract[functionName](...args, v, r, s);
//     const receipt = await tx.wait();
    

//     res.json({ success: true, txHash: receipt.transactionHash });
//   } catch (error) {
//     console.error("Relayer error:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => console.log(`Relayer running on port ${PORT}`));
