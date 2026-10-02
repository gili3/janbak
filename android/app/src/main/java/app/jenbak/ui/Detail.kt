package app.jenbak.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import app.jenbak.data.*

@Composable
fun DetailScreen(nav: NavController, vm: AppViewModel, id: String) {
    val places by vm.places.collectAsStateWithLifecycle()
    val mine by vm.myPlaces.collectAsStateWithLifecycle()
    val user by vm.user.collectAsStateWithLifecycle()
    val favs by Prefs.favs.collectAsStateWithLifecycle()
    val feed by vm.feed.collectAsStateWithLifecycle()
    val p = places.firstOrNull { it.id == id } ?: mine.firstOrNull { it.id == id }
    val ctx = LocalContext.current

    SubScaffold(
        title = p?.name ?: "",
        onBack = { nav.popBackStack() },
        actions = {
            if (p != null) {
                val fav = p.id in favs
                IconButton({ Prefs.toggleFav(p.id) }) {
                    Icon(
                        if (fav) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = if (fav) "إزالة من المفضلة" else "إضافة للمفضلة",
                        tint = if (fav) Color(0xFFE11D48) else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton({
                    val i = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, buildString {
                            append(p.name)
                            if (p.address.isNotBlank()) append("\n📍 ").append(p.address)
                            if (p.phone.isNotBlank()) append("\n📞 ").append(p.phone)
                            append("\n(عبر تطبيق جنبك)")
                        })
                    }
                    ctx.safeStart(Intent.createChooser(i, "مشاركة"))
                }) { Icon(Icons.Filled.Share, contentDescription = "مشاركة") }
            }
        }
    ) { pad ->
        if (p == null) {
            Box(Modifier.padding(pad)) {
                LoadGate(feed, vm::loadFeed) { EmptyState("🫥", "هذا النشاط غير متاح", "ربما تم حذفه أو إخفاؤه") }
            }
            return@SubScaffold
        }
        val section = sectionOf(p.section)
        Column(
            Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                PlaceAvatar(p, 64)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(p.name, style = MaterialTheme.typography.titleLarge)
                    val sub = section?.title.orEmpty()
                    Text(sub, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
                }
                if (p.status == "hidden") StatusChip("hidden")
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                if (p.phone.isNotBlank()) {
                    Button(
                        onClick = {
                            Repo.track(p.id, "call")
                            ctx.safeStart(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Phone.latin(p.phone)}")))
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.Call, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("اتصال")
                    }
                }
                if (p.whatsapp.isNotBlank()) {
                    FilledTonalButton(
                        onClick = {
                            Repo.track(p.id, "whatsapp")
                            ctx.safeStart(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${Phone.intl(p.whatsapp)}")))
                        },
                        modifier = Modifier.weight(1f)
                    ) { Text("واتساب") }
                }
            }

            Surface(
                shape = MaterialTheme.shapes.large,
                color = MaterialTheme.colorScheme.surfaceContainerLowest,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    InfoRow("🛎️", "الخدمات", p.services)
                    InfoRow("📍", "الموقع", p.address)
                    InfoRow("🕒", "ساعات العمل", p.hours)
                    InfoRow("📞", "الهاتف", Phone.latin(p.phone))
                    if (p.services.isBlank() && p.address.isBlank() && p.hours.isBlank() && p.phone.isBlank()) {
                        Text("لا توجد تفاصيل إضافية", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            if (user != null && p.ownerUid == user?.uid) {
                OutlinedButton({ nav.navigate("editor/edit/${p.id}") }, Modifier.fillMaxWidth()) {
                    Icon(Icons.Filled.Edit, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("اقتراح تعديل على نشاطي")
                }
            }
        }
    }
}

@Composable
private fun InfoRow(emoji: String, label: String, value: String) {
    if (value.isBlank()) return
    Row(verticalAlignment = Alignment.Top) {
        Text(emoji, fontSize = 20.sp)
        Spacer(Modifier.width(12.dp))
        Column {
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.bodyLarge)
        }
    }
}
