package expo.modules.blurdetector

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.net.Uri
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream

class ExpoBlurDetectorModule : Module() {
  private var pendingScanPromise: Promise? = null
  private val SCANNER_REQUEST_CODE = 4281

  override fun definition() = ModuleDefinition {
    Name("ExpoBlurDetector")

    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode == SCANNER_REQUEST_CODE) {
        val p = pendingScanPromise
        pendingScanPromise = null
        if (p == null) return@OnActivityResult

        try {
          if (resultCode == Activity.RESULT_OK && data != null) {
            val docResult = GmsDocumentScanningResult.fromActivityResultIntent(data)
            val pages = docResult?.pages
            val uris = mutableListOf<String>()
            if (pages != null) {
              for (page in pages) {
                uris.add(page.imageUri.toString())
              }
            }
            p.resolve(mapOf(
              "status" to "success",
              "scannedImages" to uris
            ))
          } else {
            p.resolve(mapOf(
              "status" to "cancel",
              "scannedImages" to emptyList<String>()
            ))
          }
        } catch (e: Exception) {
          android.util.Log.e("ExpoBlurDetector", "Error handling scanner result: ${e.message}", e)
          p.resolve(mapOf(
            "status" to "cancel",
            "scannedImages" to emptyList<String>()
          ))
        }
      }
    }

    AsyncFunction("getBlurScore") { uriString: String ->
      getBlurScoreImpl(uriString)
    }

    AsyncFunction("sharpenImage") { uriString: String ->
      enhanceDocumentImpl(uriString)
    }

    AsyncFunction("scanDocument") { options: Map<String, Any?>?, promise: Promise ->
      scanDocumentImpl(options, promise)
    }
  }

  private fun scanDocumentImpl(options: Map<String, Any?>?, promise: Promise) {
    val currentActivity = appContext.currentActivity

    if (currentActivity == null) {
      promise.reject("ERR_NO_ACTIVITY", "Current activity is null", null)
      return
    }

    pendingScanPromise = promise

    try {
      val maxNum = (options?.get("maxNumDocuments") as? Number)?.toInt() ?: 1
      val galleryAllowed = options?.get("galleryImportAllowed") as? Boolean ?: false
      val modeStr = (options?.get("mode") as? String) ?: "full"

      val scannerOptionsBuilder = GmsDocumentScannerOptions.Builder()
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setPageLimit(maxNum)
        .setGalleryImportAllowed(galleryAllowed)

      when (modeStr) {
        "base" -> scannerOptionsBuilder.setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_BASE)
        "filter" -> scannerOptionsBuilder.setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_BASE_WITH_FILTER)
        else -> scannerOptionsBuilder.setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
      }

      val scanner = GmsDocumentScanning.getClient(scannerOptionsBuilder.build())

      scanner.getStartScanIntent(currentActivity)
        .addOnSuccessListener(currentActivity) { intentSender ->
          currentActivity.runOnUiThread {
            try {
              currentActivity.startIntentSenderForResult(
                intentSender,
                SCANNER_REQUEST_CODE,
                null,
                0,
                0,
                0
              )
            } catch (launchErr: Exception) {
              pendingScanPromise = null
              promise.reject("ERR_LAUNCH_FAILED", launchErr.message, launchErr)
            }
          }
        }
        .addOnFailureListener(currentActivity) { error ->
          pendingScanPromise = null
          promise.reject("ERR_SCAN_INTENT", error.message, error)
        }
    } catch (e: Exception) {
      pendingScanPromise = null
      promise.reject("ERR_SETUP_FAILED", e.message, e)
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
