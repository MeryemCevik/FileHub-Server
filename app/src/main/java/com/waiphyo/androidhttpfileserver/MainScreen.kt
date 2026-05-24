package com.waiphyo.androidhttpfileserver

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.waiphyo.androidhttpfileserver.ui.theme.FileHubTheme

/**
 * Interface principale de l'application Android (Panneau de contrôle).
 * Gère l'affichage responsive et le basculement de thème.
 */
@Composable
fun MainApp(
    viewModel: MainViewModel,
    ipAddress: String,
    onOpenBrowser: () -> Unit,
    onPickFolder: () -> Unit
) {
    // Collecte des états depuis le ViewModel
    val serverState by viewModel.serverState.collectAsState()
    val port by viewModel.port.collectAsState()
    val sharedPath by viewModel.sharedPath.collectAsState()
    val isDarkMode by viewModel.isDarkMode.collectAsState()
    val context = LocalContext.current

    FileHubTheme(darkTheme = isDarkMode) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Scaffold(
                topBar = { AppHeader(isDarkMode, onToggleTheme = viewModel::toggleTheme) }
            ) { padding ->
                Column(
                    modifier = Modifier
                        .padding(padding)
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // --- CARTE DU LIEN (AFFINÉE ET ÉLÉGANTE) ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        ),
                        border = if (serverState) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null,
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                StatusIndicator(active = serverState)
                                Text(
                                    text = if (serverState) "SERVEUR ACTIF" else "SERVEUR ARRÊTÉ",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (serverState) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            val serverUrl = "http://$ipAddress:$port"
                            
                            Surface(
                                color = if (serverState) MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                                border = if (serverState) BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)) else null,
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.padding(vertical = 8.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.Link,
                                        contentDescription = null,
                                        tint = if (serverState) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Text(
                                        text = if (serverState) serverUrl else "Serveur arrêté",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = if (serverState) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            if (serverState) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TextButton(
                                        onClick = {
                                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                            val clip = android.content.ClipData.newPlainText("URL Serveur", serverUrl)
                                            clipboard.setPrimaryClip(clip)
                                        }
                                    ) {
                                        Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Copier", style = MaterialTheme.typography.labelLarge)
                                    }

                                    TextButton(onClick = onOpenBrowser) {
                                        Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Ouvrir", style = MaterialTheme.typography.labelLarge)
                                    }
                                }
                            }
                        }
                    }

                    // --- CARTE DE CONFIGURATION ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(28.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(
                            modifier = Modifier.padding(24.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Text("Paramètres de partage", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                            // Sélection du dossier
                            OutlinedCard(
                                onClick = { if (!serverState) onPickFolder() },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(20.dp),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                colors = CardDefaults.outlinedCardColors(
                                    containerColor = if (serverState) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.2f) else Color.Transparent
                                )
                            ) {
                                Row(
                                    modifier = Modifier.padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(48.dp)
                                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Folder, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                    }
                                    Spacer(Modifier.width(16.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Dossier partagé", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                        Text(
                                            text = sharedPath.split("/").lastOrNull()?.takeIf { it.isNotEmpty() } ?: "Stockage principal",
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1
                                        )
                                        Text(
                                            text = if (sharedPath.length > 30) "..." + sharedPath.takeLast(27) else sharedPath,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                        )
                                    }
                                    if (!serverState) {
                                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }

                            // Raccourcis de dossiers
                            if (!serverState) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    AssistChip(
                                        onClick = { viewModel.updateSharedPath(android.os.Environment.getExternalStorageDirectory().absolutePath) },
                                        label = { Text("Racine") },
                                        leadingIcon = { Icon(Icons.Default.Home, null, Modifier.size(16.dp)) },
                                        shape = RoundedCornerShape(12.dp)
                                    )
                                    AssistChip(
                                        onClick = { viewModel.useDownloadsFolder() },
                                        label = { Text("Téléchargements") },
                                        leadingIcon = { Icon(Icons.Default.Download, null, Modifier.size(16.dp)) },
                                        shape = RoundedCornerShape(12.dp)
                                    )
                                }
                            }
                            
                            // Champ de saisie pour le Port
                            OutlinedTextField(
                                value = port.toString(),
                                onValueChange = { input ->
                                    input.toIntOrNull()?.let { viewModel.updatePort(it) }
                                },
                                label = { Text("Port Réseau") },
                                enabled = !serverState,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                leadingIcon = { Icon(Icons.Default.Numbers, contentDescription = null) }
                            )

                            // Bouton Démarrer / Arrêter
                            Button(
                                onClick = { 
                                    if (serverState) viewModel.stopServer(context)
                                    else viewModel.startServer(context)
                                },
                                modifier = Modifier.fillMaxWidth().height(64.dp),
                                shape = RoundedCornerShape(20.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (serverState) Color(0xFFD32F2F) else MaterialTheme.colorScheme.primary,
                                    contentColor = if (serverState) Color.White else MaterialTheme.colorScheme.onPrimary
                                )
                            ) {
                                Icon(if (serverState) Icons.Default.Stop else Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text(if (serverState) "ARRÊTER LE SERVEUR" else "DÉMARRER LE SERVEUR", fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))
                    
                    Text(
                        text = "FileHub Local Server - v2.3",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

/**
 * Barre d'en-tête de l'application avec logo et bouton de thème.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppHeader(isDarkMode: Boolean, onToggleTheme: () -> Unit) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                FileHubLogo()
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "FileHub",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        actions = {
            IconButton(onClick = onToggleTheme) {
                Icon(
                    imageVector = if (isDarkMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                    contentDescription = "Changer le thème"
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.background
        )
    )
}

/**
 * Logo de l'application utilisant la ressource mipmap ic_launcher_foreground.
 */
@Composable
fun FileHubLogo() {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF2D6A4F)), // Vert foncé
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = R.mipmap.ic_launcher_foreground),
            contentDescription = "Logo FileHub",
            modifier = Modifier.size(40.dp),
            contentScale = ContentScale.FillBounds
        )
    }
}

/**
 * Indicateur visuel (pastille) de l'état du serveur.
 */
@Composable
fun StatusIndicator(active: Boolean) {
    Box(
        modifier = Modifier
            .size(12.dp)
            .clip(CircleShape)
            .background(if (active) Color(0xFF4CAF50) else Color(0xFFE57373))
    )
}
