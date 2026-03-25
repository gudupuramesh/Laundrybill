package `in`.laundrybill

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.os.Message
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import com.google.android.material.snackbar.Snackbar
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.URISyntaxException
import java.text.SimpleDateFormat
import java.util.Date

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var popupDialog: Dialog? = null
    private var fcmToken: String? = null
    
    // Google Sign In
    private lateinit var googleSignInClient: GoogleSignInClient
    private val WEB_CLIENT_ID = "285945951840-91cmr666jkghgdd234p0h2607gphr2g7.apps.googleusercontent.com"
    
    // For handling file uploads
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var photoURI: Uri? = null
    
    // For handling location
    private var locationCallback: GeolocationPermissions.Callback? = null
    private var locationOrigin: String? = null
    
    // Network handling
    private lateinit var connectivityManager: ConnectivityManager
    private lateinit var networkCallback: ConnectivityManager.NetworkCallback
    private var noInternetSnackbar: Snackbar? = null

    // Permissions
    private val requestLocationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true || 
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            locationCallback?.invoke(locationOrigin, true, false)
        } else {
            locationCallback?.invoke(locationOrigin, false, false)
        }
        locationCallback = null
        locationOrigin = null
    }

    private val requestCameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Permission granted for Camera usage (e.g. WebRTC)
            webView.reload() 
        } else {
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = null
        }
    }

    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            // Gallery returns URI in data, camera uses the pre-set photoURI
            val uri = result.data?.data ?: photoURI
            if (uri != null) {
                fileUploadCallback?.onReceiveValue(arrayOf(uri))
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
        } else {
            fileUploadCallback?.onReceiveValue(null)
        }
        fileUploadCallback = null
    }
    
    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { isGranted: Boolean ->
        // FCM SDK (and your app) can post notifications.
    }
    
    // Google Sign In Result Launcher
    private val googleSignInLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            handleSignInResult(task)
        } else {
            Log.e(TAG, "Google Sign In Failed: Result Code ${result.resultCode}")
            if (result.resultCode != 0) { 
                 handleGoogleLoginError("Sign in failed with code ${result.resultCode}")
            }
        }
    }
    
    private fun handleSignInResult(completedTask: Task<GoogleSignInAccount>) {
        try {
            val account = completedTask.getResult(ApiException::class.java)
            val idToken = account.idToken
            Log.d(TAG, "Google ID Token retrieved successfully")
            
            if (idToken != null) {
                webView.post {
                    Log.d(TAG, "Injecting token into JavaScript: onGoogleLoginSuccess")
                    Toast.makeText(this, "Logged in! Sending token to web...", Toast.LENGTH_SHORT).show()
                    
                    val jsCode = """
                        javascript:(function() {
                            window.androidGoogleToken = '$idToken'; 
                            try {
                                if (typeof onGoogleLoginSuccess === 'function') {
                                    onGoogleLoginSuccess('$idToken');
                                } else {
                                    console.log('onGoogleLoginSuccess missing, token saved to window.androidGoogleToken');
                                    window.dispatchEvent(new CustomEvent('android-google-login', { detail: '$idToken' }));
                                }
                            } catch(e) {
                                console.error(e);
                            }
                        })()
                    """.trimIndent()
                    webView.evaluateJavascript(jsCode, null)
                }
            } else {
                handleGoogleLoginError("ID Token is null")
            }
        } catch (e: ApiException) {
            Log.w(TAG, "signInResult:failed code=" + e.statusCode)
            handleGoogleLoginError("Sign in failed: ${e.statusCode}")
        }
    }
    
    private fun handleGoogleLoginError(error: String) {
        runOnUiThread {
            Toast.makeText(this, "Google Login Error: $error", Toast.LENGTH_LONG).show()
        }
        webView.post {
            val jsCode = "javascript:if(typeof onGoogleLoginFailure === 'function'){onGoogleLoginFailure('$error');}"
            webView.evaluateJavascript(jsCode, null)
        }
    }
    
    // Javascript Interface
    class WebAppInterface(
        private val mContext: Context, 
        private val mWebView: WebView,
        private val autoPrint: Boolean = false
    ) {
        @JavascriptInterface
        fun print() {
            (mContext as? AppCompatActivity)?.runOnUiThread {
                createWebPrintJob(mWebView)
            }
        }

        @JavascriptInterface
        fun downloadBlob(base64Data: String, mimeType: String) {
            (mContext as? MainActivity)?.saveBlobFile(base64Data, mimeType, autoPrint)
        }
        
        @JavascriptInterface
        fun googleLogin() {
            Log.d(TAG, "Native Google Login requested from JS")
            (mContext as? MainActivity)?.runOnUiThread {
                (mContext as? MainActivity)?.startGoogleSignIn()
            }
        }
        
        private fun createWebPrintJob(webView: WebView) {
            val printManager = mContext.getSystemService(Context.PRINT_SERVICE) as? PrintManager
            val printAdapter = webView.createPrintDocumentAdapter("LaundryBill Document")
            val jobName = "LaundryBill Print Job " + System.currentTimeMillis()
            
            printManager?.print(
                jobName,
                printAdapter,
                PrintAttributes.Builder().build()
            )
        }
    }

    fun startGoogleSignIn() {
        googleSignInClient.signOut().addOnCompleteListener {
            val signInIntent = googleSignInClient.signInIntent
            googleSignInLauncher.launch(signInIntent)
        }
    }

    fun saveBlobFile(base64Data: String, mimeType: String, shouldPrint: Boolean) {
        try {
            val cleanBase64 = base64Data.replaceFirst("^data:$mimeType;base64,".toRegex(), "")
            val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "bin"
            
            val fileName = "LaundryBill_Receipt_${System.currentTimeMillis()}.$extension"

            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }

            val resolver = contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)

            if (uri != null) {
                resolver.openOutputStream(uri).use { outputStream ->
                    outputStream?.write(decodedBytes)
                }

                runOnUiThread {
                    popupDialog?.dismiss()
                    popupDialog = null
                    
                    val isPdf = mimeType.contains("pdf", ignoreCase = true)
                    val looksLikeReceipt = fileName.contains("Receipt", ignoreCase = true)
                    
                    if ((shouldPrint || looksLikeReceipt) && isPdf) {
                        Toast.makeText(this, "Printing Receipt...", Toast.LENGTH_SHORT).show()
                        printPdf(uri)
                    } else {
                        val snackbar = Snackbar.make(findViewById(android.R.id.content), "Receipt downloaded", Snackbar.LENGTH_LONG)
                        snackbar.setAction("OPEN") {
                             val intent = Intent(Intent.ACTION_VIEW)
                             intent.setDataAndType(uri, mimeType)
                             intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                             try {
                                 startActivity(intent)
                             } catch (e: Exception) {
                                 Toast.makeText(this, "File saved to Downloads", Toast.LENGTH_SHORT).show()
                             }
                        }
                        snackbar.setAction("PRINT") {
                            printPdf(uri)
                        }
                        snackbar.show()
                    }
                }
            } else {
                runOnUiThread {
                    Toast.makeText(this, "Failed to create file", Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Blob save failed", e)
            runOnUiThread {
                Toast.makeText(this, "Failed to save file: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun printPdf(uri: Uri) {
        val printManager = getSystemService(Context.PRINT_SERVICE) as? PrintManager
        val jobName = "LaundryBill Receipt"

        printManager?.print(jobName, object : PrintDocumentAdapter() {
            override fun onLayout(
                oldAttributes: PrintAttributes?,
                newAttributes: PrintAttributes?,
                cancellationSignal: CancellationSignal?,
                callback: LayoutResultCallback?,
                extras: Bundle?
            ) {
                if (cancellationSignal?.isCanceled == true) {
                    callback?.onLayoutCancelled()
                    return
                }
                
                val info = PrintDocumentInfo.Builder(jobName)
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                    .build()
                
                callback?.onLayoutFinished(info, true)
            }

            override fun onWrite(
                pages: Array<PageRange>?,
                destination: ParcelFileDescriptor?,
                cancellationSignal: CancellationSignal?,
                callback: WriteResultCallback?
            ) {
                var input: InputStream? = null
                var output: OutputStream? = null
                try {
                    input = contentResolver.openInputStream(uri)
                    output = FileOutputStream(destination?.fileDescriptor)

                    val buf = ByteArray(1024)
                    var bytesRead: Int
                    while (input?.read(buf).also { bytesRead = it ?: -1 } != -1) {
                        output.write(buf, 0, bytesRead)
                    }

                    callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                } catch (e: Exception) {
                    Log.e(TAG, "Error printing PDF", e)
                    callback?.onWriteFailed(e.message)
                } finally {
                    try {
                        input?.close()
                        output?.close()
                    } catch (e: IOException) {
                        // ignore
                    }
                }
            }
        }, null)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        
        // FIXED: Improved Keyboard (IME) handling for edge-to-edge
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content)) { view, windowInsets ->
            val insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            
            WindowInsetsCompat.CONSUMED
        }

        askNotificationPermission()
        
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)
            .requestEmail()
            .build()
        googleSignInClient = GoogleSignIn.getClient(this, gso)
        
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener
            fcmToken = task.result
            Log.d(TAG, "FCM Token: $fcmToken")
            
            injectFcmToken(webView)
        }
        
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.setGeolocationEnabled(true)
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true
        settings.mediaPlaybackRequiresUserGesture = false 
        
        webView.addJavascriptInterface(WebAppInterface(this, webView, false), "Android")

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)
        
        val newUserAgent = settings.userAgentString.replace("wv", "")
        settings.userAgentString = newUserAgent

        webView.webViewClient = createWebViewClient(null)
        
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            handleDownload(webView, url, userAgent, contentDisposition, mimetype)
        }
        
        webView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(view: WebView?, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message?): Boolean {
                val newWebView = WebView(this@MainActivity)
                newWebView.settings.javaScriptEnabled = true
                newWebView.settings.domStorageEnabled = true
                newWebView.settings.setSupportZoom(true)
                newWebView.settings.builtInZoomControls = true
                newWebView.settings.setSupportMultipleWindows(true)
                newWebView.settings.javaScriptCanOpenWindowsAutomatically = true
                newWebView.settings.mediaPlaybackRequiresUserGesture = false
                
                newWebView.settings.userAgentString = settings.userAgentString
                
                newWebView.addJavascriptInterface(WebAppInterface(this@MainActivity, newWebView, true), "Android")
                
                val cookieManagerPopup = CookieManager.getInstance()
                cookieManagerPopup.setAcceptCookie(true)
                cookieManagerPopup.setAcceptThirdPartyCookies(newWebView, true)

                popupDialog = Dialog(this@MainActivity)
                popupDialog?.setContentView(newWebView)
                popupDialog?.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                popupDialog?.show()
                
                popupDialog?.setOnDismissListener {
                    newWebView.destroy()
                    popupDialog = null
                }

                newWebView.webChromeClient = object : WebChromeClient() {
                    override fun onCloseWindow(window: WebView?) {
                        popupDialog?.dismiss()
                    }
                    
                    override fun onPermissionRequest(request: PermissionRequest?) {
                         if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            runOnUiThread { request?.grant(request.resources) }
                        } else {
                             request?.deny() 
                        }
                    }
                }
                
                newWebView.webViewClient = createWebViewClient(popupDialog)
                
                newWebView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
                     handleDownload(newWebView, url, userAgent, contentDisposition, mimetype)
                }

                val transport = resultMsg?.obj as WebView.WebViewTransport
                transport.webView = newWebView
                resultMsg.sendToTarget()
                return true
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback?.invoke(origin, true, false)
                } else {
                    locationCallback = callback
                    locationOrigin = origin
                    requestLocationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (fileUploadCallback != null) {
                    fileUploadCallback?.onReceiveValue(null)
                }
                fileUploadCallback = filePathCallback

                if (fileChooserParams?.isCaptureEnabled == true) {
                    // "Take Photo" - launch camera
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        launchCamera()
                    } else {
                        requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                } else {
                    // "Upload from Gallery" - launch gallery picker
                    launchGalleryPicker()
                }
                return true
            }
            
            // Allow WebRTC Camera/Microphone requests
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    runOnUiThread { request?.grant(request.resources) }
                } else {
                    requestCameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                }
            }
        }
        
        setupNetworkMonitoring()
        
        webView.loadUrl("https://app.laundrybill.com/")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }
    
    private fun injectFcmToken(targetWebView: WebView?) {
        val token = fcmToken ?: return
        targetWebView?.post {
            val jsCode = """
                javascript:(function() {
                    window.androidFcmToken = '$token';
                    console.log('[Android Bridge] androidFcmToken SET by Android');
                    window.dispatchEvent(new CustomEvent('android-fcm-token', { detail: '$token' }));
                })()
            """.trimIndent()
            targetWebView.evaluateJavascript(jsCode, null)
        }
    }
    
    private fun handleDownload(targetWebView: WebView, url: String, userAgent: String, contentDisposition: String, mimetype: String) {
        val isFromPopup = (targetWebView != webView)
        
        if (isFromPopup) {
            popupDialog?.dismiss()
            popupDialog = null
        }
        
        if (url.startsWith("blob:")) {
            val js = """
                var xhr = new XMLHttpRequest();
                xhr.open('GET', '$url', true);
                xhr.responseType = 'blob';
                xhr.onload = function(e) {
                    if (this.status == 200) {
                        var blob = this.response;
                        var reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = function() {
                            base64data = reader.result;
                            Android.downloadBlob(base64data, '$mimetype');
                        }
                    }
                };
                xhr.send();
            """.trimIndent()
            targetWebView.evaluateJavascript(js, null)
            Toast.makeText(applicationContext, "Preparing download...", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (url.startsWith("data:")) {
            Toast.makeText(applicationContext, "Download not supported for data URLs yet", Toast.LENGTH_LONG).show()
            return
        }
        
        try {
            val request = DownloadManager.Request(Uri.parse(url))
            request.setMimeType(mimetype)
            request.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
            request.addRequestHeader("User-Agent", userAgent)
            request.setDescription("Downloading file...")
            request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimetype))
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            request.setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                URLUtil.guessFileName(url, contentDisposition, mimetype)
            )
            val dm = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            
            Toast.makeText(applicationContext, "Downloading File", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Log.e(TAG, "Download failed", e)
            Toast.makeText(applicationContext, "Download failed: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun createWebViewClient(dialog: Dialog?): WebViewClient {
        return object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url.toString()
                
                if (url.contains("api.whatsapp.com") || url.contains("wa.me") || url.contains("whatsapp.com")) {
                     try {
                         val intent = Intent(Intent.ACTION_VIEW)
                         intent.data = Uri.parse(url)
                         intent.setPackage("com.whatsapp")
                         view?.context?.startActivity(intent)
                         
                         dialog?.dismiss()
                         if (popupDialog?.isShowing == true) {
                             popupDialog?.dismiss()
                             popupDialog = null
                         }
                         
                         return true
                     } catch (e: Exception) {
                         Toast.makeText(view?.context, "WhatsApp not installed", Toast.LENGTH_SHORT).show()
                         dialog?.dismiss()
                         if (popupDialog?.isShowing == true) {
                             popupDialog?.dismiss()
                             popupDialog = null
                         }
                         return true 
                     }
                }
                
                if (url.startsWith("http://") || url.startsWith("https://") || 
                    url.startsWith("blob:") || url.startsWith("about:") || url.startsWith("data:") ||
                    url.startsWith("content:") || url.startsWith("javascript:") || url.startsWith("file:") ||
                    url.startsWith("filesystem:")) {
                    return false
                }
                
                try {
                    val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    intent.addCategory(Intent.CATEGORY_BROWSABLE)
                    intent.component = null
                    intent.selector = null
                    
                    if (view?.context?.packageManager?.let { intent.resolveActivity(it) } != null) {
                         view.context.startActivity(intent)
                         dialog?.dismiss()
                         if (popupDialog?.isShowing == true) {
                             popupDialog?.dismiss()
                             popupDialog = null
                         }
                         return true
                    } else {
                         val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                         if (fallbackUrl != null) {
                             view?.loadUrl(fallbackUrl)
                             return true
                         }
                         dialog?.dismiss()
                         if (popupDialog?.isShowing == true) {
                             popupDialog?.dismiss()
                             popupDialog = null
                         }
                    }
                } catch (e: Exception) {
                     Log.e(TAG, "Failed to launch intent: $url", e)
                     dialog?.dismiss()
                }
                return true
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript(
                    "window.print = function() { Android.print(); };",
                    null
                )
                
                if (url != null && !url.endsWith("/login")) {
                    injectFcmToken(view)
                }
            }
        }
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            ) {
            } else if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
            } else {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }
    
    private fun setupNetworkMonitoring() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    noInternetSnackbar?.dismiss()
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread {
                    showNoInternetSnackbar()
                }
            }
        }

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(networkRequest, networkCallback)
        
        if (!isNetworkAvailable()) {
            showNoInternetSnackbar()
        }
    }
    
    private fun isNetworkAvailable(): Boolean {
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun showNoInternetSnackbar() {
        if (noInternetSnackbar == null) {
            noInternetSnackbar = Snackbar.make(
                findViewById(android.R.id.content),
                "No Internet Connection",
                Snackbar.LENGTH_INDEFINITE
            ).setAction("Retry") {
                if (isNetworkAvailable()) {
                    webView.reload()
                    noInternetSnackbar?.dismiss()
                } else {
                     showNoInternetSnackbar()
                }
            }
        }
        noInternetSnackbar?.show()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (e: Exception) {
            // Already unregistered
        }
    }

    private fun launchCamera() {
        try {
            val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            val photoFile = createImageFile()
            photoURI = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoURI)
            takePictureLauncher.launch(takePictureIntent)
        } catch (e: Exception) {
            Toast.makeText(this, "Camera not available", Toast.LENGTH_SHORT).show()
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = null
        }
    }

    private fun launchGalleryPicker() {
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "image/*"
            intent.addCategory(Intent.CATEGORY_OPENABLE)
            takePictureLauncher.launch(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Gallery not available", Toast.LENGTH_SHORT).show()
            fileUploadCallback?.onReceiveValue(null)
            fileUploadCallback = null
        }
    }

    @Throws(IOException::class)
    private fun createImageFile(): File {
        val timeStamp: String = SimpleDateFormat("yyyyMMdd_HHmmss").format(Date())
        val storageDir: File? = getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile(
            "JPEG_${timeStamp}_",
            ".jpg",
            storageDir
        )
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}