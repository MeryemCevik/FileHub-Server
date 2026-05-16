package com.waiphyo.androidhttpfileserver

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.waiphyo.androidhttpfileserver.ui.theme.FileHubTheme
import java.net.Inet4Address

class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermissions()

        setContent {
            FileHubTheme {
                MainApp(
                    viewModel = viewModel,
                    ipAddress = getWifiIpAddress(),
                    onOpenBrowser = { openBrowser() }
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

    private fun checkAndRequestPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
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
