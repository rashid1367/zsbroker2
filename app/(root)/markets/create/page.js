"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function CreateMarket() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    symbol: "",
    name: "",
    price: "",
    change: "",
    category: "Cryptocurrency",
    description: "",
    volume: "",
    marketCap: "",
    high24h: "",
    low24h: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const inputClass = `mt-1 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none`;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.symbol) newErrors.symbol = "Symbol is required";
    if (!formData.name) newErrors.name = "Name is required";
    if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0)
      newErrors.price = "Price must be a positive number";
    if (!formData.change || isNaN(parseFloat(formData.change)))
      newErrors.change = "Change must be a number";
    if (formData.volume && (isNaN(parseFloat(formData.volume)) || parseFloat(formData.volume) < 0))
      newErrors.volume = "Volume must be a non-negative number";
    if (formData.marketCap && (isNaN(parseFloat(formData.marketCap)) || parseFloat(formData.marketCap) < 0))
      newErrors.marketCap = "Market Cap must be a non-negative number";
    if (formData.high24h && (isNaN(parseFloat(formData.high24h)) || parseFloat(formData.high24h) <= 0))
      newErrors.high24h = "High 24h must be a positive number";
    if (formData.low24h && (isNaN(parseFloat(formData.low24h)) || parseFloat(formData.low24h) <= 0))
      newErrors.low24h = "Low 24h must be a positive number";
    if (
      formData.high24h &&
      formData.low24h &&
      parseFloat(formData.high24h) < parseFloat(formData.low24h)
    ) {
      newErrors.high24h = "High 24h must be greater than Low 24h";
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/tickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: formData.symbol,
          name: formData.name,
          price: parseFloat(formData.price),
          change: parseFloat(formData.change),
          category: formData.category,
          description: formData.description || undefined,
          volume: formData.volume ? parseFloat(formData.volume) : undefined,
          marketCap: formData.marketCap ? parseFloat(formData.marketCap) : undefined,
          high24h: formData.high24h ? parseFloat(formData.high24h) : undefined,
          low24h: formData.low24h ? parseFloat(formData.low24h) : undefined,
        }),
      });

      if (response.ok) {
        toast.success("Market created successfully!");
        setFormData({
          symbol: "",
          name: "",
          price: "",
          change: "",
          category: "Cryptocurrency",
          description: "",
          volume: "",
          marketCap: "",
          high24h: "",
          low24h: "",
        });
        setTimeout(() => router.push("/markets"), 1500);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || "Failed to create market");
      }
    } catch (error) {
      toast.error("Error creating market");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/markets");
  };

  return (
    <div className="max-w-3xl mx-auto my-8 p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-3xl font-bold text-blue-600 mb-6">Create New Market</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Symbol */}
        <div>
          <label htmlFor="symbol" className="block text-sm font-medium text-gray-700">
            Symbol <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="symbol"
            name="symbol"
            value={formData.symbol}
            onChange={handleChange}
            placeholder="e.g., BTCUSDT"
            className={`${inputClass} ${errors.symbol ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.symbol && <p className="mt-1 text-sm text-red-500">{errors.symbol}</p>}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Bitcoin/USD"
            className={`${inputClass} ${errors.name ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
        </div>

        {/* Price */}
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-700">
            Price <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            step="0.01"
            placeholder="e.g., 60000"
            className={`${inputClass} ${errors.price ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
        </div>

        {/* Change */}
        <div>
          <label htmlFor="change" className="block text-sm font-medium text-gray-700">
            Change (%) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="change"
            name="change"
            value={formData.change}
            onChange={handleChange}
            step="0.01"
            placeholder="e.g., 2.5"
            className={`${inputClass} ${errors.change ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.change && <p className="mt-1 text-sm text-red-500">{errors.change}</p>}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={`${inputClass} border-gray-300`}
          >
            <option value="Cryptocurrency">Cryptocurrency</option>
            <option value="Stock">Stock</option>
            <option value="Forex">Forex</option>
            <option value="Commodity">Commodity</option>
            <option value="etfs">ETFs</option>
            <option value="future">Futures</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="e.g., A decentralized digital currency"
            className={`${inputClass} border-gray-300`}
            rows="4"
          />
        </div>

        {/* Volume */}
        <div>
          <label htmlFor="volume" className="block text-sm font-medium text-gray-700">
            Volume
          </label>
          <input
            type="number"
            id="volume"
            name="volume"
            value={formData.volume}
            onChange={handleChange}
            step="0.01"
            placeholder="e.g., 1000000"
            className={`${inputClass} ${errors.volume ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.volume && <p className="mt-1 text-sm text-red-500">{errors.volume}</p>}
        </div>

        {/* Market Cap */}
        <div>
          <label htmlFor="marketCap" className="block text-sm font-medium text-gray-700">
            Market Cap
          </label>
          <input
            type="number"
            id="marketCap"
            name="marketCap"
            value={formData.marketCap}
            onChange={handleChange}
            step="0.01"
            placeholder="e.g., 1200000000000"
            className={`${inputClass} ${errors.marketCap ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.marketCap && <p className="mt-1 text-sm text-red-500">{errors.marketCap}</p>}
        </div>

        {/* High 24h */}
        <div>
          <label htmlFor="high24h" className="block text-sm font-medium text-gray-700">
            High 24h
          </label>
          <input
            type="number"
            id="high24h"
            name="high24h"
            value={formData.high24h}
            onChange={handleChange}
            step="0.01"
            placeholder="e.g., 62000"
            className={`${inputClass} ${errors.high24h ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.high24h && <p className="mt-1 text-sm text-red-500">{errors.high24h}</p>}
        </div>

        {/* Low 24h */}
        <div>
          <label htmlFor="low24h" className="block text-sm font-medium text-gray-700">
            Low 24h
          </label>
          <input
            type="number"
            id="low24h"
            name="low24h"
            value={formData.low24h}
            onChange={handleChange}
            step="0.01"
            placeholder="e.g., 59000"
            className={`${inputClass} ${errors.low24h ? "border-red-500" : "border-gray-300"}`}
          />
          {errors.low24h && <p className="mt-1 text-sm text-red-500">{errors.low24h}</p>}
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
}