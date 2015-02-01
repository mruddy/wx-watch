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
// according to the spec: "The LOOP2 packet is NOT supported in Vantage Pro and only supported in Vantage Pro2 (Firmware 1.90 or later) and Vantage Vue."
var destHost = process.argv[2];
var destPort = process.argv[3];
var consecutiveWakeups = 0;

var closeSocket = function() {
  if (socket) {
    socket.destroy();
    socket = null;
  }
};

var wakeup = function() {
  if (socket) {
    socket.write('\n'); // try to awaken the console
    socket.setTimeout(1200); // give it 1.2 seconds to respond
    consecutiveWakeups++;
    if (consecutiveWakeups > 3) {
      closeSocket();
    }
  }
};

console.log(new Date().toISOString() + ', station process created, destHost=' + destHost + ', destPort=' + destPort);

var socket = require('net').connect({ port: destPort, host: destHost} , function() {
  wakeup();
}).on('timeout', function() {
  wakeup();
}).on('data', function(buf) {
  consecutiveWakeups = 0;
  if (buf && (2 === buf.length) && (0xa === buf[0]) && (0xd === buf[1])) {
    socket.write('LPS 2 1\n'); // request sensor data from the weather station
  } else if (buf && (100 === buf.length) && (0x06 === buf[0]) && (0x4c === buf[1]) && (0x4f === buf[2]) && (0x4f === buf[3]) && (0x01 === buf[5]) && (0x7fff === buf.readUInt16LE(6))) {
    // this is a LOOP2 response. 0x6 is the ack byte.
    var wx = {
      ot: buf.readUInt16LE(13) / 10, // outside temperature in 1/10 degree F
      ws: buf.readUInt8(15), // wind speed in MPH
      wd: buf.readUInt16LE(17), // wind direction in degrees
      wgs: buf.readUInt16LE(23), // 10-min wind gust speed in MPH
      wgd: buf.readUInt16LE(25), // 10-min wind gust direction in degrees
      oh: buf.readUInt8(34), // outside humidity
      instant: new Date().getTime()
    };
    process.send(wx);
    socket.setTimeout(2000); // basically, wait until the next polling interval
  }
}).on('error', function(err) {
  console.log(new Date().toISOString() + ', socket error, err=' + err + ', code=' + err.code);
});

