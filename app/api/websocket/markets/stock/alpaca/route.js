import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import connectToDatabase from '@/server/mongodb';
import Ticker from '@/models/Ticker';

// بررسی متغیرهای محیطی
let retryDelay = 5000; // شروع با ۵ ثانیه
const maxDelay = 60000; // سقف ۶۰ ثانیه
let messageQueue = [];
const batchInterval = 500; // هر ۵۰۰ میلی‌ثانیه
const batchSize = 100; // یا هر ۱۰۰ پیام
const maxQueueSize = 1000; // محدودیت صف

const log = (message, level = 'info') => {
  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV === 'development' || level === 'error') {
    console[level](`[${timestamp}] ${message}`);
  }
};

const fetchTickers = async (maxRetries = 3, retryDelay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickers`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch tickers: ${res.statusText}`);
      }
      const tickers = await res.json();
      const filteredTickers = tickers
        .filter(t => t.category === 'Stock')
        .map(t => ({
          symbol: t.symbol.toUpperCase(),
          name: t.name || 'Unknown',
        }));
      log(`Fetched ${filteredTickers.length} tickers: ${filteredTickers.map(t => t.symbol).join(', ')}`);
      return filteredTickers;
    } catch (err) {
      log(`Error fetching tickers (attempt ${attempt}): ${err.message}`, 'error');
      if (attempt === maxRetries) return [];
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  return [];
};

const calculatePriceChange = async (symbol, newPrice) => {
  try {
    const ticker = await Ticker.findOne({ symbol }).select('price');
    if (!ticker) {
      log(`No previous price found for ${symbol}, setting change to 0`);
      return 0;
    }
    const change = newPrice - ticker.price;
    log(`Calculated change for ${symbol}: ${change} (new: ${newPrice}, old: ${ticker.price})`);
    return change;
  } catch (err) {
    log(`Error calculating price change for ${symbol}: ${err.message}`, 'error');
    return 0;
  }
};

const processQueue = async () => {
  if (messageQueue.length === 0) return;

  log(`Processing queue with ${messageQueue.length} messages`);
  const operations = [];
  for (const { symbol, price } of messageQueue) {
    const change = await calculatePriceChange(symbol, price);
    operations.push({
      updateOne: {
        filter: { symbol: symbol.toUpperCase() },
        update: {
          $set: {
            price,
            change,
            category: 'Stock',
            isOpen: true,
            updatedAt: new Date(),
            name: 'Unknown', // مقدار پیش‌فرض برای upsert
            description: '', // مقدار پیش‌فرض برای upsert
          },
        },
        upsert: true,
      },
    });
  }

  try {
    const result = await Ticker.bulkWrite(operations);
    log(`✅ Batch update: ${operations.length} tickers, modified: ${result.modifiedCount}, upserted: ${result.upsertedCount}`);
  } catch (err) {
    log(`Error in batch update: ${err.message}, operations: ${operations.length}`, 'error');
  }

  messageQueue = [];
};

const startAlpacaPriceFeed = async (tickerSymbols) => {
  const connect = () => {
    const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/sip'); // یا v2/sip برای حساب‌های غیررایگان

    ws.on('open', () => {
      log('✅ WebSocket connection to Alpaca established');
      retryDelay = 5000;

      // احراز هویت
      ws.send(
        JSON.stringify({
          action: 'auth',
          key: process.env.ALPACA_API_KEY,
          secret: process.env.ALPACA_SECRET_KEY,
        })
      );

      // اشتراک در نمادها پس از احراز هویت
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            action: 'subscribe',
            trades: tickerSymbols.map(({ symbol }) => symbol),
          })
        );
        tickerSymbols.forEach(({ symbol }) => {
          log(`Subscribed to ${symbol}`);
        });
      }, 1000); // تاخیر برای اطمینان از تکمیل احراز هویت
    });

    ws.on('message', async (data) => {
      try {
        log(`Received WebSocket message: ${data}`);
        const message = JSON.parse(data.toString());

        // بررسی پیام‌های خطا یا وضعیت
        if (message.stream === 'authorization' && message.data.status !== 'authorized') {
          log(`Authorization failed: ${JSON.stringify(message.data)}`, 'error');
          ws.close();
          return;
        }

        // پردازش داده‌های معاملات
        if (message.stream === 'trade') {
          const trade = message.data;
          const symbol = trade.S.toUpperCase();
          const price = parseFloat(trade.p);
          log(`Processing trade: symbol=${symbol}, price=${price}`);

          if (messageQueue.length < maxQueueSize) {
            messageQueue.push({ symbol, price });
          } else {
            log(`⚠️ Queue is full, message dropped for ${symbol}`, 'warn');
          }

          if (messageQueue.length >= batchSize) {
            await processQueue();
          }
        }
      } catch (err) {
        log(`Error processing WebSocket message: ${err.message}, data: ${data}`, 'error');
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
      log(`Periodic queue processing triggered, queue size: ${messageQueue.length}`);
      processQueue();
    }
  }, batchInterval);
};

export async function GET() {
  try {
    await connectToDatabase();
    const tickers = await fetchTickers();

    if (!tickers.length) {
      log('No tickers found', 'error');
      return NextResponse.json({ error: 'No tickers found' }, { status: 404 });
    }

    startAlpacaPriceFeed(tickers);

    return NextResponse.json({
      message: 'Alpaca WebSocket started',
      symbols: tickers.map(t => t.symbol),
    });
  } catch (err) {
    log(`Error starting Alpaca feed: ${err.message}`, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}