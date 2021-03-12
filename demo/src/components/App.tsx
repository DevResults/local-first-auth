import { useState } from 'react'
import { peers as allPeers } from '../peers'
import { Chooser } from './Chooser'
import { Peer } from './Peer'
import { TeamProvider } from './TeamProvider'

// 👩🏾💻 Add Alice's laptop by default
allPeers['Alice:laptop'].show = true

export const App = () => {
  const [peers, setPeers] = useState(allPeers)

  const setShow = (v: boolean) => (id: string) =>
    setPeers(peers => ({ ...peers, [id]: { ...peers[id], show: v } }))

  return (
    <div className="App flex p-3 gap-3" style={{ minWidth: 2400 }}>
      {Object.values(peers)
        .filter(p => p.show)
        .map(p => (
          <TeamProvider key={p.id} peerInfo={p}>
            <Peer onRemove={setShow(false)} peerInfo={p}></Peer>
          </TeamProvider>
        ))}
      <Chooser onAdd={setShow(true)} peers={peers}></Chooser>
    </div>
  )
}
