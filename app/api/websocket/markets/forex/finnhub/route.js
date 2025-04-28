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
      // Correct symbol format to OANDA:EUR_USD
      const forexTickers = tickers
        .filter(t => t.category === 'Forex')
        .map(t => `OANDA:${t.symbol.replace('/', '_').toUpperCase().replace('USD', 'USD')}`);
      log(`Fetched Forex tickers: ${JSON.stringify(forexTickers)}`);
      return forexTickers;
    } catch (err) {
      log(`Error fetching tickers: ${err.message}`, 'error');
      return [];
    }
  };
  

const processQueue = async () => {
  if (messageQueue.length === 0) return;

  const operations = messageQueue.map(({ symbol, price }) => ({
    updateOne: {
      filter: { symbol: symbol.replace('OANDA:', '') }, // حذف پیشوند برای ذخیره‌سازی
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

const startFinnhubPriceFeed = async (tickerSymbols) => {
  const connect = () => {
    const ws = new WebSocket(`wss://ws.finnhub.io?token=${process.env.FINNHUB_API_KEY}`);

    ws.on('open', () => {
      log('✅ WebSocket connection to Finnhub established');
      retryDelay = 5000; // ریست تأخیر
      // اشتراک در نمادها
      tickerSymbols.forEach(symbol => {
        ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        log(`Subscribed to ${symbol}`);
      });
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        if (message.type !== 'trade' || !message.data) return;

        message.data.forEach(async trade => {
          const symbol = trade.s; // نماد (مثلاً BINANCE:BTCUSDT)
          const price = parseFloat(trade.p); // قیمت

          if (messageQueue.length < maxQueueSize) {
            messageQueue.push({ symbol, price });
          } else {
            log('⚠️ Queue is full, message dropped', 'warn');
          }

          if (messageQueue.length >= batchSize) {
            await processQueue();
          }
        });
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
  const tickerSymbols = await fetchTickers();

  if (!tickerSymbols.length) {
    return NextResponse.json({ error: 'No tickers found' }, { status: 404 });
  }

  // اطمینان از تنظیم API Key
  if (!process.env.FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'Finnhub API key not configured' }, { status: 500 });
  }

  startFinnhubPriceFeed(tickerSymbols);

  return NextResponse.json({ message: 'Finnhub WebSocket started', symbols: tickerSymbols });
}