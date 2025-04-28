import mongoose from 'mongoose';

const tickerSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  change: { type: Number, required: true },
  category: {
    type: String,
    enum: ['Cryptocurrency', 'Stock', 'Forex', 'Other'],
    default: 'Other',
  },
  isOpen: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Ticker || mongoose.model('Ticker', tickerSchema);