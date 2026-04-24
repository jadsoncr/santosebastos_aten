'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Socket } from 'socket.io-client'
import { getSocket } from '@/utils/socket'

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

export default function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const s = getSocket()
    setSocket(s)
  }, [])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}
