/* BlockchainStorage.jsx */
import React, { useState, useEffect, useCallback } from 'react';
import { Link2, Wallet, Settings, Search, List, BarChart3, X } from 'lucide-react';

// Contract ABI for the Blockchain Data Storage contract
const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "string", name: "_content", type: "string" }],
    name: "storeData",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "content", type: "string" }
    ],
    name: "DataStored",
    type: "event"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "dataEntries",
    outputs: [
      { internalType: "string", name: "content", type: "string" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "timestamp", type: "uint256" }
    ],
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
  },
  {
    inputs: [],
    name: "getTotalEntries",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "userDataCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
];

const BlockchainStorage = () => {
  // State
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);
  const [userAccount, setUserAccount] = useState(null);
  const [contractAddress, setContractAddress] = useState(
    () => localStorage.getItem('vericloud_contract_address') || process.env.REACT_APP_CONTRACT_ADDRESS || ''
  );

  // Stats
  const [totalEntries, setTotalEntries] = useState(0);
  const [userEntries, setUserEntries] = useState(0);



  // All data
  const [allData, setAllData] = useState([]);

  // UI state
  const [walletConnected, setWalletConnected] = useState(false);
  const [contractInitialized, setContractInitialized] = useState(false);
  const [status, setStatus] = useState({ section: '', type: '', message: '' });

  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [searchHash, setSearchHash] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const showStatus = (section, type, message) => {
    setStatus({ section, type, message });
  };

  // Update statistics
  const updateStats = useCallback(async (contractInstance, account) => {
    const c = contractInstance || contract;
    const a = account || userAccount;
    if (!c || !a) return;
    try {
      const total = await c.methods.getTotalEntries().call();
      setTotalEntries(Number(total));
      const user = await c.methods.userDataCount(a).call();
      setUserEntries(Number(user));
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }, [contract, userAccount]);

  // Switch / add Amoy network
  const switchToAmoyNetwork = async () => {
    if (!window.ethereum?.request) return false;

    const amoyParams = {
      chainId: '0x13882',
      chainName: 'Polygon Amoy Testnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://rpc-amoy.polygon.technology'],
      blockExplorerUrls: ['https://www.oklink.com/amoy']
    };

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: amoyParams.chainId }]
      });
      return true;
    } catch (switchError) {
      if (switchError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [amoyParams]
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  };

  // Helper: setup wallet with a web3 instance and account (used by both connect and auto-reconnect)
  const setupWallet = async (web3Instance, account) => {
    setWeb3(web3Instance);
    setUserAccount(account);
    setWalletConnected(true);
    localStorage.setItem('vericloud_wallet_connected', 'true');

    // Auto-initialize contract if address was saved previously
    const savedAddress = localStorage.getItem('vericloud_contract_address');
    if (savedAddress && web3Instance.utils.isAddress(savedAddress)) {
      try {
        const contractInstance = new web3Instance.eth.Contract(CONTRACT_ABI, savedAddress);
        await contractInstance.methods.getTotalEntries().call(); // verify it works
        setContractAddress(savedAddress);
        setContract(contractInstance);
        setContractInitialized(true);
        const total = await contractInstance.methods.getTotalEntries().call();
        setTotalEntries(Number(total));
        const user = await contractInstance.methods.userDataCount(account).call();
        setUserEntries(Number(user));
        showStatus('setup', 'success', `✅ Wallet & contract reconnected! Total entries: ${total}`);
        return;
      } catch (err) {
        console.warn('Auto-init contract failed, user can re-initialize manually:', err);
      }
    }

    showStatus('setup', 'success', '✅ Wallet connected! Enter your contract address below.');
  };

  // Connect wallet (user-initiated, shows MetaMask popup)
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        showStatus('setup', 'error', '❌ MetaMask is not installed! Please install the MetaMask extension.');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const account = accounts[0];

      // Dynamic import of Web3
      const Web3Module = await import('web3');
      const Web3 = Web3Module.default || Web3Module;
      const web3Instance = new Web3(window.ethereum);

      const chainId = await web3Instance.eth.getChainId();
      if (Number(chainId) !== 80002) {
        const switched = await switchToAmoyNetwork();
        if (!switched) {
          showStatus('setup', 'error', '❌ Please switch to Polygon Amoy Testnet (Chain ID: 80002) in MetaMask.');
          return;
        }
      }

      await setupWallet(web3Instance, account);
    } catch (error) {
      console.error(error);
      showStatus('setup', 'error', '❌ Failed to connect wallet: ' + error.message);
    }
  };

  // Initialize contract
  const initializeContract = async () => {
    try {
      if (!contractAddress.trim()) {
        showStatus('setup', 'error', '❌ Please enter a contract address');
        return;
      }
      if (!web3) {
        showStatus('setup', 'error', '❌ Please connect your wallet first');
        return;
      }
      if (!web3.utils.isAddress(contractAddress)) {
        showStatus('setup', 'error', '❌ Invalid contract address');
        return;
      }

      showStatus('setup', 'info', '⏳ Initializing contract...');

      const contractInstance = new web3.eth.Contract(CONTRACT_ABI, contractAddress);
      const total = await contractInstance.methods.getTotalEntries().call();

      setContract(contractInstance);
      setContractInitialized(true);
      // Save contract address for auto-reconnect
      localStorage.setItem('vericloud_contract_address', contractAddress);
      showStatus('setup', 'success', `✅ Contract initialized! Total entries: ${total}`);

      await updateStats(contractInstance, userAccount);
    } catch (error) {
      console.error(error);
      showStatus('setup', 'error', '❌ Failed to initialize contract. Check the address and ensure it is deployed on Amoy.');
    }
  };



  // Load all data
  const loadAllData = async () => {
    if (!contract) {
      showStatus('viewAll', 'error', '❌ Please initialize the contract first');
      return;
    }

    try {
      setIsLoadingAll(true);
      showStatus('viewAll', 'info', '⏳ Loading all data from blockchain...');

      const total = await contract.methods.getTotalEntries().call();

      if (Number(total) === 0) {
        showStatus('viewAll', 'info', 'ℹ️ No data stored yet.');
        setAllData([]);
        return;
      }

      const entries = [];
      for (let i = Number(total) - 1; i >= 0; i--) {
        const result = await contract.methods.getData(i).call();
        entries.push({
          id: i,
          content: result.content || result[0],
          owner: result.owner || result[1],
          timestamp: new Date(Number(result.timestamp || result[2]) * 1000).toLocaleString(),
          isYours: (result.owner || result[1]).toLowerCase() === userAccount?.toLowerCase()
        });
      }

      setAllData(entries);
      showStatus('viewAll', 'success', `✅ Loaded ${total} entries!`);
    } catch (error) {
      console.error(error);
      showStatus('viewAll', 'error', '❌ Failed to load data: ' + error.message);
    } finally {
      setIsLoadingAll(false);
    }
  };
