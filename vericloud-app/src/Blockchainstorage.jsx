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

  // Search by hash value
  const searchByHash = async () => {
    if (!searchHash.trim()) {
      showStatus('search', 'error', '❌ Please enter a hash value to search');
      return;
    }
    if (!contract) {
      showStatus('search', 'error', '❌ Please initialize the contract first');
      return;
    }

    try {
      setIsSearching(true);
      setSearchResult(null);
      showStatus('search', 'info', '⏳ Searching blockchain entries...');

      const total = await contract.methods.getTotalEntries().call();

      if (Number(total) === 0) {
        showStatus('search', 'info', 'ℹ️ No entries on blockchain to search.');
        setSearchResult({ found: false });
        return;
      }

      for (let i = 0; i < Number(total); i++) {
        const result = await contract.methods.getData(i).call();
        const content = result.content || result[0];
        if (content.toLowerCase() === searchHash.trim().toLowerCase()) {
          const owner = result.owner || result[1];
          const timestamp = result.timestamp || result[2];
          const date = new Date(Number(timestamp) * 1000);
          setSearchResult({
            found: true,
            id: i,
            content,
            owner,
            date: date.toLocaleString(),
            isYours: owner.toLowerCase() === userAccount?.toLowerCase()
          });
          showStatus('search', 'success', `✅ Hash found! Entry #${i}`);
          return;
        }
      }

      setSearchResult({ found: false });
      showStatus('search', 'error', '❌ Hash not found on blockchain.');
    } catch (error) {
      console.error(error);
      showStatus('search', 'error', '❌ Search failed: ' + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-reconnect wallet on mount + listen for MetaMask events
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      showStatus('setup', 'error', '❌ MetaMask not detected. Please install MetaMask to use blockchain features.');
      return;
    }

    // Auto-reconnect if previously connected (uses eth_accounts — silent, no popup)
    const autoReconnect = async () => {
      const wasConnected = localStorage.getItem('vericloud_wallet_connected');
      if (!wasConnected) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length === 0) return; // User manually disconnected from MetaMask

        const Web3Module = await import('web3');
        const Web3 = Web3Module.default || Web3Module;
        const web3Instance = new Web3(window.ethereum);

        const chainId = await web3Instance.eth.getChainId();
        if (Number(chainId) !== 80002) {
          showStatus('setup', 'error', '❌ Please switch to Polygon Amoy Testnet in MetaMask.');
          return;
        }

        await setupWallet(web3Instance, accounts[0]);
      } catch (err) {
        console.warn('Auto-reconnect failed:', err);
      }
    };

    autoReconnect();

    // Listen for account and chain changes
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // User disconnected from MetaMask
        setWalletConnected(false);
        setContractInitialized(false);
        setContract(null);
        setUserAccount(null);
        setWeb3(null);
        localStorage.removeItem('vericloud_wallet_connected');
        showStatus('setup', 'info', '⚠️ Wallet disconnected. Click Connect to reconnect.');
      } else {
        setUserAccount(accounts[0]);
      }
    };

    const handleChainChanged = () => {
      // Reload to avoid stale state on network switch
      window.location.reload();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Status badge component
  const StatusBadge = ({ section }) => {
    if (status.section !== section) return null;
    const colors = {
      success: 'bg-green-500/20 border-green-500/30 text-green-400',
      error: 'bg-red-500/20 border-red-500/30 text-red-400',
      info: 'bg-blue-500/20 border-blue-500/30 text-blue-400'
    };
    return (
      <div className={`mt-4 px-4 py-3 rounded-lg border text-sm ${colors[status.type] || colors.info}`}>
        {status.message}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Wallet & Contract Setup */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Blockchain Setup
        </h3>

        {/* Connect Wallet */}
        <div className="mb-6">
          {!walletConnected ? (
            <button
              onClick={connectWallet}
              className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-emerald-700 transition-all font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
            >
              <Wallet className="w-5 h-5 mr-2" />
              Connect MetaMask Wallet
            </button>
          ) : (
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-500/20 p-2 rounded-lg">
                    <Wallet className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Wallet Connected</p>
                    <p className="text-gray-400 text-sm font-mono truncate max-w-xs">{userAccount}</p>
                  </div>
                </div>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-medium px-3 py-1 rounded-full">
                  Amoy Testnet ✅
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Contract Address */}
        <div className="space-y-3">
          <label className="text-gray-300 text-sm font-medium block">Contract Address</label>
          <div className="flex space-x-3">
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
            />
            <button
              onClick={initializeContract}
              disabled={!walletConnected}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-all font-medium whitespace-nowrap"
            >
              Initialize
            </button>
          </div>
        </div>

        <StatusBadge section="setup" />
      </div>

      {/* Stats */}
      {contractInitialized && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <BarChart3 className="w-5 h-5 text-blue-400 mr-2" />
              <span className="text-gray-400 text-sm">Total Entries</span>
            </div>
            <p className="text-3xl font-bold text-white">{totalEntries}</p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <Wallet className="w-5 h-5 text-emerald-400 mr-2" />
              <span className="text-gray-400 text-sm">Your Entries</span>
            </div>
            <p className="text-3xl font-bold text-white">{userEntries}</p>
          </div>
        </div>
      )}



      {/* Search by Hash */}
      {contractInitialized && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Search by Hash Value
          </h3>
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={searchHash}
              onChange={(e) => setSearchHash(e.target.value)}
              placeholder="Paste bloom filter hash to search..."
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono text-sm"
            />
            <button
              onClick={searchByHash}
              disabled={isSearching}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center"
            >
              {isSearching ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5 mr-2" />
                  Search Blockchain
                </>
              )}
            </button>
          </div>

          {searchResult && searchResult.found && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-green-400 font-semibold">✅ Hash Found — Entry #{searchResult.id}</span>
                {searchResult.isYours && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-xs font-medium px-2 py-1 rounded-full">
                    Your Entry
                  </span>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Content</p>
                <p className="text-white text-sm font-mono break-all">{searchResult.content}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Owner</p>
                <p className="text-white font-mono text-sm break-all">{searchResult.owner}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Stored At</p>
                <p className="text-white text-sm">{searchResult.date}</p>
              </div>
            </div>
          )}

          {searchResult && !searchResult.found && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 font-medium">❌ Hash not found on the blockchain.</p>
              <p className="text-gray-400 text-sm mt-1">This hash has not been stored on-chain yet.</p>
            </div>
          )}

          <StatusBadge section="search" />
        </div>
      )}

      {/* View All Data */}
      {contractInitialized && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <List className="w-5 h-5 mr-2" />
            All Stored Data
          </h3>
          <button
            onClick={loadAllData}
            disabled={isLoadingAll}
            className="w-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg mb-4 flex items-center justify-center"
          >
            {isLoadingAll ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Loading...
              </>
            ) : (
              <>
                <List className="w-5 h-5 mr-2" />
                Load All Data
              </>
            )}
          </button>

          {allData.length > 0 && (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {allData.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-700/50 rounded-lg p-4 border-l-4 border-blue-500 hover:bg-slate-700/70 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 font-semibold">Entry #{entry.id}</span>
                    {entry.isYours && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-xs font-medium px-2 py-1 rounded-full">
                        Your Entry
                      </span>
                    )}
                  </div>
                  <p className="text-white mb-2">{entry.content}</p>
                  <p className="text-gray-500 text-xs">
                    Owner: {entry.owner} · {entry.timestamp}
                  </p>
                </div>
              ))}
            </div>
          )}
          <StatusBadge section="viewAll" />
        </div>
      )}
    </div>
  );
};

export default BlockchainStorage;
