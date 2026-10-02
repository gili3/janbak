package app.jenbak.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Light = lightColorScheme(
    primary = Color(0xFF0F766E), onPrimary = Color.White,
    primaryContainer = Color(0xFFD3F2EC), onPrimaryContainer = Color(0xFF053B36),
    secondary = Color(0xFFB45309), onSecondary = Color.White,
    secondaryContainer = Color(0xFFFDEFD2), onSecondaryContainer = Color(0xFF4A2A00),
    tertiary = Color(0xFF2563EB), onTertiary = Color.White,
    background = Color(0xFFF4F7F6), onBackground = Color(0xFF15201F),
    surface = Color(0xFFF4F7F6), onSurface = Color(0xFF15201F),
    surfaceVariant = Color(0xFFE3ECEA), onSurfaceVariant = Color(0xFF46564F),
    outline = Color(0xFF86998F), outlineVariant = Color(0xFFD0DDD9),
    error = Color(0xFFB3261E), onError = Color.White,
    errorContainer = Color(0xFFFBE0DD), onErrorContainer = Color(0xFF5C0D08),
    surfaceContainerLowest = Color(0xFFFFFFFF), surfaceContainerLow = Color(0xFFFAFCFB),
    surfaceContainer = Color(0xFFF0F5F3), surfaceContainerHigh = Color(0xFFE9F0EE),
    surfaceContainerHighest = Color(0xFFE2EAE8)
)

private val Dark = darkColorScheme(
    primary = Color(0xFF5DD6C6), onPrimary = Color(0xFF00201C),
    primaryContainer = Color(0xFF0B4A44), onPrimaryContainer = Color(0xFFBFF3EA),
    secondary = Color(0xFFF2B45C), onSecondary = Color(0xFF3A2200),
    secondaryContainer = Color(0xFF4A3000), onSecondaryContainer = Color(0xFFFFE2B0),
    tertiary = Color(0xFF8FB4FF), onTertiary = Color(0xFF002A6B),
    background = Color(0xFF101B1A), onBackground = Color(0xFFE1EAE8),
    surface = Color(0xFF101B1A), onSurface = Color(0xFFE1EAE8),
    surfaceVariant = Color(0xFF24312F), onSurfaceVariant = Color(0xFFB0BFBC),
    outline = Color(0xFF7A8A87), outlineVariant = Color(0xFF33423F),
    error = Color(0xFFF2B8B5), onError = Color(0xFF601410),
    errorContainer = Color(0xFF5C1C17), onErrorContainer = Color(0xFFF9DEDC),
    surfaceContainerLowest = Color(0xFF0A1312), surfaceContainerLow = Color(0xFF131F1E),
    surfaceContainer = Color(0xFF172423), surfaceContainerHigh = Color(0xFF1D2B2A),
    surfaceContainerHighest = Color(0xFF243332)
)

private val AppShapes = Shapes(
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp)
)

private val Base = Typography()
private val AppTypography = Typography(
    headlineSmall = Base.headlineSmall.copy(fontWeight = FontWeight.Bold, lineHeight = 34.sp),
    titleLarge = Base.titleLarge.copy(fontWeight = FontWeight.Bold),
    titleMedium = Base.titleMedium.copy(fontWeight = FontWeight.SemiBold, lineHeight = 24.sp),
    bodyLarge = Base.bodyLarge.copy(lineHeight = 26.sp),
    bodyMedium = Base.bodyMedium.copy(lineHeight = 22.sp),
    bodySmall = Base.bodySmall.copy(lineHeight = 18.sp),
    labelLarge = Base.labelLarge.copy(fontWeight = FontWeight.SemiBold)
)

@Composable
fun JenbakTheme(dark: Boolean, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = if (dark) Dark else Light,
            shapes = AppShapes,
            typography = AppTypography,
            content = content
        )
    }
}
