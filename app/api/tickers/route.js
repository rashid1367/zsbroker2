import Ticker from "@/models/Ticker";
import connectToDatabase from "@/server/mongodb";

export async function POST(request) {
  await connectToDatabase();

  const { symbol, name, price, change, category, description, volume, marketCap, high24h, low24h } = await request.json();

  // Validate required fields
  if (!symbol || !name || !price || !change || !category) {
    return new Response(JSON.stringify({ message: "Symbol, name, price, change, and category are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const newTicker = new Ticker({
      symbol,
      name,
      price,
      change,
      category,
      description,
      volume,
      marketCap,
      high24h,
      low24h,
    });
    await newTicker.save();

    return new Response(
      JSON.stringify({ message: "New ticker created", newTicker }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating ticker:", error);
    return new Response(JSON.stringify({ message: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(request) {
  await connectToDatabase();

  try {
    const markets = await Ticker.find({}).exec();
    return new Response(JSON.stringify(markets), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching tickers:", error);
    return new Response(JSON.stringify({ message: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}