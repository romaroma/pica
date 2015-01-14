// Unsharp mask filter
//
// http://stackoverflow.com/a/23322820/1031804
// USM(O) = O + (2 * (Amount / 100) * (O - GB))
// GB - gaussial blur.
//
// brightness = 0.299*R + 0.587*G + 0.114*B
// http://stackoverflow.com/a/596243/1031804
//
// To simplify math, normalize brighness mutipliers to 2^16:
//
// brightness = (19595*R + 38470*G + 7471*B) / 65536

'use strict';


var blur = require('./blur');


function clampTo8(i) { return i < 0 ? 0 : (i > 255 ? 255 : i); }

// Extract value (HSV) layer from RGB image
//
function getValueLayer(src, srcW, srcH) {
  var size = srcW * srcH;
  var value = new Uint16Array(size);
  var i, max, ptr = 0;
  var r, g, b;

  for (i = 0; i < size; i++) {
    r = src[ptr];
    g = src[ptr + 1];
    b = src[ptr + 2];

    max = Math.max(r, Math.max(g, b));

    value[i] = max;
    ptr += 4;
  }

  return value;
}

// Apply new value (HSV) layer to RGB image
//
function applyValueLayer(src, value, srcW, srcH) {
  var size = srcW * srcH;
  var max, min, d;
  var i, r, g, b, h, s, v, ptr = 0;
  var k1 = 255 << 4;
  var k2 = 256 << 4;
  var k3 = 1 << 3;
  var hk2, x, m, d6, h6;

  for (i = 0; i < size; i++) {
    r = src[ptr];
    g = src[ptr + 1];
    b = src[ptr + 2];

    max = Math.max(r, Math.max(g, b)) | 0;

    // if current point was highlighted then update its RGB representation
    if (max !== value[i]) {
      /*eslint-disable curly*/
      min = Math.min(r, Math.min(g, b)) | 0;

      h = 0;
      d = max - min;
      v = value[i] << 4;

      if (v === 0) s = 0; else s = (k1 * d) / max | 0;

      if (s === 0) {
        h = 0;
      } else {
        d6 = 6 * d;
        if (r === max) {
          h = (k2 * (d6 + g - b)) / d6 | 0;
          if (h >= k2) h -= k2;
        } else if (g === max) {
          h = (k2 * (2 * d + b - r)) / d6 | 0;
        } else h = (k2 * (4 * d + r - g)) / d6 | 0;
      }

      // now back to rgb
      m = (v * (k1 - s)) / k1 | 0;

      if (s === 0) {
        r = g = b = (v >> 4);
      } else {
        h6 = 6 * h;
        hk2 = h6 / k2 | 0;
        x = ((v * s) / k2 | 0) * (k2 - Math.abs(h6 - 2 * (hk2 >> 1) * k2 - k2));
        x = ((x + v * (k1 - s)) / k1 + k3) >> 4;
        m = m >> 4;
        v = v >> 4;

        switch (hk2) {
          case 0: r = v; g = x; b = m; break;
          case 1: r = x; g = v; b = m; break;
          case 2: r = m; g = v; b = x; break;
          case 3: r = m; g = x; b = v; break;
          case 4: r = x; g = m; b = v; break;
          case 5: r = v; g = m; b = x; break;
        }
      }

      src[ptr] = r;
      src[ptr + 1] = g;
      src[ptr + 2] = b;

    }

    ptr += 4;
  }

  return src;
}

// Apply unsharp mask to src
//
// NOTE: radius is ignored to simplify gaussian blur calculation
// on practice we need radius 0.3..2.0. Use 1.0 now.
//
function unsharp(src, srcW, srcH, amount, radius, threshold) {
  var diff, srcPtr, size = srcW * srcH,
      amount2 = amount / 5 * 0.016;

  // get value layer from HSV
  var value = getValueLayer(src, srcW, srcH);
  // blur value layer
  var blured = blur(value, srcW, srcH, radius, 1);

  // highlight edges in v layer with unsharp masking
  for (srcPtr = 0; srcPtr < size; srcPtr++) {
    diff = value[srcPtr] - blured[srcPtr];

    if (Math.abs(diff) > threshold) {
      value[srcPtr] = clampTo8(Math.floor(value[srcPtr] + diff * amount2));
    }
  }

  // apply the updated value layer to the image
  src = applyValueLayer(src, value, srcW, srcH);
}


module.exports = unsharp;
