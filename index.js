var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var wx;

function forkWeatherDataGatheringProcess() {
  var host = process.env.WX_HOST;
  var port = process.env.WX_PORT;
  console.log('forkWeatherDataGatheringProcess host=' + host + ' port=' + port);
  require('child_process').fork('./station.js', [host, port])
  .on('exit', function(code, signal) {
    console.log('weatherDataGatheringProcess exit ' + code + ' ' + signal);
    setTimeout(forkWeatherDataGatheringProcess, 1000);
  })
  .on('message', function(msg) {
    if (msg) {
      wx = msg;
      wx.instant = new Date().getTime();
      console.log('update received ' + new Date(wx.instant).toISOString());
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
    socket.volatile.emit('wx', wx);
  }
});

server.listen(8080, 'localhost');
forkWeatherDataGatheringProcess();

