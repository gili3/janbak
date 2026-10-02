package app.jenbak.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import app.jenbak.data.*

// ───────────────────────── حسابي ─────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountScreen(nav: NavController, vm: AppViewModel, unread: Int) {
    val ctx = LocalContext.current
    val user by vm.user.collectAsStateWithLifecycle()
    val mine by vm.myPlaces.collectAsStateWithLifecycle()
    val reqs by vm.myRequests.collectAsStateWithLifecycle()
    val theme by Prefs.theme.collectAsStateWithLifecycle()
    val newsPush by Prefs.newsPush.collectAsStateWithLifecycle()
    var confirmOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    val version = remember { runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: "" }

    Scaffold(
        topBar = { TopAppBar(title = { Text("حسابي", fontWeight = FontWeight.Bold) }) },
        bottomBar = { MainBar(nav, "account", unread) }
    ) { pad ->
        Column(
            Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            val u = user
            if (u == null || u.isGuest) {
                Surface(shape = MaterialTheme.shapes.large, color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("أنت تتصفح كضيف", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text("سجّل الدخول بحساب جوجل لإضافة نشاطك ومتابعة طلباتك واستلام الإشعارات.", color = MaterialTheme.colorScheme.onPrimaryContainer)
                        GoogleSignInButton(vm, label = "الدخول بحساب جوجل")
                    }
                }
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer), Alignment.Center) { Text("👤", fontSize = 22.sp) }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(u.name.ifBlank { u.email.ifBlank { "مستخدم" } }, style = MaterialTheme.typography.titleMedium)
                        if (u.name.isNotBlank() && u.email.isNotBlank()) Text(u.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("حساب جوجل", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                MenuRow("🏪", "أنشطتي", mine.size.takeIf { it > 0 }?.toString()) { nav.navigate("myplaces") }
                MenuRow("📋", "طلباتي", reqs.count { it.status == "pending" }.takeIf { it > 0 }?.let { "$it قيد المراجعة" }) { nav.navigate("mine") }
                MenuRow("🔔", "الإشعارات", unread.takeIf { it > 0 }?.toString()) { nav.navigate("inbox") }
                Button({ startAdd(nav, vm) }, Modifier.fillMaxWidth()) { Text("أضف نشاطاً جديداً") }
            }

            HorizontalDivider(Modifier.padding(vertical = 4.dp))
            Text("الإعدادات", style = MaterialTheme.typography.titleMedium)
            Text("المظهر", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("حسب الجهاز", "فاتح", "داكن").forEachIndexed { i, label ->
                    FilterChip(theme == i, { Prefs.setTheme(i) }, { Text(label) })
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("إشعارات الإعلانات")
                    Text("تنبيه عند نشر إعلان جديد", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(newsPush, { vm.setNewsPush(it) })
            }

            if (u != null && !u.isGuest) {
                HorizontalDivider(Modifier.padding(vertical = 4.dp))
                OutlinedButton({ confirmOut = true }, Modifier.fillMaxWidth()) { Text("تسجيل الخروج") }
                TextButton(
                    { confirmDelete = true }, Modifier.fillMaxWidth(),
                    enabled = !deleting,
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text(if (deleting) "جارٍ الحذف..." else "حذف حسابي وبياناتي") }
            }
            Text("جنبك $version", Modifier.align(Alignment.CenterHorizontally), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
        }
    }

    if (confirmOut) ConfirmDialog("تسجيل الخروج", "هل تريد تسجيل الخروج؟", "خروج", onConfirm = { confirmOut = false; vm.signOut() }, onDismiss = { confirmOut = false })
    if (confirmDelete) ConfirmDialog(
        "حذف الحساب", "سيُحذف حسابك وكل أنشطتك وطلباتك نهائياً ولا يمكن التراجع.", "حذف نهائي", destructive = true,
        onConfirm = {
            confirmDelete = false; deleting = true
            vm.deleteAccount { err -> deleting = false; ctx.toast(err ?: "تم حذف حسابك") }
        },
        onDismiss = { confirmDelete = false }
    )
}

@Composable
private fun MenuRow(emoji: String, title: String, trailing: String?, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(emoji, fontSize = 20.sp)
            Spacer(Modifier.width(12.dp))
            Text(title, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
            if (trailing != null) {
                Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.secondaryContainer) {
                    Text(trailing, Modifier.padding(horizontal = 8.dp, vertical = 2.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
                }
            }
        }
    }
}

// ───────────────────────── أنشطتي ─────────────────────────
@Composable
fun MyPlacesScreen(nav: NavController, vm: AppViewModel) {
    val mine by vm.myPlaces.collectAsStateWithLifecycle()
    val favs by Prefs.favs.collectAsStateWithLifecycle()
    SubScaffold("أنشطتي", { nav.popBackStack() }) { pad ->
        Box(Modifier.padding(pad)) {
            if (mine.isEmpty()) {
                EmptyState("🏪", "لا توجد أنشطة بعد", "الأنشطة المقبولة تظهر هنا ويمكنك اقتراح تعديل عليها", "أضف نشاطك") { startAdd(nav, vm) }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(mine, key = { it.id }) { p ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            PlaceCard(p, p.id in favs, { nav.navigate("place/${p.id}") }, { Prefs.toggleFav(p.id) })
                            Row(Modifier.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                StatusChip(p.status)
                                Spacer(Modifier.weight(1f))
                                TextButton({ nav.navigate("editor/edit/${p.id}") }) { Text("اقتراح تعديل") }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ───────────────────────── طلباتي ─────────────────────────
@Composable
fun MyRequestsScreen(nav: NavController, vm: AppViewModel) {
    val ctx = LocalContext.current
    val reqs by vm.myRequests.collectAsStateWithLifecycle()
    var cancelId by remember { mutableStateOf<String?>(null) }

    SubScaffold("طلباتي", { nav.popBackStack() }) { pad ->
        Box(Modifier.padding(pad)) {
            if (reqs.isEmpty()) {
                EmptyState("📋", "لم ترسل أي طلب بعد", "ستظهر هنا حالة كل طلب ترسله", "أضف نشاطك") { startAdd(nav, vm) }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(reqs, key = { it.id }) { r ->
                        Surface(
                            shape = MaterialTheme.shapes.large,
                            color = MaterialTheme.colorScheme.surfaceContainerLowest,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(r.draft.name, style = MaterialTheme.typography.titleMedium)
                                        Text(
                                            (if (r.kind == "edit") "طلب تعديل" else "طلب إضافة") + formatDate(r.createdAt).let { if (it.isEmpty()) "" else " • $it" },
                                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    StatusChip(r.status)
                                }
                                if (r.status == "rejected" && r.rejectReason.isNotBlank()) {
                                    Surface(shape = MaterialTheme.shapes.small, color = MaterialTheme.colorScheme.errorContainer) {
                                        Text("سبب الرفض: ${r.rejectReason}", Modifier.padding(10.dp), color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                                when (r.status) {
                                    "rejected" -> OutlinedButton({ nav.navigate("editor/retry/${r.id}") }) { Text("تعديل وإعادة الإرسال") }
                                    "pending" -> TextButton({ cancelId = r.id }, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("إلغاء الطلب") }
                                    else -> Unit
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    cancelId?.let { id ->
        ConfirmDialog("إلغاء الطلب", "هل تريد إلغاء هذا الطلب؟", "إلغاء الطلب", destructive = true,
            onConfirm = { cancelId = null; vm.cancelRequest(id) { ok -> ctx.toast(if (ok) "تم إلغاء الطلب" else "تعذر الإلغاء") } },
            onDismiss = { cancelId = null })
    }
}

// ───────────────────────── الإشعارات ─────────────────────────
@Composable
fun InboxScreen(nav: NavController, vm: AppViewModel) {
    val items by vm.inbox.collectAsStateWithLifecycle()
    // نعلّم الرسائل كمقروءة عند مغادرة الشاشة حتى يرى المستخدم ما هو جديد
    DisposableEffect(Unit) { onDispose { vm.markInboxRead() } }

    SubScaffold("الإشعارات", { nav.popBackStack() }) { pad ->
        Box(Modifier.padding(pad)) {
            if (items.isEmpty()) {
                EmptyState("🔔", "لا توجد إشعارات", "ستصلك هنا نتيجة مراجعة طلباتك")
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(items, key = { it.id }) { n ->
                        Surface(
                            shape = MaterialTheme.shapes.large,
                            color = if (n.read) MaterialTheme.colorScheme.surfaceContainerLowest else MaterialTheme.colorScheme.primaryContainer,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(n.title, style = MaterialTheme.typography.titleMedium)
                                if (n.body.isNotBlank()) Text(n.body, style = MaterialTheme.typography.bodyMedium)
                                val d = formatDate(n.createdAt)
                                if (d.isNotEmpty()) Text(d, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}
