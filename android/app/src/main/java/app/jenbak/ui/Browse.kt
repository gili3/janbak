package app.jenbak.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import app.jenbak.data.*

fun LazyListScope.placeItems(list: List<Place>, favs: Set<String>, nav: NavController) {
    items(list, key = { it.id }) { p ->
        Box(Modifier.padding(horizontal = 16.dp)) {
            PlaceCard(p, p.id in favs, { nav.navigate("place/${p.id}") }, { Prefs.toggleFav(p.id) })
        }
    }
}

/** إضافة نشاط تتطلب تسجيل الدخول */
fun startAdd(nav: NavController, vm: AppViewModel) {
    val u = vm.user.value
    if (u == null || u.isGuest) nav.navigate("login") else nav.navigate("editor/new/-")
}

// ───────────────────────── الرئيسية ─────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(nav: NavController, vm: AppViewModel, unread: Int) {
    val places by vm.places.collectAsStateWithLifecycle()
    val news by vm.news.collectAsStateWithLifecycle()
    val cfg by vm.settings.collectAsStateWithLifecycle()
    val feed by vm.feed.collectAsStateWithLifecycle()
    val favs by Prefs.favs.collectAsStateWithLifecycle()
    var q by rememberSaveable { mutableStateOf("") }
    var secTitle by rememberSaveable { mutableStateOf<String?>(null) }
    val searching = q.isNotBlank()
    val secKey = SECTIONS.firstOrNull { it.title == secTitle }?.key
    val results = remember(places, q, secKey) { if (q.isBlank()) emptyList() else searchPlaces(places, q, secKey) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("جنبك", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton({ nav.navigate("news") }) { Icon(Icons.Filled.Notifications, contentDescription = "الإعلانات") }
                }
            )
        },
        bottomBar = { MainBar(nav, "home", unread) }
    ) { pad ->
        Column(Modifier.padding(pad)) {
            // شريط البحث: هو البحث الوحيد في التطبيق، ويعرض النتائج هنا مباشرة
            OutlinedTextField(
                value = q, onValueChange = { q = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                placeholder = { Text(cfg.searchHint) },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                trailingIcon = { if (q.isNotEmpty()) IconButton({ q = ""; secTitle = null }) { Icon(Icons.Filled.Close, "مسح") } },
                singleLine = true,
                shape = MaterialTheme.shapes.large
            )
            Spacer(Modifier.height(8.dp))
            if (searching) {
                ChipRow(SECTIONS.map { it.title }, secTitle) { secTitle = it }
                Spacer(Modifier.height(8.dp))
            }
            LoadGate(feed, vm::loadFeed) {
                if (searching) {
                    if (results.isEmpty()) {
                        EmptyState("🤷", "لا توجد نتائج", "جرّب كلمة أخرى")
                    } else {
                        LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            item { Text("${results.size} نتيجة", Modifier.padding(horizontal = 16.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            placeItems(results, favs, nav)
                        }
                    }
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        item {
                            Text(
                                cfg.tagline,
                                style = MaterialTheme.typography.headlineSmall,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                        }
                        if (news.isNotEmpty()) {
                            item {
                                Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text("الإعلانات", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                                    if (news.size > 1) TextButton({ nav.navigate("news") }) { Text("عرض الكل") }
                                }
                            }
                            item {
                                if (news.size == 1) {
                                    AnnouncementCard(news[0], Modifier.padding(horizontal = 16.dp).fillMaxWidth(), compact = true) { nav.navigate("news/${news[0].id}") }
                                } else {
                                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        items(news.take(6), key = { it.id }) { n ->
                                            AnnouncementCard(n, Modifier.width(300.dp), compact = true) { nav.navigate("news/${n.id}") }
                                        }
                                    }
                                }
                            }
                        }
                        if (SECTIONS.isEmpty()) {
                            item {
                                Box(Modifier.fillMaxWidth().height(220.dp)) {
                                    EmptyState("🗂️", "لا توجد أقسام بعد", "ستظهر الأقسام هنا فور إضافتها من الإدارة")
                                }
                            }
                        }
                        item {
                            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                SECTIONS.chunked(2).forEach { row ->
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        row.forEach { s ->
                                            SectionTile(s, Modifier.weight(1f)) { nav.navigate("section/${s.key}") }
                                        }
                                        if (row.size == 1) Spacer(Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** بطاقة قسم: صورة مربعة 1×1 ثم الاسم */
@Composable
private fun SectionTile(s: Section, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = modifier
    ) {
        val cover = rememberDataImage(s.image)
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(12.dp)).background(s.tint.copy(alpha = 0.14f)),
                Alignment.Center
            ) {
                if (cover != null) DataImage(cover, Modifier.fillMaxSize())
                else SectionBadge(s.key, 56)
            }
            Text(s.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 2.dp))
        }
    }
}

// ───────────────────────── قسم ─────────────────────────
@Composable
fun SectionScreen(nav: NavController, vm: AppViewModel, key: String) {
    val s = sectionOf(key)
    if (s == null) { LaunchedEffect(Unit) { nav.popBackStack() }; return }
    val places by vm.places.collectAsStateWithLifecycle()
    val feed by vm.feed.collectAsStateWithLifecycle()
    val favs by Prefs.favs.collectAsStateWithLifecycle()
    var newest by rememberSaveable { mutableStateOf(false) }

    val inSection = remember(places, key) { places.filter { it.section == key } }
    val shown = remember(inSection, newest) {
        if (newest) inSection.sortedByDescending { it.createdAt } else inSection.sortedBy { it.normName }
    }

    SubScaffold(s.title, { nav.popBackStack() }) { pad ->
        LoadGate(feed, vm::loadFeed) {
            Column(Modifier.padding(pad)) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${shown.size} نتيجة", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                    TextButton({ newest = !newest }) { Text(if (newest) "الترتيب: الأحدث" else "الترتيب: الاسم") }
                }
                if (shown.isEmpty()) {
                    EmptyState("🔍", "لا توجد أنشطة هنا بعد", s.examples.takeIf { it.isNotBlank() }?.let { "مثال: $it" } ?: "", "أضف نشاطك") { startAdd(nav, vm) }
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        placeItems(shown, favs, nav)
                    }
                }
            }
        }
    }
}

// ───────────────────────── المفضلة ─────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesScreen(nav: NavController, vm: AppViewModel, unread: Int) {
    val places by vm.places.collectAsStateWithLifecycle()
    val feed by vm.feed.collectAsStateWithLifecycle()
    val favs by Prefs.favs.collectAsStateWithLifecycle()
    val list = remember(places, favs) { places.filter { it.id in favs }.sortedBy { it.normName } }

    Scaffold(
        topBar = { TopAppBar(title = { Text("المفضلة", fontWeight = FontWeight.Bold) }) },
        bottomBar = { MainBar(nav, "favs", unread) }
    ) { pad ->
        Box(Modifier.padding(pad)) {
            LoadGate(feed, vm::loadFeed) {
                if (list.isEmpty()) {
                    EmptyState("🤍", "لا توجد مفضلة بعد", "اضغط على القلب في أي نشاط لتجده هنا بسرعة")
                } else {
                    LazyColumn(contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        placeItems(list, favs, nav)
                    }
                }
            }
        }
    }
}

// ───────────────────────── الإعلانات ─────────────────────────
@Composable
fun NewsScreen(nav: NavController, vm: AppViewModel) {
    val news by vm.news.collectAsStateWithLifecycle()
    SubScaffold("الإعلانات", { nav.popBackStack() }) { pad ->
        Box(Modifier.padding(pad)) {
            if (news.isEmpty()) {
                EmptyState("📢", "لا توجد إعلانات", "ستظهر هنا إعلانات الإدارة")
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(news, key = { it.id }) { n -> AnnouncementCard(n, Modifier.fillMaxWidth()) { nav.navigate("news/${n.id}") } }
                }
            }
        }
    }
}

/** صفحة إعلان واحد: الصورة والنص كاملين وزر الرابط */
@Composable
fun AnnouncementScreen(nav: NavController, vm: AppViewModel, id: String) {
    val news by vm.news.collectAsStateWithLifecycle()
    val n = news.firstOrNull { it.id == id }
    SubScaffold("الإعلان", { nav.popBackStack() }) { pad ->
        Box(Modifier.padding(pad)) {
            if (n == null) {
                EmptyState("📢", "هذا الإعلان لم يعد متاحاً", "ربما انتهت مدته أو أُوقف من الإدارة", "كل الإعلانات") {
                    nav.navigate("news") { popUpTo("news/{id}") { inclusive = true } }
                }
            } else {
                LazyColumn(contentPadding = PaddingValues(16.dp)) {
                    item { AnnouncementCard(n, Modifier.fillMaxWidth()) }
                }
            }
        }
    }
}
