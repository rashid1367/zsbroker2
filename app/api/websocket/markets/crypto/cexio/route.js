import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import connectToDatabase from '@/server/mongodb';
import Ticker from '@/models/Ticker';
import { setInterval } from 'timers';
import crypto from 'crypto';

const CEXIO_WS_URL = 'wss://ws.cex.io/ws';
const CEXIO_API_KEY = process.env.CEXIO_API_KEY || 'your_new_api_key_here'; // کلید جدید
const CEXIO_API_SECRET = process.env.CEXIO_API_SECRET || 'your_new_api_secret_here'; // رمز جدید

let retryDelay = 5000;
const maxDelay = 60000;
let messageQueue = [];
const batchInterval = 500;
const batchSize = 100;
const maxQueueSize = 1000;

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

const startCexioPriceFeed = async (tickerPairs) => {
  const connect = () => {
    const ws = new WebSocket(CEXIO_WS_URL);

    ws.on('open', () => {
      log('✅ WebSocket connection to CEX.IO established');
      log(`Using API Key: ${CEXIO_API_KEY.substring(0, 8)}...`, 'debug');
      log(`Server time: ${new Date().toISOString()}`, 'debug'); // بررسی زمان سرور
      retryDelay = 5000;

      // تولید پیام احراز هویت
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac('sha256', CEXIO_API_SECRET)
        .update(timestamp + CEXIO_API_KEY)
        .digest('hex');

      const authMessage = {
        e: 'auth',
        auth: {
          key: CEXIO_API_KEY,
          signature,
          timestamp,
        },
      };
      log(`Sending auth message: ${JSON.stringify(authMessage)}`, 'debug');
      ws.send(JSON.stringify(authMessage));
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        log(`Received message: ${JSON.stringify(message)}`, 'debug');

        if (message.e === 'auth') {
          if (message.ok === 'ok') {
            log('✅ Authentication successful');
            tickerPairs.forEach(pair => {
              ws.send(
                JSON.stringify({
                  e: 'subscribe',
                  rooms: [`ticker-${pair}`],
                })
              );
              log(`Subscribed to ticker: ${pair}`, 'debug');
            });
          } else {
            log(`❌ Authentication failed: ${JSON.stringify(message)}`, 'error');
            ws.close();
          }
        } else if (message.e === 'ticker') {
          const symbol = message.data.pair.replace(':', '/');
          const price = parseFloat(message.data.last);

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
  const tickerPairs = await fetchTickers();

  if (!tickerPairs.length) {
    log('No tickers found, returning error response', 'error');
    return NextResponse.json({ error: 'No tickers found' }, { status: 404 });
  }

  startCexioPriceFeed(tickerPairs);

  return NextResponse.json({ message: 'CEX.IO WebSocket started', symbols: tickerPairs });
}