package app.jenbak.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import app.jenbak.data.AuthRepo
import app.jenbak.data.authMessage
import kotlinx.coroutines.launch

/** زر «المتابعة بحساب جوجل»: يدخل مباشرة، أو يربط حساب الضيف الحالي بجوجل */
@Composable
fun GoogleSignInButton(vm: AppViewModel, modifier: Modifier = Modifier, label: String = "المتابعة بحساب جوجل", onDone: () -> Unit = {}) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    Button(
        enabled = !busy,
        modifier = modifier.fillMaxWidth().height(52.dp),
        onClick = {
            val activity = ctx.findActivity()
            if (activity == null) {
                ctx.toast("تعذر بدء تسجيل الدخول")
            } else {
                busy = true
                scope.launch {
                    val r = runCatching { AuthRepo.signInWithGoogle(activity) }
                    busy = false
                    vm.refreshUser()
                    val err = r.exceptionOrNull()
                    if (err != null) ctx.toast(err.authMessage()) else onDone()
                }
            }
        }
    ) { Text(if (busy) "جارٍ الدخول..." else label) }
}

/** الشاشة الأولى: جوجل أو ضيف فقط، لا شيء آخر */
@Composable
fun WelcomeScreen(vm: AppViewModel) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val cfg by vm.settings.collectAsStateWithLifecycle()
    var guestBusy by remember { mutableStateOf(false) }

    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()
                .verticalScroll(rememberScrollState()).padding(28.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("🧭", fontSize = 64.sp)
            Spacer(Modifier.height(8.dp))
            Text("جنبك", style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(8.dp))
            Text(
                cfg.tagline, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(36.dp))
            GoogleSignInButton(vm)
            Spacer(Modifier.height(12.dp))
            OutlinedButton(
                enabled = !guestBusy,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                onClick = {
                    guestBusy = true
                    scope.launch {
                        val r = runCatching { AuthRepo.signInGuest() }
                        guestBusy = false
                        vm.refreshUser()
                        r.exceptionOrNull()?.let { ctx.toast(it.authMessage()) }
                    }
                }
            ) { Text(if (guestBusy) "جارٍ الدخول..." else "الدخول كضيف") }
            Spacer(Modifier.height(16.dp))
            Text(
                "الضيف يتصفح الدليل فقط. لإضافة نشاطك يلزم حساب جوجل، ويمكنك ربطه لاحقاً.",
                style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/** تظهر للضيف عند محاولة إضافة نشاط: ربط الحساب بجوجل */
@Composable
fun LoginScreen(nav: NavController, vm: AppViewModel) {
    val user by vm.user.collectAsStateWithLifecycle()
    LaunchedEffect(user) { if (user?.isGuest == false) nav.popBackStack() }
    SubScaffold("تسجيل الدخول", { nav.popBackStack() }) { pad ->
        Column(Modifier.padding(pad).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("🔐", fontSize = 40.sp)
            Text("سجّل الدخول بحساب جوجل", style = MaterialTheme.typography.titleLarge)
            Text(
                "نحتاج حسابك لربط النشاط الذي تضيفه بك. يظهر بريدك للإدارة عند المراجعة فقط.",
                style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            GoogleSignInButton(vm)
        }
    }
}
