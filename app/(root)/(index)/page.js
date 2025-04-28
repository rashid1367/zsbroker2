"use client";

import Link from "next/link";
import {
  UsersIcon,
  GlobeAltIcon,
  BriefcaseIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentIcon,
  CogIcon,
  BellIcon,
} from "@heroicons/react/24/outline";

export default function Dashboard() {
  return (
    <section className="bg-white shadow-md p-6 max-w-7xl mx-auto my-8">
      <div>
        <h2 className="text-4xl font-bold text-blue-600 mb-6">Admin Dashboard</h2>

        {/* Summary Section */}
        <div className="mb-8 p-4 bg-blue-50 rounded-lg shadow">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-lg shadow">
              <p className="text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-800">1,500</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <p className="text-gray-600">Open Positions</p>
              <p className="text-2xl font-bold text-gray-800">250</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <p className="text-gray-600">Pending Orders</p>
              <p className="text-2xl font-bold text-gray-800">30</p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow">
              <p className="text-gray-600">Total Profit</p>
              <p className="text-2xl font-bold text-gray-800">$50,000</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-8 p-4 bg-yellow-50 rounded-lg shadow flex items-center">
          <BellIcon className="h-6 w-6 text-yellow-500" />
          <p className="ml-4 text-gray-800">There are 3 new alerts. <a href="#" className="text-blue-600 hover:underline">View details</a></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Users Card */}
          <Link
            href="/users"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <UsersIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Users
              </h3>
            </div>
            <p className="mt-2 text-gray-600">
              Manage user accounts and view details.
            </p>
            <div className="mt-4">
              <span className="text-2xl font-bold text-gray-800">1,500</span>
              <span className="ml-2 text-gray-600">Total Users</span>
            </div>
          </Link>

          {/* Markets Card */}
          <Link
            href="/markets"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <GlobeAltIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Markets
              </h3>
            </div>
            <p className="mt-2 text-gray-600">
              View and manage available markets.
            </p>
            <div className="mt-4">
              <span className="text-2xl font-bold text-gray-800">10</span>
              <span className="ml-2 text-gray-600">Active Markets</span>
            </div>
          </Link>

          {/* Positions Card */}
          <Link
            href="/dashboard/positions"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <BriefcaseIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Positions
              </h3>
            </div>
            <p className="mt-2 text-gray-600">
              Monitor open positions across users.
            </p>
            <div className="mt-4">
              <span className="text-2xl font-bold text-gray-800">250</span>
              <span className="ml-2 text-gray-600">Open Positions</span>
            </div>
          </Link>

          {/* Pre Orders Card */}
          <Link
            href="/dashboard/preorders"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Pre Orders
              </h3>
            </div>
            <p className="mt-2 text-gray-600">Manage pending orders.</p>
            <div className="mt-4">
              <span className="text-2xl font-bold text-gray-800">30</span>
              <span className="ml-2 text-gray-600">Pending Orders</span>
            </div>
          </Link>

          {/* Profit Card */}
          <Link
            href="/dashboard/profit"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Profit
              </h3>
            </div>
            <p className="mt-2 text-gray-600">
              View profit and loss statistics.
            </p>
            <div className="mt-4">
              <span className="text-2xl font-bold text-gray-800">$50,000</span>
              <span className="ml-2 text-gray-600">Total Profit</span>
            </div>
          </Link>

          {/* Reports Card */}
          <Link
            href="/dashboard/reports"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <DocumentIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Reports
              </h3>
            </div>
            <p className="mt-2 text-gray-600">Generate and view reports.</p>
            <div className="mt-4">
              <span className="text-2xl font-bold text-gray-800">5</span>
              <span className="ml-2 text-gray-600">Available Reports</span>
            </div>
          </Link>

          {/* Settings Card */}
          <Link
            href="/dashboard/settings"
            className="block p-4 bg-gray-50 rounded-lg shadow hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center">
              <CogIcon className="h-8 w-8 text-blue-500" />
              <h3 className="ml-4 text-xl font-semibold text-gray-800">
                Settings
              </h3>
            </div>
            <p className="mt-2 text-gray-600">Configure platform settings.</p>
          </Link>
        </div>

        {/* Interactive Elements: Placeholder for Charts */}
        <div className="mt-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Data Visualization</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg shadow">
              <h4 className="text-xl font-semibold text-gray-800 mb-2">Profit Over Time</h4>
              <div className="h-64 bg-gray-200 flex items-center justify-center">
                <p className="text-gray-500">Chart Placeholder</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg shadow">
              <h4 className="text-xl font-semibold text-gray-800 mb-2">Position Distribution</h4>
              <div className="h-64 bg-gray-200 flex items-center justify-center">
                <p className="text-gray-500">Chart Placeholder</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}