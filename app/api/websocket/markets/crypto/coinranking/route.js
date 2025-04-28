import { NextResponse } from 'next/server';
import connectToDatabase from '@/server/mongodb';
import Ticker from '@/models/Ticker';
import { setInterval } from 'timers';

let retryDelay = 5000; // Start with 5 seconds
const maxDelay = 60000; // Max 60 seconds
let messageQueue = [];
const batchInterval = 500; // Every 500ms
const batchSize = 100; // Or every 100 messages
const maxQueueSize = 1000; // Queue limit

const log = (message, level = 'info') => {
  if (process.env.NODE_ENV === 'development' || level === 'error') {
    console[level](message);
  }
};

const fetchTickers = async () => {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error('NEXT_PUBLIC_API_URL is not set');
    }
    const res = await fetch(`${apiUrl}/api/tickers`);
    if (!res.ok) {
      throw new Error(`Failed to fetch tickers: ${res.statusText}`);
    }
    const tickers = await res.json();
    
    // Filter cryptocurrency tickers
    const cryptoTickers = Array.isArray(tickers)
      ? tickers.filter(t => t.category === 'Cryptocurrency')
      : [];
    if (!cryptoTickers.length) {
      throw new Error('No cryptocurrency tickers found');
    }

    // Get UUIDs from CoinRanking
    const apiKey = process.env.COINRANKING_API_KEY;
    if (!apiKey) {
      throw new Error('COINRANKING_API_KEY is not set');
    }
    const coinRes = await fetch('https://api.coinranking.com/v2/coins', {
      headers: { 'x-access-token': apiKey }
    });
    if (!coinRes.ok) {
      throw new Error(`Failed to fetch coins: ${coinRes.statusText}`);
    }
    const coinData = await coinRes.json();
    
    // Map tickers to CoinRanking UUIDs
    const tickerData = cryptoTickers
      .map(ticker => {
        const coinSymbol = ticker.symbol.replace('USDT', '');
        const coin = coinData.data.coins.find(c => c.symbol.toUpperCase() === coinSymbol.toUpperCase());
        if (!coin) {
          log(`Coin ${coinSymbol} not found in CoinRanking`, 'warn');
          return null;
        }
        return { uuid: coin.uuid, dbSymbol: ticker.symbol };
      })
      .filter(Boolean);

    return tickerData;
  } catch (err) {
    log(`Error fetching tickers: ${err.message}`, 'error');
    return [];
  }
};

const processQueue = async () => {
  if (messageQueue.length === 0) return;

  const operations = messageQueue.map(({ symbol, price }) => ({
    updateOne: {
      filter: { symbol },
      update: { $set: { price } },
      upsert: true,
    },
  }));

  try {
    await Ticker.bulkWrite(operations);
    log(`✅ Batch update: ${operations.length} tickers`);
  } catch (err) {
    log(`Error in batch update: ${err.message}`, 'error');
  }

  messageQueue = [];
};

const fetchCoinPrices = async (uuids) => {
  try {
    const apiKey = process.env.COINRANKING_API_KEY;
    if (!apiKey) {
      throw new Error('COINRANKING_API_KEY is not set');
    }
    const prices = [];
    for (const uuid of uuids) {
      const res = await fetch(`https://api.coinranking.com/v2/coin/${uuid}`, {
        headers: { 'x-access-token': apiKey }
      });
      if (!res.ok) {
        log(`Failed to fetch coin ${uuid}: ${res.statusText}`, 'warn');
        continue;
      }
      const data = await res.json();
      prices.push({
        symbol: data.data.coin.symbol + 'USDT',
        price: parseFloat(data.data.coin.price)
      });
    }
    return prices;
  } catch (err) {
    log(`Error fetching coin prices: ${err.message}`, 'error');
    return [];
  }
};

const startCoinRankingPriceFeed = async (tickerData) => {
  const uuids = tickerData.map(t => t.uuid);
  const uuidToDbSymbol = new Map(tickerData.map(t => [t.uuid, t.dbSymbol]));

  const poll = async () => {
    try {
      const prices = await fetchCoinPrices(uuids);
      const mappedPrices = prices.map(price => ({
        symbol: uuidToDbSymbol.get(
          tickerData.find(t => t.dbSymbol === price.symbol)?.uuid
        ) || price.symbol,
        price: price.price
      }));

      if (messageQueue.length < maxQueueSize) {
        messageQueue.push(...mappedPrices);
      } else {
        log('⚠️ Queue is full, messages dropped', 'warn');
      }

      if (messageQueue.length >= batchSize) {
        await processQueue();
      }
    } catch (err) {
      log(`Polling error: ${err.message}`, 'error');
    }

    setTimeout(poll, retryDelay);
    retryDelay = Math.min(retryDelay * 2, maxDelay);
  };

  poll();
  setInterval(() => {
    if (messageQueue.length > 0) {
      processQueue();
    }
  }, batchInterval);
};

export async function GET() {
  await connectToDatabase();
  const tickerData = await fetchTickers();

  if (!tickerData.length) {
    return NextResponse.json({ error: 'No coins found' }, { status: 404 });
  }

  startCoinRankingPriceFeed(tickerData);

  return NextResponse.json({ 
    message: 'CoinRanking price polling started', 
    symbols: tickerData.map(t => t.dbSymbol) 
  });
}