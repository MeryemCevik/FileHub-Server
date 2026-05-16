package com.waiphyo.androidhttpfileserver.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = GreenPrimary,
    secondary = GreenSecondary,

    background = BackgroundDark,
    surface = SurfaceDark,

    onPrimary = Color.White,
    onSecondary = Color.White,

    onBackground = TextPrimaryDark,
    onSurface = TextPrimaryDark
)

private val LightColorScheme = lightColorScheme(
    primary = GreenPrimary,
    primaryContainer = GreenContainer,
    secondary = PurplePrimary,

    background = BackgroundLight,
    surface = SurfaceLight,

    onPrimary = Color.White,
    onSecondary = Color.White,

    onBackground = TextPrimary,
    onSurface = TextPrimary,

    surfaceVariant = OutlineLight
)

@Composable
fun FileHubTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}