import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import Ticker from '@/models/Ticker';
import axios from 'axios';
import connectToDatabase from '@/server/mongodb';
import axiosRetry from 'axios-retry';
import pLimit from 'p-limit';

// Rate limiters for Binance and OKX
const binanceLimit = pLimit(15); // Limit to 5 concurrent Binance requests
const okxLimit = pLimit(8); // Limit to 3 concurrent OKX requests

// Global variable to track reconnection attempts
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 5000;

// Configure axios-retry for network errors and HTTP 418/429
axiosRetry(axios, {
  retries: 5,
  retryDelay: (retryCount) => Math.min(retryCount * 5000, 20000), // Exponential backoff, max 20s
  retryCondition: (error) =>
    error.code === 'ECONNRESET' ||
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    (error.response && [418, 429].includes(error.response.status)),
});

// Fetch tickers from /api/tickers
const fetchTickers = async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickers`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch tickers');
    const tickers = await response.json();
    return tickers
      .filter((ticker) => ticker.category === 'Cryptocurrency')
      .map((ticker) => ticker.symbol.toLowerCase() + '@ticker');
  } catch (error) {
    console.error('Error fetching tickers:', error.message);
    return [];
  }
};

// Fetch kline data from Binance
const fetchKlines = async (symbol, interval) => {
  return binanceLimit(async () => {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol: symbol.toUpperCase(), interval, limit: 1 },
        timeout: 10000,
      });
      const [_, open, high, low, close, volume] = response.data[0];
      return { high: parseFloat(high), low: parseFloat(low) };
    } catch (error) {
      console.error(`Error fetching klines for ${symbol} (${interval}) from Binance:`, error.message);
      if (error.response?.status === 418 || error.response?.status === 429) {
        throw new Error('BinanceRateLimitError');
      }
      return null;
    }
  });
};

// Fetch data from Coinranking
const fetchCoinrankingData = async (symbol) => {
  try {
    const coinSymbol = symbol.replace('USDT', '').toLowerCase();
    const response = await axios.get(`https://api.coinranking.com/v2/coins`, {
      headers: { 'x-access-token': process.env.COINRANKING_API_KEY },
      params: { search: coinSymbol, referenceCurrencyUuid: 'yhjMzLPhuIDl' },
      timeout: 5000,
    });

    const coin = response.data.data.coins[0];
    if (!coin) {
      console.warn(`No coin data found for ${symbol} in Coinranking`);
      return null;
    }

    const parseNumber = (value) => (isNaN(parseFloat(value)) ? null : parseFloat(value));
    return {
      price: parseNumber(coin.price),
      change: parseNumber(coin.change),
      volume: parseNumber(coin.volume) || 0,
      high24h: parseNumber(coin.high24h) || parseNumber(coin.price),
      low24h: parseNumber(coin.low24h) || parseNumber(coin.price),
      marketCap: parseNumber(coin.marketCap),
      circulatingSupply: parseNumber(coin.circulatingSupply),
      source: 'Coinranking',
    };
  } catch (error) {
    console.error(`Error fetching Coinranking data for ${symbol}:`, error.message);
    return null;
  }
};

// Fetch kline data from OKX
const fetchOKXKlines = async (symbol, interval) => {
  return okxLimit(async () => {
    try {
      const instId = symbol.replace('USDT', '-USDT');
      const response = await axios.get('https://www.okx.com/api/v5/market/candles', {
        params: { instId, bar: interval.toUpperCase(), limit: 1 },
        headers: { 'OK-ACCESS-KEY': process.env.OKX_API_KEY },
        timeout: 5000,
      });

      const data = response.data.data?.[0];
      if (!data) return null;
      const [_, open, high, low, close, volume] = data;
      return { high: parseFloat(high), low: parseFloat(low) };
    } catch (error) {
      console.error(`Error fetching OKX klines for ${symbol} (${interval}):`, error.message);
      if (error.response?.status === 429) throw new Error('OKXRateLimitError');
      return null;
    }
  });
};

// Fetch data from OKX
const fetchOKXData = async (symbol) => {
  return okxLimit(async () => {
    try {
      const instId = symbol.replace('USDT', '-USDT');
      const response = await axios.get('https://www.okx.com/api/v5/market/ticker', {
        params: { instId },
        headers: { 'OK-ACCESS-KEY': process.env.OKX_API_KEY },
        timeout: 5000,
      });

      const ticker = response.data.data?.[0];
      if (!ticker) return null;
      return {
        price: parseFloat(ticker.last),
        change: parseFloat(ticker.lastSz || 0),
        volume: parseFloat(ticker.vol24h),
        high24h: parseFloat(ticker.high24h),
        low24h: parseFloat(ticker.low24h),
        marketCap: null,
        circulatingSupply: null,
        source: 'OKX',
      };
    } catch (error) {
      console.error(`Error fetching OKX data for ${symbol}:`, error.message);
      if (error.response?.status === 429) throw new Error('OKXRateLimitError');
      return null;
    }
  });
};

// Update kline data with fallback
const updateKlineData = async (symbol, source = 'Binance') => {
  const intervals = ['1h', '4h'];
  const klineData = {};

  for (const interval of intervals) {
    let data;
    try {
      data = source === 'Binance' ? await fetchKlines(symbol, interval) : await fetchOKXKlines(symbol, interval);
    } catch (error) {
      if (error.message === 'OKXRateLimitError') {
        console.warn(`OKX rate limit hit for ${symbol} (${interval}), retrying after delay`);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5s before retry
        data = await fetchOKXKlines(symbol, interval);
      } else {
        throw error;
      }
    }

    if (data) {
      klineData[`high${interval}`] = data.high;
      klineData[`low${interval}`] = data.low;
    } else if (source === 'Binance') {
      console.warn(`Falling back to OKX for kline data for ${symbol} (${interval})`);
      return await updateKlineData(symbol, 'OKX');
    }
  }

  return Object.keys(klineData).length ? klineData : null;
};

// Batch update tickers
const batchUpdateTickers = async (updates) => {
  try {
    const bulkOps = updates.map(({ symbol, data, klineData }) => ({
      updateOne: {
        filter: { symbol },
        update: {
          $set: {
            symbol,
            name: symbol.replace('USDT', '') + ' to USDT',
            price: data.price,
            change: data.change || 0,
            category: 'Cryptocurrency',
            volume: data.volume || 0,
            high24h: data.high24h || data.price,
            low24h: data.low24h || data.price,
            marketCap: data.marketCap || null,
            circulatingSupply: data.circulatingSupply || null,
            ...klineData,
          },
        },
        upsert: true,
      },
    }));

    await Ticker.bulkWrite(bulkOps);
    console.log(`Batch updated ${updates.length} tickers`);
  } catch (error) {
    console.error('Error in batch ticker update:', error.message);
  }
};

// Connect to Binance WebSocket with reconnection
const connectBinanceWebSocket = (tickerStreams, fallbackToOtherSources) => {
  const ws = new WebSocket('wss://stream.binance.com:9443/ws'); // Changed to port 443
  let isReconnecting = false;

  ws.on('open', () => {
    console.log('Connected to Binance WebSocket');
    reconnectAttempts = 0; // Reset attempts on successful connection
    isReconnecting = false;
    ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: tickerStreams, id: 1 }));
  });

  let batchUpdates = [];
  const batchInterval = setInterval(() => {
    if (batchUpdates.length) {
      batchUpdateTickers(batchUpdates);
      batchUpdates = [];
    }
  }, 1000); // Batch updates every 10 seconds

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (!message?.s || !message?.c) return;

      const { s: symbol, c: price, P: change, v: volume, h: high24h, l: low24h } = message;
      const tickerData = {
        price: parseFloat(price),
        change: parseFloat(change),
        volume: parseFloat(volume),
        high24h: parseFloat(high24h),
        low24h: parseFloat(low24h),
        marketCap: null,
        circulatingSupply: null,
        source: 'Binance',
      };

      let klineData;
      try {
        klineData = await updateKlineData(symbol, 'Binance');
      } catch (error) {
        if (error.message === 'BinanceRateLimitError') {
          console.warn(`Rate limit hit for ${symbol}, falling back to OKX`);
          try {
            klineData = await updateKlineData(symbol, 'OKX');
          } catch (okxError) {
            console.warn(`OKX failed for kline data for ${symbol}:`, okxError.message);
            klineData = null;
          }
        } else {
          console.error(`Error fetching kline data for ${symbol}:`, error.message);
          klineData = null;
        }
      }

      if (klineData) {
        console.log(`Successfully fetched kline data for ${symbol} from ${tickerData.source}`);
        batchUpdates.push({ symbol, data: tickerData, klineData });
      } else {
        console.warn(`No kline data for ${symbol}, attempting fallback to OKX/Coinranking`);
        let coinData = await fetchOKXData(symbol);
        if (!coinData) {
          console.warn(`OKX failed for ${symbol}, trying Coinranking`);
          coinData = await fetchCoinrankingData(symbol);
          if (coinData) {
            console.log(`Fetched fallback data for ${symbol} from Coinranking`);
            klineData = {
              high1h: coinData.high24h,
              low1h: coinData.low24h,
              high4h: coinData.high24h,
              low4h: coinData.low24h,
            };
            batchUpdates.push({ symbol, data: coinData, klineData });
          } else {
            console.error(`Coinranking also failed for ${symbol}, no data available`);
          }
        } else {
          console.log(`Fetched fallback data for ${symbol} from OKX`);
          klineData = await updateKlineData(symbol, 'OKX') || {};
          batchUpdates.push({ symbol, data: coinData, klineData });
        }
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error.message);
    }
  });

  ws.on('error', (error) => {
    console.error('Binance WebSocket error:', error.message);
    if (error.message.includes('ECONNREFUSED') && !isReconnecting) {
      console.warn('Connection refused, attempting to reconnect...');
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from Binance WebSocket');
    clearInterval(batchInterval);
    if (reconnectAttempts < maxReconnectAttempts && !isReconnecting) {
      isReconnecting = true;
      reconnectAttempts++;
      console.log(`Reconnecting to Binance WebSocket in ${reconnectDelay / 1000}s... Attempt ${reconnectAttempts}`);
      setTimeout(() => {
        connectBinanceWebSocket(tickerStreams, fallbackToOtherSources);
        isReconnecting = false;
      }, reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached. Falling back to OKX/Coinranking.');
      reconnectAttempts = 0; // Reset for future attempts
      fallbackToOtherSources(tickerStreams);
    }
  });

  return ws;
};

// Fallback function to use OKX or Coinranking
const fallbackToOtherSources = async (tickerStreams) => {
  console.log('Starting fallback to OKX/Coinranking for data fetching');
  const interval = setInterval(async () => {
    const updates = [];
    for (const ticker of tickerStreams) {
      const symbol = ticker.replace('@ticker', '').toUpperCase();
      let klineData;
      let data;

      // Try OKX first
      data = await fetchOKXData(symbol);
      if (data) {
        console.log(`Fetched data for ${symbol} from OKX`);
        klineData = await updateKlineData(symbol, 'OKX') || {};
      } else {
        // Fallback to Coinranking
        console.warn(`OKX failed for ${symbol}, trying Coinranking`);
        data = await fetchCoinrankingData(symbol);
        if (data) {
          console.log(`Fetched data for ${symbol} from Coinranking`);
          klineData = {
            high1h: data.high24h,
            low1h: data.low24h,
            high4h: data.high24h,
            low4h: data.low24h,
          };
        } else {
          console.error(`No data available for ${symbol} from OKX or Coinranking`);
        }
      }

      if (data) {
        updates.push({ symbol, data, klineData: klineData || {} });
      }
    }

    if (updates.length) {
      await batchUpdateTickers(updates);
      console.log(`Fallback update completed, updated ${updates.length} tickers`);
    }
  }, 30000); // Run every 30 seconds to avoid overwhelming APIs

  // Clean up on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(interval);
    console.log('Fallback interval stopped.');
  });
};

// Main handler
export async function GET() {
  await connectToDatabase();
  const tickerStreams = await fetchTickers();

  if (!tickerStreams.length) {
    return NextResponse.json({ error: 'No cryptocurrency tickers found' }, { status: 404 });
  }

  const ws = connectBinanceWebSocket(tickerStreams, fallbackToOtherSources);

  // Periodic fallback updates (every 60 minutes)
  const periodicUpdate = setInterval(async () => {
    const updates = [];
    for (const ticker of tickerStreams) {
      const symbol = ticker.replace('@ticker', '').toUpperCase();
      let klineData;
      let data;

      try {
        klineData = await updateKlineData(symbol, 'Binance');
        if (klineData) {
          data = {
            price: klineData.high1h, // Example, adjust based on your needs
            change: 0,
            volume: 0,
            high24h: klineData.high1h,
            low24h: klineData.low1h,
            marketCap: null,
            circulatingSupply: null,
            source: 'Binance',
          };
        }
      } catch (error) {
        console.warn(`Failed to fetch kline data for ${symbol} from Binance:`, error.message);
        klineData = null;
      }

      if (!klineData) {
        data = await fetchOKXData(symbol);
        if (data) {
          console.log(`Fetched data for ${symbol} from OKX`);
          klineData = await updateKlineData(symbol, 'OKX') || {};
        } else {
          console.warn(`OKX failed for ${symbol}, trying Coinranking`);
          data = await fetchCoinrankingData(symbol);
          if (data) {
            console.log(`Fetched data for ${symbol} from Coinranking`);
            klineData = {
              high1h: data.high24h,
              low1h: data.low24h,
              high4h: data.high24h,
              low4h: data.low24h,
            };
          } else {
            console.error(`No data available for ${symbol} from any source`);
          }
        }
      }

      if (data) {
        updates.push({ symbol, data, klineData: klineData || {} });
      }
    }

    if (updates.length) {
      await batchUpdateTickers(updates);
      console.log(`Periodic update completed, updated ${updates.length} tickers`);
    }
  }, 60 * 60 * 1000); // Every 60 minutes

  // Clean up on server shutdown
  process.on('SIGTERM', () => {
    ws.close();
    clearInterval(periodicUpdate);
    console.log('WebSocket and periodic updates stopped.');
  });

  return NextResponse.json({ message: 'WebSocket connection to Binance started', subscribed: tickerStreams });
};