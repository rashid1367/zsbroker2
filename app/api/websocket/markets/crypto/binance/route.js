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
    console[level](message);
  }
};

const fetchTickers = async () => {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickers`);
    if (!res.ok) {
      throw new Error(`Failed to fetch tickers: ${res.statusText}`);
    }
    const tickers = await res.json();
    return tickers
      .filter(t => t.category === 'Cryptocurrency')
      .map(t => t.symbol.toLowerCase() + '@ticker');
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

const startBinancePriceFeed = async (tickerStreams) => {
  const connect = () => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${tickerStreams.join('/')}`);

    ws.on('open', () => {
      log('✅ WebSocket connection to Binance established');
      retryDelay = 5000; // ریست تأخیر
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        const payload = message.data;

        if (!payload || !payload.s || !payload.c) return;

        const symbol = payload.s;
        const price = parseFloat(payload.c);

        if (messageQueue.length < maxQueueSize) {
          messageQueue.push({ symbol, price });
        } else {
          log('⚠️ Queue is full, message dropped', 'warn');
        }

        if (messageQueue.length >= batchSize) {
          await processQueue();
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
  }, batchInterval); // فقط وقتی صف پر باشه پردازش می‌کنه
};

export async function GET() {
  await connectToDatabase();
  const tickerStreams = await fetchTickers();

  if (!tickerStreams.length) {
    return NextResponse.json({ error: 'No tickers found' }, { status: 404 });
  }

  startBinancePriceFeed(tickerStreams);

  return NextResponse.json({ message: 'Binance WebSocket started', symbols: tickerStreams });
}