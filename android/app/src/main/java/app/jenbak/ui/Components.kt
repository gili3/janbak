package app.jenbak.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jenbak.data.Announcement
import app.jenbak.data.Load
import app.jenbak.data.Phone
import app.jenbak.data.Place
import app.jenbak.data.sectionOf
import app.jenbak.data.formatDate
import app.jenbak.data.statusLabel

fun Context.toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

/** يفتح تطبيقاً خارجياً دون أن ينهار التطبيق إن لم يوجد */
fun Context.safeStart(i: Intent) {
    try { startActivity(i) } catch (_: Exception) { toast("لا يوجد تطبيق مناسب") }
}

tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubScaffold(
    title: String,
    onBack: () -> Unit,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "رجوع") }
                },
                actions = actions
            )
        },
        content = content
    )
}

@Composable
fun EmptyState(
    emoji: String,
    title: String,
    body: String = "",
    actionLabel: String? = null,
    onAction: () -> Unit = {}
) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(emoji, fontSize = 44.sp)
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (body.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (actionLabel != null) {
            Spacer(Modifier.height(16.dp))
            FilledTonalButton(onAction) { Text(actionLabel) }
        }
    }
}

/** تحميل / خطأ مع إعادة المحاولة / المحتوى */
@Composable
fun LoadGate(state: Load, onRetry: () -> Unit, content: @Composable () -> Unit) {
    when (state) {
        Load.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        Load.Failed -> EmptyState("📡", "تعذر تحميل البيانات", "تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى", "إعادة المحاولة", onRetry)
        Load.Ready -> content()
    }
}

/** يفكّ صورة data URL (base64) المخزّنة في Firestore؛ null إن كانت غير صالحة */
fun decodeDataImage(data: String): ImageBitmap? {
    val b64 = data.substringAfter("base64,", "")
    if (b64.isEmpty()) return null
    return runCatching {
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
    }.getOrNull()
}

/** يفكّ الصورة مرة واحدة ويحفظ النتيجة عبر إعادة التركيب */
@Composable
fun rememberDataImage(data: String): ImageBitmap? = remember(data) { if (data.isBlank()) null else decodeDataImage(data) }

/** صورة من اللوحة (data URL). لا شيء يُرسم إن كانت فارغة أو تالفة */
@Composable
fun DataImage(bmp: ImageBitmap, modifier: Modifier = Modifier, scale: ContentScale = ContentScale.Crop) {
    Image(bmp, contentDescription = null, modifier = modifier, contentScale = scale)
}

@Composable
fun SectionBadge(sectionKey: String, size: Int = 44) {
    val s = sectionOf(sectionKey)
    val bmp = rememberDataImage(s?.image.orEmpty())
    Box(
        Modifier.size(size.dp).clip(CircleShape).background((s?.tint ?: Color.Gray).copy(alpha = 0.16f)),
        Alignment.Center
    ) {
        if (bmp != null) DataImage(bmp, Modifier.fillMaxSize())
        else Text(
            (s?.title ?: "؟").trim().take(1),
            fontSize = (size * 0.45f).sp, fontWeight = FontWeight.Bold, color = s?.tint ?: Color.Gray
        )
    }
}

/** صورة النشاط إن وُجدت، وإلا شارة قسمه */
@Composable
fun PlaceAvatar(place: Place, size: Int = 44) {
    val bmp = rememberDataImage(place.image)
    if (bmp != null) DataImage(bmp, Modifier.size(size.dp).clip(RoundedCornerShape((size / 4).dp)))
    else SectionBadge(place.section, size)
}

@Composable
fun PlaceCard(place: Place, fav: Boolean, onClick: () -> Unit, onFav: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainerLowest,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(Modifier.padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            PlaceAvatar(place)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(place.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val sub = listOf(sectionOf(place.section)?.title.orEmpty(), place.address).filter { it.isNotBlank() }.joinToString(" • ")
                if (sub.isNotEmpty()) {
                    Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (place.services.isNotBlank()) {
                    Text(place.services, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            IconButton(onFav) {
                Icon(
                    if (fav) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = if (fav) "إزالة من المفضلة" else "إضافة للمفضلة",
                    tint = if (fav) Color(0xFFE11D48) else MaterialTheme.colorScheme.outline
                )
            }
        }
    }
}

/** صف رقائق للتصفية: العنصر الأول «الكل» */
@Composable
fun ChipRow(options: List<String>, selected: String?, onSelect: (String?) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item { FilterChip(selected == null, { onSelect(null) }, { Text("الكل") }) }
        items(options) { o -> FilterChip(selected == o, { onSelect(if (selected == o) null else o) }, { Text(o) }) }
    }
}

@Composable
fun StatusChip(status: String) {
    val cs = MaterialTheme.colorScheme
    val (bg, fg) = when (status) {
        "approved" -> cs.primaryContainer to cs.onPrimaryContainer
        "rejected" -> cs.errorContainer to cs.onErrorContainer
        "hidden" -> cs.surfaceVariant to cs.onSurfaceVariant
        else -> cs.secondaryContainer to cs.onSecondaryContainer
    }
    Surface(shape = RoundedCornerShape(50), color = bg) {
        Text(statusLabel(status), Modifier.padding(horizontal = 10.dp, vertical = 3.dp), color = fg, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.titleMedium, modifier = modifier.padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
fun PhoneField(value: String, label: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    val bad = value.isNotEmpty() && !Phone.valid(value)
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(Phone.latin(it).take(10)) },
        modifier = modifier.fillMaxWidth(),
        label = { Text(label) },
        placeholder = { Text("0912345678") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        singleLine = true,
        isError = bad,
        supportingText = { if (bad) Text("يبدأ بـ 0 ويتبعه 9 أرقام") }
    )
}

@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmLabel: String,
    destructive: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = {
            TextButton(onConfirm, colors = if (destructive) ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error) else ButtonDefaults.textButtonColors()) {
                Text(confirmLabel)
            }
        },
        dismissButton = { TextButton(onDismiss) { Text("إلغاء") } }
    )
}


/**
 * بطاقة إعلان: صورة 16:9 (أو غلاف بديل)، شارة «مثبّت»، العنوان، النص، وتاريخ النشر/الانتهاء.
 * compact: للشاشة الرئيسية (عنوان سطران ونص سطران). غير ذلك: النص كاملاً.
 */
@Composable
fun AnnouncementCard(n: Announcement, modifier: Modifier = Modifier, compact: Boolean = false, onClick: (() -> Unit)? = null) {
    val cs = MaterialTheme.colorScheme
    val bmp = rememberDataImage(n.image)
    val ctx = LocalContext.current
    val link = n.link.trim().takeIf { it.startsWith("http://") || it.startsWith("https://") }
    val body: @Composable () -> Unit = {
        Column {
            Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(cs.primaryContainer), Alignment.Center) {
                if (bmp != null) DataImage(bmp, Modifier.fillMaxSize())
                else Icon(Icons.Filled.Notifications, null, Modifier.size(36.dp), tint = cs.onPrimaryContainer.copy(alpha = 0.6f))
                if (n.pinned) {
                    Surface(
                        shape = RoundedCornerShape(50), color = cs.tertiary, contentColor = cs.onTertiary,
                        modifier = Modifier.align(Alignment.TopStart).padding(10.dp)
                    ) {
                        Text("مثبّت", Modifier.padding(horizontal = 10.dp, vertical = 3.dp), style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
            Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    n.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold,
                    maxLines = if (compact) 2 else Int.MAX_VALUE, overflow = TextOverflow.Ellipsis
                )
                if (n.body.isNotBlank()) {
                    Text(
                        n.body, style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant,
                        maxLines = if (compact) 2 else Int.MAX_VALUE, overflow = TextOverflow.Ellipsis
                    )
                }
                if (link != null && !compact) {
                    FilledTonalButton({ ctx.safeStart(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }) { Text("فتح الرابط") }
                }
                val d = formatDate(n.createdAt)
                val e = formatDate(n.expiresAt)
                if (d.isNotEmpty() || e.isNotEmpty()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (d.isNotEmpty()) Text(d, style = MaterialTheme.typography.labelSmall, color = cs.outline)
                        if (e.isNotEmpty()) {
                            Surface(shape = RoundedCornerShape(50), color = cs.secondaryContainer) {
                                Text(
                                    "ينتهي $e", Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    style = MaterialTheme.typography.labelSmall, color = cs.onSecondaryContainer
                                )
                            }
                        }
                    }
                }
            }
        }
    }
    val border = BorderStroke(1.dp, cs.outlineVariant)
    if (onClick != null) {
        Surface(onClick = onClick, shape = MaterialTheme.shapes.large, color = cs.surfaceContainerLowest, border = border, modifier = modifier) { body() }
    } else {
        Surface(shape = MaterialTheme.shapes.large, color = cs.surfaceContainerLowest, border = border, modifier = modifier) { body() }
    }
}
