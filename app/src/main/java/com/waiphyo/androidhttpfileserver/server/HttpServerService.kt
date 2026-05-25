package com.waiphyo.androidhttpfileserver.server

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.waiphyo.androidhttpfileserver.MainActivity
import com.waiphyo.androidhttpfileserver.R

/**
 * SERVICE DE PREMIER PLAN (Foreground Service)
 * Ce service permet au serveur HTTP de continuer à fonctionner même si 
 * l'utilisateur ferme l'application ou verrouille son téléphone.
 * Android ne peut pas tuer ce processus tant que la notification est visible.
 */
class HttpServerService : Service() {

    private var httpServer: HttpServer? = null
    private val CHANNEL_ID = "HttpServerChannel"
    private val NOTIFICATION_ID = 1

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        
        if (action == "START") {
            val port = intent.getIntExtra("PORT", 8080)
            val path = intent.getStringExtra("PATH") ?: ""
            
            // 1. Créer le canal de notification (nécessaire pour Android 8+)
            createNotificationChannel()
            
            // 2. Créer la notification qui s'affiche en haut du téléphone
            val notification = createNotification()
            
            // 3. Démarrer le service en mode "Foreground" (priorité haute)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            
            // 4. Lancer le serveur HTTP réel
            startServer(port, path)
            
        } else if (action == "STOP") {
            stopServer()
            stopForeground(true)
            stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun startServer(port: Int, path: String) {
        if (httpServer == null) {
            httpServer = HttpServer(this, port, path)
            try {
                httpServer?.start()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun stopServer() {
        httpServer?.stop()
        httpServer = null
    }

    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FileHub Server")
            .setContentText("Le serveur de fichiers est actif sur votre réseau.")
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // Empêche l'utilisateur de supprimer la notification
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Canal du serveur FileHub",
                NotificationManager.IMPORTANCE_LOW // Low pour ne pas faire de bruit à chaque démarrage
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopServer()
        super.onDestroy()
    }
}
