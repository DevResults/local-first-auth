import * as auth from '@localfirst/auth'
import { EventEmitter } from './EventEmitter'

export class Connection extends EventEmitter {
  private authConnection: auth.Connection
  private peerSocket: WebSocket

  constructor({ socket, context, peerUserName, storedMessages }: ConnectionParams) {
    super()
    this.peerSocket = socket

    // TODO probably the relay client should take care of this (checking if socket is ready, queuing
    // messages if not, etc.)
    const sendMessage: auth.SendFunction = message => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message))
      }
    }
    this.authConnection = new auth.Connection({ context, sendMessage, peerUserName })

    // listen for incoming messages and pass them to the auth connection
    socket.addEventListener('message', ({ data: message }) => {
      this.authConnection.deliver(JSON.parse(message))
    })

    // if the remote peer closes the connection, close up here as well
    socket.addEventListener('close', () => this.disconnect())

    // pass through events from the auth connection
    pipeEvents(this.authConnection, this, ['connected', 'joined', 'disconnected', 'change'])

    // start the connection with any stored messages
    this.authConnection.start(storedMessages)
  }

  public disconnect() {
    this.peerSocket.close()
    this.authConnection.stop()
  }

  get team() {
    return this.authConnection.team
  }

  get state() {
    return this.authConnection.state
  }
}

const pipeEvents = (source: EventEmitter, target: EventEmitter, events: string[]) =>
  events.forEach(event => source.on(event, payload => target.emit(event, payload)))

type ConnectionParams = {
  socket: WebSocket
  context: auth.InitialContext
  peerUserName: string
  storedMessages?: string[]
}
