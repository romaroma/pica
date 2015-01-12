'use strict';

var blur = require('../../../lib/pure/blur');

exports.run = function(data) {
  var b;
  b = new Uint8Array(data.buffer.length);
  b.set(data.buffer);

  blur(b, data.width, data.height, 5);
  return b;
};
