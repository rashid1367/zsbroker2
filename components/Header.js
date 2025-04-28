import Link from 'next/link'
import React from 'react'
import Image from 'next/image'

function Header() {
  return (
    <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 xl:px-0 py-4 flex justify-between items-center">
          <Link href='/'><Image
            src="/logo.png"
            alt="11Broker Logo"
            width={180}
            height={38}
            priority
       
          /></Link>
          <nav className="flex space-x-4">
            <div className="hidden md:flex transition border border-gray-400 ">
              <input
                type="text"
                placeholder="Search..."
                className="p-2 outline-none"
              />
            </div>
            <Link href="/login" className="hover:text-gray-800 flex transition border border-gray-400 ">
              <p className='py-2 px-4'>Login</p>
            </Link>
          </nav>
        </div>
      </header>
  )
}

export default Header