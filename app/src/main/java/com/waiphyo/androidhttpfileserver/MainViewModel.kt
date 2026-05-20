package com.waiphyo.androidhttpfileserver

import android.content.Context
import android.os.Environment
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.waiphyo.androidhttpfileserver.server.HttpServer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel gérant l'état du serveur et la configuration de l'application.
 * Utilise StateFlow pour une observation réactive par l'UI Compose.
 */
class MainViewModel : ViewModel() {

    private var httpServer: HttpServer? = null

    // État du serveur (en ligne / hors ligne)
    private val _serverState = MutableStateFlow(false)
    val serverState = _serverState.asStateFlow()

    // Port réseau utilisé par le serveur (8080 par défaut)
    private val _port = MutableStateFlow(8080)
    val port = _port.asStateFlow()

    // Chemin du dossier partagé (par défaut racine du stockage)
    private val _sharedPath = MutableStateFlow(Environment.getExternalStorageDirectory().absolutePath)
    val sharedPath = _sharedPath.asStateFlow()

    // État du mode sombre (activé / désactivé)
    private val _isDarkMode = MutableStateFlow(false)
    val isDarkMode = _isDarkMode.asStateFlow()

    /**
     * Alterne entre le mode clair et le mode sombre.
     */
    fun toggleTheme() {
        _isDarkMode.value = !_isDarkMode.value
    }

    /**
     * Met à jour manuellement l'état visuel du serveur.
     */
    fun updateServerState(isStarted: Boolean) {
        viewModelScope.launch {
            _serverState.value = isStarted
        }
    }

    /**
     * Change le port d'écoute (autorisé seulement si le serveur est arrêté).
     */
    fun updatePort(port: Int) {
        viewModelScope.launch {
            _port.value = port
        }
    }

    /**
     * Met à jour le dossier à partager.
     */
    fun updateSharedPath(path: String) {
        viewModelScope.launch {
            _sharedPath.value = path
        }
    }

    /**
     * Bascule sur le dossier Téléchargements par défaut.
     */
    fun useDownloadsFolder() {
        val downloadsPath = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath
        updateSharedPath(downloadsPath)
    }

    /**
     * Démarre l'instance du serveur HTTP.
     * @param context Nécessaire pour accéder aux assets et fichiers du système.
     */
    fun startServer(context: Context) {
        if (_serverState.value) return
        try {
            httpServer = HttpServer(context, port.value, sharedPath.value).apply {
                start()
            }
            updateServerState(true)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Arrête le serveur et libère les ressources.
     */
    fun stopServer() {
        httpServer?.stop()
        httpServer = null
        updateServerState(false)
    }

    /**
     * Nettoyage automatique à la destruction du ViewModel.
     */
    override fun onCleared() {
        stopServer()
        super.onCleared()
    }
}
