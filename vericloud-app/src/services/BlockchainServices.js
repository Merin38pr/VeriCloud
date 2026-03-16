// src/services/blockchainService.js
// Shared blockchain utility for storing data on the smart contract

const CONTRACT_ABI = [
    {
        inputs: [{ internalType: "string", name: "_content", type: "string" }],
        name: "storeData",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [],
        name: "getTotalEntries",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ internalType: "uint256", name: "_id", type: "uint256" }],
        name: "getData",
        outputs: [
            { internalType: "string", name: "content", type: "string" },
            { internalType: "address", name: "owner", type: "address" },
            { internalType: "uint256", name: "timestamp", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    }
];

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '';

/**
 * Connect MetaMask wallet and return { web3, account }
 */
export async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const account = accounts[0];

    const Web3Module = await import('web3');
    const Web3 = Web3Module.default || Web3Module;
    const web3 = new Web3(window.ethereum);

    // Check we're on Amoy
    const chainId = await web3.eth.getChainId();
    if (Number(chainId) !== 80002) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x13882' }]
            });
        } catch {
            throw new Error('Please switch to Polygon Amoy Testnet in MetaMask');
        }
    }

    return { web3, account };
}

/**
 * Store data on the blockchain. Handles wallet connection automatically.
 * Returns the transaction hash.
 */
export async function storeOnBlockchain(data) {
    const { web3, account } = await connectWallet();

    if (!CONTRACT_ADDRESS) {
        throw new Error('Contract address not configured in .env');
    }

    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    await contract.methods.getTotalEntries().call();

    const gasEstimate = await contract.methods.storeData(data).estimateGas({ from: account });
    const maxPriorityFeePerGas = web3.utils.toWei('30', 'gwei');
    const maxFeePerGas = web3.utils.toWei('80', 'gwei');

    const receipt = await contract.methods.storeData(data).send({
        from: account,
        gas: Math.floor(Number(gasEstimate) * 1.2),
        maxPriorityFeePerGas,
        maxFeePerGas
    });

    return receipt.transactionHash;
}

/**
 * Verify if a bloom hash exists on the blockchain.
 * Returns { found, id, owner, date } or { found: false }
 */
export async function verifyOnBlockchain(bloomHash) {
    const { web3 } = await connectWallet();

    if (!CONTRACT_ADDRESS) {
        throw new Error('Contract address not configured in .env');
    }

    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    const total = await contract.methods.getTotalEntries().call();

    if (Number(total) === 0) {
        return { found: false };
    }

    for (let i = 0; i < Number(total); i++) {
        const result = await contract.methods.getData(i).call();
        const content = result.content || result[0];
        if (content.toLowerCase() === bloomHash.trim().toLowerCase()) {
            const owner = result.owner || result[1];
            const timestamp = result.timestamp || result[2];
            const date = new Date(Number(timestamp) * 1000);
            return {
                found: true,
                id: i,
                content,
                owner,
                date: date.toLocaleString()
            };
        }
    }

    return { found: false };
}

export { CONTRACT_ABI, CONTRACT_ADDRESS };
