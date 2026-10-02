package app.jenbak

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.jenbak.data.Prefs
import app.jenbak.ui.AppRoot
import app.jenbak.ui.JenbakTheme

class MainActivity : ComponentActivity() {
    private val deepLink = mutableStateOf<String?>(null)
    private val askNotif = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) deepLink.value = intent?.getStringExtra("type")

        // إذن الإشعارات فقط (أندرويد 13+) — لا يوجد أي إذن موقع
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            askNotif.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            val mode by Prefs.theme.collectAsStateWithLifecycle()
            val dark = when (mode) {
                1 -> false
                2 -> true
                else -> isSystemInDarkTheme()
            }
            DisposableEffect(dark) {
                enableEdgeToEdge(
                    statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark },
                    navigationBarStyle = SystemBarStyle.auto(
                        Color.argb(0xE6, 0xFF, 0xFF, 0xFF), Color.argb(0x80, 0x1B, 0x1B, 0x1B)
                    ) { dark }
                )
                onDispose { }
            }
            JenbakTheme(dark) { AppRoot(deepLink) }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        deepLink.value = intent.getStringExtra("type")
    }
}
