package com.waiphyo.androidhttpfileserver

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
import com.waiphyo.androidhttpfileserver.R

/**
 * Interface principale de l'application Android (Panneau de contrôle).
 * Gère l'affichage responsive et le basculement de thème.
 */
@Composable
fun MainApp(
    viewModel: MainViewModel,
    ipAddress: String,
    onOpenBrowser: () -> Unit
) {
    // Collecte des états depuis le ViewModel
    val serverState by viewModel.serverState.collectAsState()
    val port by viewModel.port.collectAsState()
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
                        .verticalScroll(rememberScrollState()) // Permet le scroll si le contenu dépasse
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // --- CARTE DE STATUT DU SERVEUR ---
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(28.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (serverState) 
                                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f) 
                            else 
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        )
                    ) {
                        Row(
                            modifier = Modifier.padding(24.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (serverState) "Serveur Actif" else "Serveur Inactif",
                                    style = MaterialTheme.typography.headlineSmall,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (serverState) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = if (serverState) "Prêt à partager sur http://$ipAddress:$port" else "Configurez et démarrez pour partager",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                            StatusIndicator(active = serverState)
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
                            Text("Configuration", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            
                            // Champ de saisie pour le Port
                            OutlinedTextField(
                                value = port.toString(),
                                onValueChange = { input ->
                                    input.toIntOrNull()?.let { viewModel.updatePort(it) }
                                },
                                label = { Text("Numéro de Port") },
                                enabled = !serverState,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(16.dp),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                leadingIcon = { Icon(Icons.Default.Numbers, contentDescription = null) }
                            )

                            // Bouton Démarrer / Arrêter
                            Button(
                                onClick = { 
                                    if (serverState) viewModel.stopServer()
                                    else viewModel.startServer(context)
                                },
                                modifier = Modifier.fillMaxWidth().height(64.dp),
                                shape = RoundedCornerShape(20.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (serverState) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                                )
                            ) {
                                Icon(if (serverState) Icons.Default.Stop else Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text(if (serverState) "ARRÊTER LE SERVEUR" else "DÉMARRER LE SERVEUR", fontWeight = FontWeight.Bold)
                            }

                            // Bouton pour ouvrir l'interface web localement
                            if (serverState) {
                                FilledTonalButton(
                                    onClick = onOpenBrowser,
                                    modifier = Modifier.fillMaxWidth().height(64.dp),
                                    shape = RoundedCornerShape(20.dp)
                                ) {
                                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("OUVRIR LE NAVIGATEUR")
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))
                    
                    Text(
                        text = "FileHub Local Server - v2.2",
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
 * Utilise un fond sombre fixe pour assurer que le logo blanc est toujours visible,
 * quel que soit le mode (clair ou sombre) de l'application.
 */
@Composable
fun FileHubLogo() {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF2D6A4F)), // Vert foncé constant (identique à la page web)
        contentAlignment = Alignment.Center
    ) {
        Image(
            painter = painterResource(id = R.mipmap.ic_launcher_foreground),
            contentDescription = "Logo FileHub",
            modifier = Modifier
                .size(40.dp), // Taille augmentée pour remplir le conteneur
            contentScale = ContentScale.FillBounds // Utilise FillBounds pour bien occuper l'espace
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
