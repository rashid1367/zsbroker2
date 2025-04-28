import Link from 'next/link'
import React from 'react'

function Footer() {
  return (
    <footer className=" bg-white py-6">
        <div className=" max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>© 2025 11broker. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/about" className="hover:text-gray-800">
              About
            </Link>
            <Link href="/contact" className="hover:text-gray-800">
              Contact
            </Link>
            <Link href="/privacy-policy" className="hover:text-gray-800">
              Privacy Policy
            </Link>
            <Link href="/terms-of-service" className="hover:text-gray-800">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
  )
}

export default Footer