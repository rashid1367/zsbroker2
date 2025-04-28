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
      .map(t => ({
        channel: 'tickers',
        instId: t.symbol.replace('USDT', '-USDT') // تبدیل BTCUSDT به BTC-USDT
      }));
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

const startOKXPriceFeed = async (tickerStreams) => {
  const connect = () => {
    const ws = new WebSocket('wss://wspap.okx.com:8443/ws/v5/public');

    ws.on('open', () => {
      log('✅ WebSocket connection to OKX established');
      retryDelay = 5000; // ریست تأخیر

      // اشتراک به کانال‌های تیکری
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: tickerStreams
      }));
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // بررسی پاسخ‌های خطا یا موفقیت
        if (message.event === 'error') {
          log(`OKX WebSocket error: ${message.msg}`, 'error');
          return;
        }

        // بررسی داده‌های تیکری
        if (message.arg && message.arg.channel === 'tickers' && message.data) {
          const payload = message.data[0];
          if (!payload || !payload.instId || !payload.last) return;

          const symbol = payload.instId.replace('-', ''); // تبدیل BTC-USDT به BTCUSDT برای سازگاری
          const price = parseFloat(payload.last);

          if (messageQueue.length < maxQueueSize) {
            messageQueue.push({ symbol, price });
          } else {
            log('⚠️ Queue is full, message dropped', 'warn');
          }

          if (messageQueue.length >= batchSize) {
            await processQueue();
          }
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
  const tickerStreams = await fetchTickers();

  if (!tickerStreams.length) {
    return NextResponse.json({ error: 'No tickers found' }, { status: 404 });
  }

  startOKXPriceFeed(tickerStreams);

  // تبدیل نمادها برای پاسخ
  const symbols = tickerStreams.map(stream => stream.instId);
  return NextResponse.json({ message: 'OKX WebSocket started', symbols });
}