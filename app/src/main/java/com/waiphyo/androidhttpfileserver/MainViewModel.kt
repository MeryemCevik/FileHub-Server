package com.waiphyo.androidhttpfileserver

import android.content.Context
import android.content.Intent
import android.os.Environment
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.waiphyo.androidhttpfileserver.server.HttpServerService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel gérant la communication avec le Service de premier plan.
 * L'interface ne touche plus au serveur directement, elle pilote le Service.
 */
class MainViewModel : ViewModel() {

    // État visuel du serveur
    private val _serverState = MutableStateFlow(false)
    val serverState = _serverState.asStateFlow()

    private val _port = MutableStateFlow(8080)
    val port = _port.asStateFlow()

    private val _sharedPath = MutableStateFlow(Environment.getExternalStorageDirectory().absolutePath)
    val sharedPath = _sharedPath.asStateFlow()

    private val _isDarkMode = MutableStateFlow(false)
    val isDarkMode = _isDarkMode.asStateFlow()

    fun toggleTheme() {
        _isDarkMode.value = !_isDarkMode.value
    }

    fun updateServerState(isStarted: Boolean) {
        _serverState.value = isStarted
    }

    fun updatePort(port: Int) {
        _port.value = port
    }

    fun updateSharedPath(path: String) {
        _sharedPath.value = path
    }

    fun useDownloadsFolder() {
        val downloadsPath = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath
        updateSharedPath(downloadsPath)
    }

    /**
     * DÉMARRAGE PAR SERVICE :
     * On demande à Android de lancer le HttpServerService.
     */
    fun startServer(context: Context) {
        if (_serverState.value) return

        val intent = Intent(context, HttpServerService::class.java).apply {
            action = "START"
            putExtra("PORT", _port.value)
            putExtra("PATH", _sharedPath.value)
        }

        // Utilisation de startForegroundService pour garantir que le service démarre
        ContextCompat.startForegroundService(context, intent)
        updateServerState(true)
    }

    /**
     * ARRÊT PAR SERVICE :
     * On envoie un signal STOP au service.
     */
    fun stopServer(context: Context) {
        val intent = Intent(context, HttpServerService::class.java).apply {
            action = "STOP"
        }
        context.startService(intent)
        updateServerState(false)
    }
}
