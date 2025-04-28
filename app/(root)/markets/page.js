"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // اضافه کردن useRouter برای ناوبری
import {
  GlobeAltIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

export default function Markets() {
  const [selectedCategory, setSelectedCategory] = useState("Cryptocurrency");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [markets, setMarkets] = useState([]);
  const marketsPerPage = 10;
  const router = useRouter(); // استفاده از useRouter

  // بارگذاری داده‌ها از MongoDB
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch("/api/tickers");
        if (response.ok) {
          const data = await response.json();
          setMarkets(data);
        } else {
          console.error("Failed to fetch markets from MongoDB");
        }
      } catch (error) {
        console.error("Error fetching markets:", error);
      }
    };

    fetchMarkets();
  }, []);

  // فیلتر کردن داده‌ها بر اساس دسته‌بندی و جستجو
  const filteredMarkets = markets
    .filter((market) => market.category === selectedCategory)
    .filter(
      (market) =>
        market.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        market.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // منطق صفحه‌بندی
  const totalPages = Math.ceil(filteredMarkets.length / marketsPerPage);
  const startIndex = (currentPage - 1) * marketsPerPage;
  const currentMarkets = filteredMarkets.slice(startIndex, startIndex + marketsPerPage);

  // تغییر دسته‌بندی
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setSearchTerm("");
  };

  // حذف بازار
  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this market?")) {
      try {
        const response = await fetch(`/api/tickers/${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setMarkets(markets.filter((market) => market._id !== id));
          console.log("Market deleted successfully");
        } else {
          console.error("Failed to delete market");
        }
      } catch (error) {
        console.error("Error deleting market:", error);
      }
    }
  };

  // تابع برای هدایت به صفحه ایجاد
  const handleCreate = () => {
    router.push("/markets/create");
  };

  return (
    <section className="bg-white shadow-md p-6 max-w-7xl mx-auto mt-8">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <GlobeAltIcon className="h-8 w-8 text-blue-500" />
            <h2 className="ml-4 text-3xl font-bold text-blue-600">Markets Management</h2>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["Cryptocurrency", "Stock", "Forex",'etfs', 'future', "Commodity", "Other"].map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`px-4 py-2 rounded-lg capitalize ${
                selectedCategory === category
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Markets Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-50 rounded-lg shadow">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Symbol</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Price</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Change</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Volume</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Market Cap</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">High 24h</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Low 24h</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-800">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentMarkets.length > 0 ? (
                currentMarkets.map((market) => (
                  <tr key={market._id} className="border-t hover:bg-gray-100">
                    <td className="px-6 py-4 text-gray-800">{market.name}</td>
                    <td className="px-6 py-4 text-gray-800">{market.symbol}</td>
                    <td className="px-6 py-4 text-gray-800">{market.price.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-800">{market.change.toFixed(2)}%</td>
                    <td className="px-6 py-4 text-gray-800">{market.volume || "N/A"}</td>
                    <td className="px-6 py-4 text-gray-800">{market.marketCap || "N/A"}</td>
                    <td className="px-6 py-4 text-gray-800">{market.high24h?.toFixed(2) || "N/A"}</td>
                    <td className="px-6 py-4 text-gray-800">{market.low24h?.toFixed(2) || "N/A"}</td>
                    <td className="px-6 py-4 flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-800">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(market._id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-600">
                    No markets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
            >
              Previous
            </button>
            <span className="text-gray-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}