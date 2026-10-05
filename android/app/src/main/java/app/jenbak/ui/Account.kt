package app.jenbak.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import app.jenbak.data.*

// ───────────────────────── القائمة (حسابي) ─────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountScreen(nav: NavController, vm: AppViewModel) {
    val ctx = LocalContext.current
    val cs = MaterialTheme.colorScheme
    val user by vm.user.collectAsStateWithLifecycle()
    val theme by Prefs.theme.collectAsStateWithLifecycle()
    var confirmOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("القائمة", fontWeight = FontWeight.Bold) }) },
        bottomBar = { MainBar(nav, "account") }
    ) { pad ->
        Column(
            Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            val u = user
            val signedIn = u != null && !u.isGuest

            // ── الحساب ──
            if (!signedIn) {
                Surface(shape = MaterialTheme.shapes.extraLarge, color = cs.primaryContainer, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("أنت تتصفح كضيف", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = cs.onPrimaryContainer)
                        Text("سجّل الدخول بحساب جوجل لإضافة نشاطك.", style = MaterialTheme.typography.bodyMedium, color = cs.onPrimaryContainer)
                        GoogleSignInButton(vm, label = "الدخول بحساب جوجل")
                    }
                }
            } else {
                val name = u!!.name.ifBlank { u.email.ifBlank { "مستخدم" } }
                Surface(
                    shape = MaterialTheme.shapes.extraLarge, color = cs.surfaceContainerLowest,
                    border = BorderStroke(1.dp, cs.outlineVariant), modifier = Modifier.fillMaxWidth()
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(48.dp).clip(CircleShape).background(cs.primary), Alignment.Center) {
                            Text(name.take(1), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = cs.onPrimary)
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(name, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }

            // ── إضافة نشاط: الموضع الوحيد في التطبيق (الضيف يُحوَّل لتسجيل الدخول) ──
            Button({ startAdd(nav, vm) }, Modifier.fillMaxWidth().height(52.dp)) {
                Icon(Icons.Filled.Add, null)
                Spacer(Modifier.width(8.dp))
                Text("أضف نشاطك", style = MaterialTheme.typography.titleMedium)
            }

            // ── المظهر ──
            val labels = listOf("حسب الجهاز", "فاتح", "داكن")
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                labels.forEachIndexed { i, label ->
                    SegmentedButton(
                        selected = theme == i,
                        onClick = { Prefs.setTheme(i) },
                        shape = SegmentedButtonDefaults.itemShape(i, labels.size)
                    ) { Text(label, maxLines = 1) }
                }
            }

            // ── الخروج والحذف (حذف الحساب مطلوب من Google Play) ──
            if (signedIn) {
                OutlinedButton({ confirmOut = true }, Modifier.fillMaxWidth()) { Text("تسجيل الخروج") }
                TextButton(
                    { confirmDelete = true }, Modifier.align(Alignment.CenterHorizontally),
                    enabled = !deleting,
                    colors = ButtonDefaults.textButtonColors(contentColor = cs.error)
                ) { Text(if (deleting) "جارٍ الحذف..." else "حذف حسابي وبياناتي") }
            }
        }
    }

    if (confirmOut) ConfirmDialog("تسجيل الخروج", "هل تريد تسجيل الخروج؟", "خروج", onConfirm = { confirmOut = false; vm.signOut() }, onDismiss = { confirmOut = false })
    if (confirmDelete) ConfirmDialog(
        "حذف الحساب", "سيُحذف حسابك وكل أنشطتك نهائياً ولا يمكن التراجع.", "حذف نهائي", destructive = true,
        onConfirm = {
            confirmDelete = false; deleting = true
            vm.deleteAccount { err -> deleting = false; ctx.toast(err ?: "تم حذف حسابك") }
        },
        onDismiss = { confirmDelete = false }
    )
}
