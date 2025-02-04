import React from 'react'
import { ReactNode } from 'react'

export const CardLabel = ({ children }: CardLabelProps) => (
  <h2 className="CardLabel text-xs tracking-widest text-gray-400 uppercase">{children}</h2>
)
interface CardLabelProps {
  children: ReactNode
}
