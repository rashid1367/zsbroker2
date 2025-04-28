import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import connectToDatabase from '@/server/mongodb';
import Ticker from '@/models/Ticker';
import { setInterval } from 'timers';

let retryDelay = 5000; // شروع با ۵ ثانیه
const maxDelay = 60000; // سقف ۶۰ ثانیه
let messageQueue = [];
const batchInterval = 500; // هر ۵۰۰ میلی‌ثانیه
const batchSize = 100; // یا هر ۱۰۰ پیام
const maxQueueSize = 1000; // محدودیت صف

const log = (message, level = 'info') => {
  if (process.env.NODE_ENV === 'development' || level === 'error') {
    console[level](`[${new Date().toISOString()}] ${message}`);
  }
};

// نگاشت دوطرفه برای نمادها
const symbolMap = {
  BTCUSDT: 'XBT/USD',
  ETHUSDT: 'ETH/USD',
};

// تبدیل Kraken به Binance
const convertToBinanceSymbol = (krakenSymbol) => {
  const binanceSymbol = Object.keys(symbolMap).find(
    (key) => symbolMap[key] === krakenSymbol
  );
  if (!binanceSymbol) {
    log(`⚠️ No Binance symbol found for ${krakenSymbol}`, 'warn');
    return null;
  }
  log(`🔄 Converted ${krakenSymbol} to ${binanceSymbol}`);
  return binanceSymbol;
};

const fetchTickers = async () => {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickers`);
    if (!res.ok) {
      throw new Error(`Failed to fetch tickers: ${res.statusText}`);
    }
    const tickers = await res.json();
    const validTickers = tickers
      .filter(t => t.category === 'Cryptocurrency' && symbolMap[t.symbol.toUpperCase()])
      .map(t => ({
        binanceSymbol: t.symbol.toUpperCase(),
        krakenSymbol: symbolMap[t.symbol.toUpperCase()],
      }));
    log(`📋 Fetched and mapped tickers: ${validTickers.map(t => `${t.binanceSymbol} -> ${t.krakenSymbol}`).join(', ')}`);
    return validTickers;
  } catch (err) {
    log(`Error fetching tickers: ${err.message}`, 'error');
    return [];
  }
};

const processQueue = async () => {
  if (messageQueue.length === 0) return;

  const operations = [];
  for (const { binanceSymbol, price } of messageQueue) {
    // بررسی وجود رکورد در دیتابیس
    const exists = await Ticker.findOne({ symbol: binanceSymbol });
    if (!exists) {
      log(`⚠️ Ticker ${binanceSymbol} not found in database, skipping`, 'warn');
      continue;
    }
    operations.push({
      updateOne: {
        filter: { symbol: binanceSymbol },
        update: { $set: { price, updatedAt: new Date() } },
        upsert: false,
      },
    });
  }

  if (operations.length === 0) {
    log(`⚠️ No valid operations to process`, 'warn');
    messageQueue = [];
    return;
  }

  try {
    const result = await Ticker.bulkWrite(operations);
    log(`✅ Batch update: ${result.modifiedCount} tickers modified`);
  } catch (err) {
    log(`Error in batch update: ${err.message}`, 'error');
  }

  messageQueue = [];
};

const startKrakenPriceFeed = async (tickerPairs) => {
  const connect = () => {
    const ws = new WebSocket('wss://ws.kraken.com');

    ws.on('open', () => {
      log('✅ WebSocket connection to Kraken established');
      retryDelay = 5000;

      const subscriptionMessage = {
        event: 'subscribe',
        pair: tickerPairs.map(t => t.krakenSymbol),
        subscription: { name: 'ticker' },
      };
      ws.send(JSON.stringify(subscriptionMessage));
      log(`📤 Sent subscription: ${JSON.stringify(subscriptionMessage)}`);
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        log(`📩 Raw message: ${JSON.stringify(message)}`);

        if (message.event) {
          if (message.event === 'error') {
            log(`Kraken WebSocket error: ${message.message}`, 'error');
          } else if (message.event === 'subscriptionStatus') {
            log(`Subscription status: ${message.status} for ${message.pair}`);
          } else if (message.event === 'systemStatus') {
            log(`System status: ${message.status}`);
          }
          return;
        }

        if (Array.isArray(message) && message[1]?.c) {
          const tickerData = message[1];
          const krakenSymbol = message[3];
          const price = parseFloat(tickerData.c[0]);

          const binanceSymbol = convertToBinanceSymbol(krakenSymbol);
          if (!binanceSymbol) return;

          if (messageQueue.length < maxQueueSize) {
            messageQueue.push({ binanceSymbol, price });
            log(`📥 Received price for ${binanceSymbol} (${krakenSymbol}): ${price}`);
          } else {
            log('⚠️ Queue is full, message dropped', 'warn');
          }

          if (messageQueue.length >= batchSize) {
            await processQueue();
          }
        } else {
          log(`⚠️ Unexpected message format`, 'warn');
        }
      } catch (err) {
        log(`Error processing WebSocket message: ${err.message}`, 'error');
      }
    });

    ws.on('close', () => {
      log('❌ WebSocket connection closed', 'warn');
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, maxDelay);
    });

    ws.on('error', (err) => {
      log(`WebSocket error: ${err.message}`, 'error');
      ws.close();
    });
  };

  connect();
  setInterval(() => {
    if (messageQueue.length > 0) {
      processQueue();
    }
  }, batchInterval);
};

export async function GET() {
  await connectToDatabase();
  const tickerPairs = await fetchTickers();

  if (!tickerPairs.length) {
    return NextResponse.json({ error: 'No tickers found' }, { status: 404 });
  }

  startKrakenPriceFeed(tickerPairs);

  return NextResponse.json({
    message: 'Kraken WebSocket started',
    symbols: tickerPairs.map(t => t.krakenSymbol),
  });
}