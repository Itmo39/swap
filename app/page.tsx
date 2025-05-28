'use client'

import styles from './swap.module.css';
import { useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction, Connection, PublicKey } from '@solana/web3.js';
import React, { useState, useEffect, useCallback } from 'react';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const assets = [
  { name: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9},
  { name: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6},
  { name: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6},
  { name: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  { name: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6},
  { name: 'BEEMX', mint: 'ACMk9h76WrHaLFy7GYZB4yCea62KruCyj9jFQGq15P6o', decimals: 6},
];

const COMMISSION_BPS = 400; // 4% commission fee
const COMMISSION_WALLET = '5SH3qgbtNn8tysRuT17V4Q6b9MEGkjZAtDWZG1cDrcge'; // Updated commission wallet address

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

export default function Page() {
  return (
    <div className={styles.body}>
      <div className={styles.swapCard}>
        <h1 style={{ color: '#fff', textAlign: 'center' }}>Welcome to BEEMX SWAP</h1>
        <p style={{ color: '#fff', textAlign: 'center' }}>
          Please go to <a href="/swap" style={{ color: '#4CAF50' }}>/swap</a> to use the swap interface.
        </p>
      </div>
    </div>
  );
}