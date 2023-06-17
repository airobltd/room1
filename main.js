const WebSocket = require('ws');
const url = require('url');

// Crea un server WebSocket
const server = new WebSocket.Server({ noServer: true });

// Oggetto per tenere traccia delle stanze e dei relativi client
const rooms = {};

// Gestisci la connessione WebSocket
server.on('connection', (socket, req) => {
  const query = url.parse(req.url, true).query;
  const room = query.room || 'default'; // Imposta una stanza predefinita se non viene fornito il parametro "room" nell'URL

  // Crea la stanza se non esiste
  if (!rooms[room]) {
    rooms[room] = new Set();
  }

  // Aggiungi il client alla stanza
  rooms[room].add(socket);

  // Gestisci i messaggi in arrivo
  socket.on('message', (message) => {
    // Invia il messaggio a tutti i client nella stanza
    rooms[room].forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  // Gestisci la chiusura della connessione
  socket.on('close', () => {
    // Rimuovi il client dalla stanza
    rooms[room].delete(socket);

    // Se la stanza è vuota, rimuovila
    if (rooms[room].size === 0) {
      delete rooms[room];
    }
  });
});

// Crea un server HTTP per gestire le richieste iniziali
const http = require('http');
const httpServer = http.createServer();

httpServer.on('upgrade', (req, socket, head) => {
  server.handleUpgrade(req, socket, head, (ws) => {
    server.emit('connection', ws, req);
  });
});

// Avvia il server HTTP
const port = 3000; // Puoi modificare la porta a tua scelta
httpServer.listen(port, () => {
  console.log(`Server WebSocket avviato sulla porta ${port}`);
});
