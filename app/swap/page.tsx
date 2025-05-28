'use client';

import styles from './swap.module.css';
import { useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import React, { useState, useEffect, useCallback } from 'react';

const assets = [
  { name: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9},
  { name: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6},
  { name: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6},
  { name: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { name: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6},
  { name: 'BEEMX', mint: 'ACMk9h76WrHaLFy7GYZB4yCea62KruCyj9jFQGq15P6o', decimals: 6},
];

const COMMISSION_BPS = 400; // 4% commission fee
const COMMISSION_WALLET = process.env.NEXT_PUBLIC_COMMISSION_WALLET || '2YTTbiNn4tQ14sXMC1L2HivhRo8JURS1UzPcdk6UyTRx';
if (!COMMISSION_WALLET) {
  throw new Error('Commission wallet address is not set. Please check your environment variables (.env.local) and restart your dev server.');
}

const debounce = <T extends unknown[]>(
  func: (...args: T) => void,
  wait: number
) => {
  let timeout: NodeJS.Timeout | undefined;

  return (...args: T) => {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Add a mapping for token icons
const tokenIcons: Record<string, string> = {
  'So11111111111111111111111111111111111111112': '/tokens/sol.svg',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '/tokens/usdc.svg',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': '/tokens/usdt.svg',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': '/tokens/bonk.svg',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': '/tokens/wif.svg',
  'ACMk9h76WrHaLFy7GYZB4yCea62KruCyj9jFQGq15P6o': '/tokens/beemx.svg',
};

export default function Swap() {
  const [fromAsset, setFromAsset] = useState(assets[0]);
  const [toAsset, setToAsset] = useState(assets[1]);
  const [fromAmount, setFromAmount] = useState(0);
  const [toAmount, setToAmount] = useState(0);
  const [quoteResponse, setQuoteResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState(0);
  const [error, setError] = useState('');

  const wallet = useWallet();

  // Need a custom RPC so you don't get rate-limited, don't rely on users' wallets
  const connection = new Connection(
    'https://mainnet.helius-rpc.com/?api-key=9ca00cf8-f0a2-4501-a86c-ced009625336'
  );

  const handleFromAssetChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setFromAsset(
      assets.find((asset) => asset.name === event.target.value) || assets[0]
    );
    setToAmount(0); // Reset amount when asset changes
    setError('');
  };

  const handleToAssetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setToAsset(
      assets.find((asset) => asset.name === event.target.value) || assets[0]
    );
    setToAmount(0); // Reset amount when asset changes
    setError('');
  };

  const handleFromValueChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = Number(event.target.value);
    setFromAmount(value);
    setError('');
  };

  async function getQuote(currentAmount: number) {
    if (isNaN(currentAmount) || currentAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const amount = Math.floor(currentAmount * Math.pow(10, fromAsset.decimals));
      const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${fromAsset.mint}&outputMint=${toAsset.mint}&amount=${amount}&slippage=0.5&feeBps=${COMMISSION_BPS}`;
      
      const response = await fetch(quoteUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch price: ${errorText}`);
      }
      
      const quote = await response.json();

      if (!quote || !quote.outAmount) {
        throw new Error('Invalid quote response');
      }

      // Calculate price impact
      const priceImpactPercent = Number(quote.priceImpactPct) * 100;
      setPriceImpact(priceImpactPercent);

      // Validate price impact
      if (priceImpactPercent > 20) {
        setError('Price impact too high (>20%). Please try a smaller amount.');
        setToAmount(0);
        return;
      }

      const outAmountNumber = Number(quote.outAmount) / Math.pow(10, toAsset.decimals);
      setToAmount(outAmountNumber);
      setQuoteResponse(quote);

    } catch (error: any) {
      console.error('Error fetching quote:', error);
      setError(error.message || 'Failed to fetch price. Please try again.');
      setToAmount(0);
    } finally {
      setIsLoading(false);
    }
  }

  const debounceQuoteCall = useCallback(
    debounce((amount: number) => {
      getQuote(amount);
    }, 500),
    [fromAsset, toAsset]
  );

  useEffect(() => {
    if (fromAmount > 0) {
      debounceQuoteCall(fromAmount);
    }
  }, [fromAmount, debounceQuoteCall]);

  async function signAndSendTransaction() {
    if (!wallet.connected || !wallet.signTransaction) {
      console.error(
        'Wallet is not connected or does not support signing transactions'
      );
      return;
    }

    try {
      // Compute the correct ATA for the output token and commission wallet
      const feeAccount = await getAssociatedTokenAddress(
        new PublicKey(toAsset.mint),
        new PublicKey(COMMISSION_WALLET),
        false
      );

      // Debug logs
      console.log('Commission feeAccount:', feeAccount.toBase58());
      console.log('Commission wallet:', COMMISSION_WALLET);

      // get serialized transactions for the swap
      const response = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey?.toString(),
          wrapAndUnwrapSol: true,
          feeAccount: feeAccount.toBase58(),
        }),
      });

      // Debug log for swap response
      const swapResponse = await response.clone().json();
      console.log('Swap response:', swapResponse);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { swapTransaction } = swapResponse;

      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
      const signedTransaction = await wallet.signTransaction(transaction);

      const rawTransaction = signedTransaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      const latestBlockHash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txid
      }, 'confirmed');
      
      console.log(`https://solscan.io/tx/${txid}`);

    } catch (error) {
      console.error('Error in swap transaction:', error);
      // You might want to show this error to the user in the UI
    }
  }

  return (
    <div className={styles.body}>
      <div className={styles.swapCard}>
        <div className={styles.header}>
          <img src="/tokens/beemx.svg" alt="BEEMX Logo" className={styles.logo} />
          <span className={styles.title}>BEEMX SWAP</span>
        </div>
        <div className={styles.inputContainer}>
          <div className={styles.labels}>You pay</div>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={fromAmount}
              onChange={handleFromValueChange}
              className={styles.inputField}
              placeholder="0.0"
              min="0"
              step="any"
            />
            <div className={styles.tokenSelectWrapper}>
              <img
                src={tokenIcons[fromAsset.mint]}
                alt={fromAsset.name}
                className={styles.tokenIcon}
              />
              <select
                value={fromAsset.name}
                onChange={handleFromAssetChange}
                className={styles.selectField}
              >
                {assets.map((asset) => (
                  <option key={asset.mint} value={asset.name}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Commission Fee Display */}
          {fromAmount > 0 && (
            <div style={{ color: '#aaa', fontSize: '0.98rem', marginTop: '0.3rem' }}>
              Fee (4%): {(fromAmount * 0.04).toFixed(fromAsset.decimals)} {fromAsset.name}
            </div>
          )}
        </div>
        <div className={styles.inputContainer}>
          <div className={styles.labels}>You receive</div>
          <div className={styles.inputRow}>
            <input
              type="number"
              value={toAmount}
              className={styles.inputField}
              readOnly
              placeholder="0.0"
            />
            <div className={styles.tokenSelectWrapper}>
              <img
                src={tokenIcons[toAsset.mint]}
                alt={toAsset.name}
                className={styles.tokenIcon}
              />
              <select
                value={toAsset.name}
                onChange={handleToAssetChange}
                className={styles.selectField}
              >
                {assets.map((asset) => (
                  <option key={asset.mint} value={asset.name}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {priceImpact > 0 && (
          <div className={styles.priceImpact}>
            Price Impact: {priceImpact.toFixed(2)}%
          </div>
        )}
        <button
          onClick={signAndSendTransaction}
          className={styles.button}
          disabled={toAsset.mint === fromAsset.mint || isLoading || !!error || toAmount === 0}
        >
          {isLoading ? 'Loading...' : 'Swap'}
        </button>
      </div>
    </div>
  );
}

/* Sample quote response

    {
      "inputMint": "So11111111111111111111111111111111111111112",
      "inAmount": "100000000",
      "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "outAmount": "9998099",
      "otherAmountThreshold": "9948109",
      "swapMode": "ExactIn",
      "slippageBps": 50,
      "platformFee": null,
      "priceImpactPct": "0.000146888216121999999999995",
      "routePlan": [
        {
          "swapInfo": {
            "ammKey": "HcoJqG325TTifs6jyWvRJ9ET4pDu12Xrt2EQKZGFmuKX",
            "label": "Whirlpool",
            "inputMint": "So11111111111111111111111111111111111111112",
            "outputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            "inAmount": "100000000",
            "outAmount": "10003121",
            "feeAmount": "4",
            "feeMint": "So11111111111111111111111111111111111111112"
          },
          "percent": 100
        },
        {
          "swapInfo": {
            "ammKey": "ARwi1S4DaiTG5DX7S4M4ZsrXqpMD1MrTmbu9ue2tpmEq",
            "label": "Meteora DLMM",
            "inputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "inAmount": "10003121",
            "outAmount": "9998099",
            "feeAmount": "1022",
            "feeMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
          },
          "percent": 100
        }
      ],
      "contextSlot": 242289509,
      "timeTaken": 0.002764025
    }
    */

