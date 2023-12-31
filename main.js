const http = require("http");
const https = require('https');
const express = require("express");
const url = require('url');
const app = express();

app.use(express.static("public"));
// require("dotenv").config();

const serverPort = process.env.PORT || 3000;
const server = http.createServer(app);
const WebSocket = require("ws");


function sendMessageToServer(messageJson, callback) {
  const https = require('https');

  const postData = JSON.stringify(messageJson);

  const options = {
    hostname: 'api.sibot.dev',
    path: '/test/index.php',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        callback(null, data);  // Passa il risultato alla callback
      } else {
        callback('Errore durante la richiesta: ' + res.statusCode + ' ' + res.statusMessage, null);
      }
    });
  });

  req.on('error', (error) => {
    callback('Errore: ' + error.message, null);
  });

  req.write(postData);
  req.end();
}





let keepAliveId;

const wss =
  process.env.NODE_ENV === "production"
    ? new WebSocket.Server({ server })
    : new WebSocket.Server({ port: 5001 });

server.listen(serverPort);
console.log('Server started on port ${serverPort} in stage ${process.env.NODE_ENV}');

const rooms = {};

wss.on("connection", function (ws, req) {

  const query = url.parse(req.url, true).query;
  const room = query.room || 'default'; // Imposta una stanza predefinita se non viene fornito il parametro "room" nell'URL

  // Crea la stanza se non esiste
  if (!rooms[room]) {
    rooms[room] = new Set();
  }

  // Aggiungi il client alla stanza
  rooms[room].add(ws);


  
  console.log("Connection Opened");
  console.log("Client size: ", wss.clients.size);

  if (wss.clients.size === 1) {
    console.log("first connection. starting keepalive");
    keepServerAlive();
  }

  ws.on("message", (data) => {
    let stringifiedData = data.toString();
    if (stringifiedData === 'pong') {
      console.log('keepAlive');
      return;
    }
    broadcast(ws, stringifiedData, false, room);
  });

  ws.on("close", (data) => {
    console.log("closing connection");

    // Se la stanza è vuota, rimuovila
    if (rooms[room].size === 0) {
      delete rooms[room];
    }

    if (wss.clients.size === 0) {
      console.log("last client disconnected, stopping keepAlive interval");
      clearInterval(keepAliveId);
    }
  });
});





// Implement broadcast function because of ws doesn't have it
const broadcast = (ws, message, includeSelf, room) => {
  // First, send message to the server
  sendMessageToServer(message, (error, response) => {
    if (error) {
      console.error('Errore:', error);
      return;
    }

    console.log('Risposta:', response);

    // Then, loop through the clients and send the response
    rooms[room].forEach((client) => {
      if (client.readyState === WebSocket.OPEN && 
          (includeSelf || client !== ws)) {  // Use conditions to determine if the message should be sent
        client.send(response);
      }
    });
  });
}


/**
 * Sends a ping message to all connected clients every 50 seconds
 */
 const keepServerAlive = () => {
  keepAliveId = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send('ping');
      }
    });
  }, 50000);
};

// Aggiungi un endpoint per ottenere l'elenco delle stanze aperte
server.on('request', (req, res) => {
  if (req.url === '/rooms') {
    //const rooms = server.getRooms();
    //res.setHeader('Content-Type', 'application/json');
    //res.end(JSON.stringify(rooms));
  }
});

app.get('/rooms', (req, res) => {
   const roomList = Object.keys(rooms);
  res.json(roomList);
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});
