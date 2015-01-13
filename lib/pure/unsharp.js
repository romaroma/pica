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
  var i, r, g, b, h, s, v, intH, modH, f, p, q, t, ptr = 0;

  for (i = 0; i < size; i++) {
    r = src[ptr];
    g = src[ptr + 1];
    b = src[ptr + 2];

    max = Math.max(r, Math.max(g, b));

    // if current point was highlighted then update its RGB representation
    if (max !== value[i]) {
      /*eslint-disable curly*/
      if (r > 0) r = r / 255;
      if (g > 0) g = g / 255;
      if (b > 0) b = b / 255;

      max = Math.max(r, Math.max(g, b));
      min = Math.min(r, Math.min(g, b));

      h = s = max;
      d = max - min;
      v = value[i] / 255;

      if (max > 0) s = d / max;

      if (max === min) {
        h = 0;
      } else {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
      }

      intH = Math.floor(h);
      f = h - intH;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      modH = intH % 6;
      r = [ v, q, p, p, t, v ][modH];
      g = [ t, v, v, q, p, p ][modH];
      b = [ p, p, t, v, v, q ][modH];

      src[ptr] = r * 255;
      src[ptr + 1] = g * 255;
      src[ptr + 2] = b * 255;
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
  var diff, srcPtr, size = srcW * srcH;

  // get value layer from HSV
  var value = getValueLayer(src, srcW, srcH);
  // blur value layer
  var blured = blur(value, srcW, srcH, radius, 1);

  // highlight edges in v layer with unsharp masking
  for (srcPtr = 0; srcPtr < size; srcPtr++) {
    diff = value[srcPtr] - blured[srcPtr];

    if (Math.abs(diff) > threshold) {
      value[srcPtr] = clampTo8(value[srcPtr] + Math.floor(diff * amount / 500));
    }
  }

  // apply the updated value layer to the image
  src = applyValueLayer(src, value, srcW, srcH);
}


module.exports = unsharp;
