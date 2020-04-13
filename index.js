// The MIT License (MIT)
//
// Copyright (c) 2015-2020 mruddy
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

const app = require('express')();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
var wx = null;

const forkStationProcess = function() {
  const host = process.env.WX_HOST;
  const port = process.env.WX_PORT;
  console.log(new Date().toISOString() + ', forking station process, host=' + host + ', port=' + port);
  require('child_process').fork('./station.js', [host, port])
  .on('exit', function(code, signal) {
    console.log(new Date().toISOString() + ', station process exit, exit=' + code + ', signal=' + signal);
    setTimeout(forkStationProcess, 1000);
  })
  .on('message', function(msg) {
    if (msg && msg.instant) {
      wx = msg;
      console.log(new Date().toISOString() + ', update received, instant=' + new Date(wx.instant).toISOString());
      // tell all of the connected clients about the update
      Object.keys(io.sockets.connected).forEach(function(socketIndex, arrIndex, arr) {
        io.sockets.connected[socketIndex].volatile.emit('wx', wx);
      });
    }
  });
}

io.on('connection', function(socket) {
  // always give the client the latest data on connect
  if (wx) {
    socket.emit('wx', wx);
  }
});

server.listen(8080, process.argv[2]);
forkStationProcess();

