package app.jenbak.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.ui.text.style.TextOverflow
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
    val cs = MaterialTheme.colorScheme
    val user by vm.user.collectAsStateWithLifecycle()
    val mine by vm.myPlaces.collectAsStateWithLifecycle()
    val theme by Prefs.theme.collectAsStateWithLifecycle()
    val newsPush by Prefs.newsPush.collectAsStateWithLifecycle()
    var confirmOut by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    val version = remember { runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: "" }

    val drawer = rememberDrawerState(DrawerValue.Closed)

    SideMenu(nav, vm, drawer) {
    Scaffold(
        topBar = { TopAppBar(title = { Text("حسابي", fontWeight = FontWeight.Bold) }, navigationIcon = { MenuButton(drawer) }) },
        bottomBar = { MainBar(nav, "account", unread) }
    ) { pad ->
        Column(
            Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            val u = user
            val signedIn = u != null && !u.isGuest

            // ── بطاقة الحساب ──
            if (!signedIn) {
                Surface(shape = MaterialTheme.shapes.extraLarge, color = cs.primaryContainer, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("أنت تتصفح كضيف", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = cs.onPrimaryContainer)
                        Text(
                            "سجّل الدخول بحساب جوجل لإضافة نشاطك من القائمة الجانبية ومتابعة طلباتك واستلام الإشعارات.",
                            style = MaterialTheme.typography.bodyMedium, color = cs.onPrimaryContainer
                        )
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
                        Box(Modifier.size(56.dp).clip(CircleShape).background(cs.primary), Alignment.Center) {
                            Text(name.take(1), fontSize = 24.sp, fontWeight = FontWeight.Bold, color = cs.onPrimary)
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (u.name.isNotBlank() && u.email.isNotBlank()) {
                                Text(u.email, style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text("حساب جوجل", style = MaterialTheme.typography.labelSmall, color = cs.outline)
                        }
                    }
                }
            }

            // ── قوائمي ──
            if (signedIn) {
                GroupCard {
                    MenuRow("🏪", "أنشطتي", mine.size.takeIf { it > 0 }?.toString()) { nav.navigate("myplaces") }
                    HorizontalDivider(color = cs.outlineVariant)
                    MenuRow("🔔", "الإشعارات", unread.takeIf { it > 0 }?.toString()) { nav.navigate("inbox") }
                }
            }

            // ── الإعدادات ──
            Text("الإعدادات", style = MaterialTheme.typography.titleSmall, color = cs.onSurfaceVariant, modifier = Modifier.padding(horizontal = 4.dp))
            GroupCard {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("المظهر", style = MaterialTheme.typography.bodyLarge)
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
                }
                HorizontalDivider(color = cs.outlineVariant)
                Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("إشعارات الإعلانات", style = MaterialTheme.typography.bodyLarge)
                        Text("تنبيه عند نشر إعلان جديد", style = MaterialTheme.typography.bodySmall, color = cs.onSurfaceVariant)
                    }
                    Switch(newsPush, { vm.setNewsPush(it) })
                }
            }

            // ── الخروج والحذف ──
            if (signedIn) {
                OutlinedButton({ confirmOut = true }, Modifier.fillMaxWidth()) { Text("تسجيل الخروج") }
                TextButton(
                    { confirmDelete = true }, Modifier.align(Alignment.CenterHorizontally),
                    enabled = !deleting,
                    colors = ButtonDefaults.textButtonColors(contentColor = cs.error)
                ) { Text(if (deleting) "جارٍ الحذف..." else "حذف حسابي وبياناتي") }
            }
            Text(
                "جنبك $version", Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp),
                style = MaterialTheme.typography.bodySmall, color = cs.outline
            )
        }
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

/** مجموعة صفوف داخل بطاقة واحدة */
@Composable
private fun GroupCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) { Column(content = content) }
}

@Composable
private fun MenuRow(emoji: String, title: String, trailing: String?, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(emoji, fontSize = 20.sp)
        Spacer(Modifier.width(12.dp))
        Text(title, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        if (trailing != null) {
            Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primary) {
                Text(
                    trailing, Modifier.padding(horizontal = 10.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimary
                )
            }
            Spacer(Modifier.width(8.dp))
        }
        Icon(Icons.Filled.KeyboardArrowLeft, null, tint = MaterialTheme.colorScheme.outline)
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
                EmptyState("🏪", "لا توجد أنشطة بعد", "الأنشطة المقبولة تظهر هنا ويمكنك اقتراح تعديل عليها")
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
                EmptyState("📋", "لم ترسل أي طلب بعد", "ستظهر هنا حالة كل طلب ترسله")
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
