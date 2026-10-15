package expo.modules.blurdetector

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream

class ExpoBlurDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoBlurDetector")

    AsyncFunction("getBlurScore") { uriString: String ->
      getBlurScoreImpl(uriString)
    }

    AsyncFunction("sharpenImage") { uriString: String ->
      enhanceDocumentImpl(uriString)
    }
  }

  private fun enhanceDocumentImpl(uriString: String): String {
    return try {
      val uri = Uri.parse(uriString)
      val context = appContext.reactContext ?: return uriString

      val inputStream: InputStream? = if (uri.scheme == "file") {
        val path = uri.path ?: uriString.removePrefix("file://")
        FileInputStream(File(path))
      } else {
        context.contentResolver.openInputStream(uri)
      } ?: return uriString

      val originalBitmap = inputStream.use { stream ->
        BitmapFactory.decodeStream(stream)
      } ?: return uriString

      // Create enhanced bitmap with contrast stretch to make text crisp and black
      val enhancedBitmap = Bitmap.createBitmap(
        originalBitmap.width,
        originalBitmap.height,
        Bitmap.Config.ARGB_8888
      )

      val canvas = Canvas(enhancedBitmap)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG)

      // Contrast: 1.35x, Brightness offset: -15
      val contrast = 1.35f
      val brightness = -15f
      val colorMatrix = ColorMatrix(floatArrayOf(
        contrast, 0f, 0f, 0f, brightness,
        0f, contrast, 0f, 0f, brightness,
        0f, 0f, contrast, 0f, brightness,
        0f, 0f, 0f, 1f, 0f
      ))

      paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
      canvas.drawBitmap(originalBitmap, 0f, 0f, paint)
      originalBitmap.recycle()

      val outputFile = File(context.cacheDir, "enhanced_${System.currentTimeMillis()}.jpg")
      FileOutputStream(outputFile).use { out ->
        enhancedBitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
      }
      enhancedBitmap.recycle()

      Uri.fromFile(outputFile).toString()
    } catch (e: Exception) {
      android.util.Log.e("ExpoBlurDetector", "Error enhancing document image: ${e.message}", e)
      uriString
    }
  }

  private fun getBlurScoreImpl(uriString: String): Double {
      return try {
          val uri = Uri.parse(uriString)
          val context = appContext.reactContext ?: return 0.0
          
          val inputStream: InputStream? = if (uri.scheme == "file") {
              val path = uri.path ?: uriString.removePrefix("file://")
              FileInputStream(File(path))
          } else {
              context.contentResolver.openInputStream(uri)
          }

          if (inputStream == null) return 0.0

          // Decode with inSampleSize to downscale and speed up processing
          val options = BitmapFactory.Options()
          options.inSampleSize = 4 // Downscale by 4x for speed
          val bitmap = inputStream.use { stream ->
              BitmapFactory.decodeStream(stream, null, options)
          } ?: return 0.0

          val width = bitmap.width
          val height = bitmap.height
          val pixels = IntArray(width * height)
          bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

          // Convert to grayscale (luminance)
          val grayPixels = DoubleArray(width * height)
          for (i in pixels.indices) {
              val p = pixels[i]
              val r = Color.red(p)
              val g = Color.green(p)
              val b = Color.blue(p)
              grayPixels[i] = (r * 0.299 + g * 0.587 + b * 0.114)
          }
          bitmap.recycle() // free memory early

          // 3x3 Laplacian filter
          // [ 0,  1,  0 ]
          // [ 1, -4,  1 ]
          // [ 0,  1,  0 ]
          val laplacian = DoubleArray(width * height)
          var sum = 0.0
          var count = 0
          
          for (y in 1 until height - 1) {
              for (x in 1 until width - 1) {
                  val i = y * width + x
                  val value = grayPixels[i - width] + 
                              grayPixels[i - 1] - (4.0 * grayPixels[i]) + 
                              grayPixels[i + 1] + 
                              grayPixels[i + width]
                  laplacian[i] = value
                  sum += value
                  count++
              }
          }
          
          if (count == 0) return 0.0

          val mean = sum / count
          var varianceSum = 0.0
          for (y in 1 until height - 1) {
              for (x in 1 until width - 1) {
                  val i = y * width + x
                  val diff = laplacian[i] - mean
                  varianceSum += diff * diff
              }
          }
          
          varianceSum / count
      } catch (e: Exception) {
          android.util.Log.e("ExpoBlurDetector", "Error calculating blur score: ${e.message}", e)
          0.0
      }
  }
}
