package com.waiphyo.androidhttpfileserver

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.DocumentsContract
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.waiphyo.androidhttpfileserver.ui.theme.FileHubTheme
import java.io.File
import java.net.Inet4Address

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        uri?.let {
            val path = getFullPathFromUri(it)
            val file = File(path)
            if (file.exists() && file.isDirectory && file.canRead()) {
                viewModel.updateSharedPath(path)
                Toast.makeText(this, "Dossier sélectionné : ${file.name}", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Erreur d'accès au dossier. Vérifiez les permissions.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermissions()

        setContent {
            FileHubTheme {
                MainApp(
                    viewModel = viewModel,
                    ipAddress = getWifiIpAddress(),
                    onOpenBrowser = { openBrowser() },
                    onPickFolder = { folderPicker.launch(null) }
                )
            }
        }

        // Auto-start server on launch
        viewModel.startServer(this)
    }

    private fun openBrowser() {
        val url = "http://${getWifiIpAddress()}:${viewModel.port.value}"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        startActivity(intent)
    }

    private fun getWifiIpAddress(): String {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val linkProperties = connectivityManager.getLinkProperties(connectivityManager.activeNetwork)
        val ipAddress = linkProperties?.linkAddresses?.firstOrNull {
            it.address is Inet4Address && !it.address.isLoopbackAddress
        }?.address
        return ipAddress?.hostAddress ?: "0.0.0.0"
    }

    /**
     * Convertit un URI de type DocumentTree en chemin absolu (pour stockage primaire).
     */
    private fun getFullPathFromUri(uri: Uri): String {
        val docId = DocumentsContract.getTreeDocumentId(uri)
        val split = docId.split(":")
        val type = split[0]
        return if ("primary".equals(type, ignoreCase = true)) {
            if (split.size > 1) {
                Environment.getExternalStorageDirectory().absolutePath + "/" + split[1]
            } else {
                Environment.getExternalStorageDirectory().absolutePath
            }
        } else {
            if (split.size > 1) {
                "/storage/" + type + "/" + split[1]
            } else {
                "/storage/" + type
            }
        }
    }

    private fun checkAndRequestPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                    intent.data = Uri.parse("package:$packageName")
                    startActivity(intent)
                } catch (e: Exception) {
                    val intent = Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
                    startActivity(intent)
                }
            }
        } else {
            if (ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.READ_EXTERNAL_STORAGE
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(
                        Manifest.permission.READ_EXTERNAL_STORAGE,
                        Manifest.permission.WRITE_EXTERNAL_STORAGE
                    ),
                    1234
                )
            }
        }
    }

    override fun onDestroy() {
        viewModel.stopServer()
        super.onDestroy()
    }
}
