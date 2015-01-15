// Blur filter
//

'use strict';

var idiv = new Uint16Array(51);
for (var d = 1; d < idiv.length; d++) { idiv[d] = (1 << 11) / d; }


function blur(src, srcW, srcH, radius, iterations) {
  var i,
      output = new Uint16Array(src.length);

  // box blur is made by two passes of motion blur algorithm
  for (i = 0; i < iterations; i++) {
    output = blurMatrix(src, srcW, srcH, radius);
    src = blurMatrix(output, srcH, srcW, radius);
  }

  return src;
}

// Motion blur of a matrix, the result is a transponded
// matrix to be used for another pass
//
function blurMatrix(src, srcW, srcH, radius) {
  var x, y, i, sum, num,
      rowPtr,
      output = new Uint16Array(src.length);

  // make horizontal motion blur for each row
  for (y = 0; y < srcH; y++) {
    rowPtr = y * srcW;
    // calculate the sum for the first time
    sum = 0;
    num = radius + 1;
    for (i = 0; i < radius; i++) {
      sum += src[rowPtr + i];
    }

    rowPtr += radius;
    for (x = 0; x < srcW; x++, rowPtr++) {
      // add one more item to the sum
      if (x < srcW - radius) {
        sum += src[rowPtr];
        num++;
      }
      // and remove one
      if (x > radius) {
        sum -= src[rowPtr - (radius << 1) - 1];
        num--;
      }

      output[x * srcH + y] = (sum * idiv[num - 1]) >> 11;
    }
  }

  return output;
}

module.exports = blur;
