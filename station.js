// The MIT License (MIT)
//
// Copyright (c) 2015 mruddy
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

// this code is designed to communicate with a Davis Wireless Vantage Pro2 (Part #: 06152) or Davis Vantage VUE (Part #: 06357) via a Davis WeatherLinkIP for Vantage Stations (Part #: 06555)
// protocol specification: http://www.davisnet.com/support/weather/download/VantageSerialProtocolDocs_v261.pdf
var destHost = process.argv[2];
var destPort = process.argv[3];
var wakeupCount = 0;
var state = 'start';
var socket = undefined;

var closeSocket = function() {
  if (socket) {
    socket.destroy();
    socket = undefined;
  }
};

var start = function() {
  closeSocket();
  wakeupCount = 0;
  state = 'start';
  socket = require('net').connect({ port: destPort, host: destHost} , function() {
    wakeup();
  });
  socket.on('data', function(data) {
    if ('connected' === state && data && (2 === data.length) && (0xa === data[0]) && (0xd === data[1])) {
        state = 'awake';
        wakeupCount = 0;
        socket.write('LPS 2 1\n'); // request sensor data from the weather station
    } else if (state === 'awake') {
      if (data && (100 === data.length) && (0x06 === data[0]) && (0x4c === data[1]) && (0x4f === data[2]) && (0x4f === data[3]) && (0x01 === data[5]) && (0xff === data[6]) && (0x7f === data[7])) { // this is a LOOP2 response. 0x6 is the ack byte.
        var outsideTemp = ((data[14] << 8) | data[13]) / 10;
        var speed = data[15];
        var windDirection = (data[18] << 8) | data[17];
        var wx = {outsideTemperature: outsideTemp, windSpeed: speed, windDirectionDegrees: windDirection, instant: new Date().getTime()};
        process.send(wx);
        // console.log(wx);
        wakeupCount = 0;
        setTimeout(wakeup, 2000);
      } else {
        wakeup();
      }
    }
  });
  socket.on('timeout', function() {
    if ('connected' === state) {
      wakeup();
    }
  });
  socket.on('error', function(err) {
    console.log('got error ' + err);
  });
  socket.on('close', function(err) {
    console.log('got close ' + err);
  });
};

var wakeup = function() {
  state = 'connected';
  socket.write('\n'); // try to awaken the console
  socket.setTimeout(1200);
  if (++wakeupCount > 3) {
    closeSocket();
    setTimeout(start, 2000);
  }
};

console.log(new Date().toISOString() + ',station process created,destHost=' + destHost + ',destPort=' + destPort);
start();

