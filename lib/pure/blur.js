// Blur filter
//

'use strict';


var _blurKernel = new Uint8Array([
  1, 2, 1,
  2, 4, 2,
  1, 2, 1
]);

var _bkWidth = Math.floor(Math.sqrt(_blurKernel.length));
var _bkHalf = Math.floor(_bkWidth / 2);
var _bkWsum = 0;
for (var wc = 0; wc < _blurKernel.length; wc++) { _bkWsum += _blurKernel[wc]; }


function blurPoint(gs, x, y, srcW, srcH) {
  var bx, by, sx, sy, w, wsum, br;
  var bPtr = 0;
  var blurKernel = _blurKernel;
  var bkHalf = _bkHalf;

  wsum = 0; // weight sum to normalize result
  br   = 0;

  if (x >= bkHalf && y >= bkHalf && x + bkHalf < srcW && y + bkHalf < srcH) {
    for (by = 0; by < 3; by++) {
      for (bx = 0; bx < 3; bx++) {
        sx = x + bx - bkHalf;
        sy = y + by - bkHalf;

        br += gs[sx + sy * srcW] * blurKernel[bPtr++];
      }
    }
    return (br - (br % _bkWsum)) / _bkWsum;
  }

  for (by = 0; by < 3; by++) {
    for (bx = 0; bx < 3; bx++) {
      sx = x + bx - bkHalf;
      sy = y + by - bkHalf;

      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        w = blurKernel[bPtr];
        wsum += w;
        br += gs[sx + sy * srcW] * w;
      }
      bPtr++;
    }
  }
  /*eslint-disable space-infix-ops*/
  return ((br - (br % wsum)) / wsum)|0;
}

function blur(src, srcW, srcH, radius) {
  var x, y, i, sum, num,
      rowPtr,
      output = new Uint16Array(src.length);

  // make horizontal motion blur for each row
  for (y = 0; y < srcH; y++) {
    rowPtr = y * srcW;
    for (x = 0; x < srcW; x++) {
      // calculate kernel
      sum = num = 0;
      for (i = x - radius; i <= x + radius; i++) {
        if (i >= 0 && i < srcW) {
          sum+= src[rowPtr + i];
          num++;
        }
      }
      output[rowPtr + x] = sum / num;
    }
  }
  // similar vertical motion blur
  for (x = 0; x < srcW; x++) {
    for (y = 0; y < srcH; y++) {
      // calculate kernel
      sum = num = 0;
      for (i = y - radius; i <= y + radius; i++) {
        if (i >= 0 && i < srcH) {
          sum+= output[i * srcW + x];
          num++;
        }
      }
      output[y * srcW + x] = sum / num;
    }
  }

  return output;
}

module.exports = blur;
