// backend/src/websocket-service.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

export class WebSocketService {
  private wss: WebSocketServer;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server });
    this.initialize();
    console.log("WebSocketService initialized and attached to HTTP server.");
  }

  private initialize() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('A new client connected to the WebSocket.');

      // Send a welcome message
      ws.send(JSON.stringify({ type: 'log', message: 'Connection established. Ready to receive live updates.' }));

      ws.on('close', () => {
        console.log('Client disconnected.');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  /**
   * Sends a structured message to all connected clients.
   * @param messageObject The data to send, which will be stringified to JSON.
   */
  public broadcast(messageObject: object) {
    if (this.wss.clients.size === 0) {
      console.log("Broadcast attempted, but no clients are connected.");
      return;
    }
    
    const message = JSON.stringify(messageObject);
    console.log(`Broadcasting message to ${this.wss.clients.size} client(s):`, message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}