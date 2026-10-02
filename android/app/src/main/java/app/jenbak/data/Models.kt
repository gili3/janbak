package app.jenbak.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * الأقسام تُدار بالكامل من لوحة الإدارة (مجموعة sections في Firestore) وتُحمَّل في SectionStore.
 * لا توجد أقسام ثابتة داخل التطبيق: القائمة فارغة حتى تصل من الخادم (أو من الذاكرة المحلية).
 */
data class Section(
    val key: String,
    val title: String,
    val tint: Color,
    val examples: String,
    val image: String = "",
    val order: Long = 0
)

object SectionStore {
    /** حالة Compose: أي شاشة تقرأ SECTIONS تُحدَّث تلقائياً عند تغيير الأقسام من اللوحة */
    var all: List<Section> by mutableStateOf(emptyList())
}

val SECTIONS: List<Section> get() = SectionStore.all

fun sectionOf(key: String): Section? = SECTIONS.firstOrNull { it.key == key }

/** يحوّل #RRGGBB إلى لون، وإلا يرجع اللون الاحتياطي */
fun parseHexColor(hex: String, fallback: Color = Color.Gray): Color {
    val h = hex.trim().removePrefix("#")
    if (h.length != 6) return fallback
    val v = h.toLongOrNull(16) ?: return fallback
    return Color((0xFF000000L or v).toInt())
}

/** نصوص الشاشة الرئيسية القابلة للتعديل من اللوحة (settings/app) */
data class AppSettings(
    val tagline: String = "كل ما تحتاجه في قريتك، جنبك.",
    val searchHint: String = "ابحث عن محل أو مهنة أو خدمة",
    val addTitle: String = "عندك نشاط أو خدمة؟",
    val addBody: String = "أضفه مجاناً ليصل إليه أهل قريتك. يُراجع طلبك من الإدارة قبل ظهوره."
)

/** المستخدم الحالي: ضيف (مجهول) أو حساب جوجل */
data class Me(val uid: String, val isGuest: Boolean, val name: String, val email: String)

enum class Load { Loading, Ready, Failed }

data class Place(
    val id: String,
    val name: String,
    val section: String,
    val services: String,
    val address: String,
    val hours: String,
    val phone: String,
    val whatsapp: String,
    val status: String,
    val ownerUid: String,
    val createdAt: Long,
    /** صورة مصغّرة (data URL) من اللوحة، اختيارية */
    val image: String = ""
) {
    /** نص بحث مُطبَّع يُحسب مرة واحدة عند كل تحديث للبيانات */
    val searchText: String =
        normalizeAr("$name $services $address ${sectionOf(section)?.title ?: ""}")
    val normName: String = normalizeAr(name)
}

/** بيانات نموذج الإضافة/التعديل */
data class Draft(
    val name: String = "",
    val section: String = "",
    val services: String = "",
    val address: String = "",
    val hours: String = "",
    val phone: String = "",
    val whatsapp: String = ""
)

/** ينظّف بيانات النموذج ويتحقق منها (كانت تُنفَّذ في دالة submitRequest سابقاً) */
fun cleanDraft(d: Draft): Draft {
    fun one(v: String, max: Int) = v.replace(Regex("\\s+"), " ").trim().take(max)
    fun multi(v: String, max: Int) =
        v.replace(Regex("[ \\t]+"), " ").replace(Regex("\\n{3,}"), "\n\n").trim().take(max)
    val out = Draft(
        name = one(d.name, 100), section = d.section,
        services = multi(d.services, 500), address = one(d.address, 200), hours = one(d.hours, 100),
        phone = Phone.latin(d.phone), whatsapp = Phone.latin(d.whatsapp)
    )
    if (out.name.isEmpty()) throw AppException("اسم النشاط مطلوب")
    if (SECTIONS.none { it.key == out.section }) throw AppException("اختر القسم")
    if (!Phone.valid(out.phone)) throw AppException("رقم الهاتف يجب أن يبدأ بـ 0 ويتبعه 9 أرقام")
    if (out.whatsapp.isNotEmpty() && !Phone.valid(out.whatsapp)) throw AppException("رقم الواتساب غير صالح")
    return out
}

fun Place.toDraft() = Draft(name, section, services, address, hours, phone, whatsapp)

data class Announcement(
    val id: String,
    val title: String,
    val body: String,
    val pinned: Boolean,
    val createdAt: Long,
    val expiresAt: Long = 0L,
    /** صورة الإعلان (data URL) من اللوحة، اختيارية */
    val image: String = ""
)

data class MyRequest(
    val id: String,
    val kind: String,
    val placeId: String,
    val status: String,
    val rejectReason: String,
    val createdAt: Long,
    val draft: Draft
)

data class InboxItem(
    val id: String,
    val title: String,
    val body: String,
    val type: String,
    val read: Boolean,
    val createdAt: Long
)

// ───────────────────────── الهاتف ─────────────────────────
/** أرقام سودانية: 0 ثم 9 أرقام، وتُرسل إلى فايربيس بصيغة +249 */
object Phone {
    fun latin(s: String): String = buildString {
        for (c in s) {
            if (Character.isDigit(c)) append(Character.forDigit(Character.digit(c, 10), 10))
        }
    }

    fun valid(s: String) = Regex("^0[0-9]{9}$").matches(s)
    fun e164(s: String) = "+249" + s.drop(1)
    fun intl(n: String): String {
        val d = latin(n)
        return when {
            d.startsWith("249") -> d
            d.startsWith("0") -> "249" + d.drop(1)
            else -> "249$d"
        }
    }
}

// ───────────────────────── البحث العربي ─────────────────────────
/** يوحّد الهمزات والتاء المربوطة والياء ويحذف التشكيل والتطويل ويحوّل الأرقام العربية */
fun normalizeAr(s: String): String {
    val sb = StringBuilder(s.length)
    for (ch in s) {
        when (ch) {
            in '\u064B'..'\u065F', '\u0670', '\u0640' -> Unit
            'أ', 'إ', 'آ', 'ٱ' -> sb.append('ا')
            'ى', 'ئ' -> sb.append('ي')
            'ة' -> sb.append('ه')
            'ؤ' -> sb.append('و')
            in '٠'..'٩' -> sb.append('0' + (ch - '٠'))
            in '۰'..'۹' -> sb.append('0' + (ch - '۰'))
            else -> sb.append(ch.lowercaseChar())
        }
    }
    return sb.toString().replace(Regex("\\s+"), " ").trim()
}

private fun relevance(p: Place, tokens: List<String>): Int {
    var score = 0
    for (t in tokens) {
        score += when {
            p.normName.startsWith(t) -> 4
            p.normName.contains(t) -> 3
            else -> 1
        }
    }
    return score
}

/** كل كلمات الاستعلام يجب أن تظهر؛ وترتيب النتائج بحسب مطابقة الاسم أولاً */
fun searchPlaces(all: List<Place>, query: String, section: String?): List<Place> {
    val tokens = normalizeAr(query).split(" ").filter { it.isNotEmpty() }
    val pool = if (section == null) all else all.filter { it.section == section }
    if (tokens.isEmpty()) return pool.sortedBy { it.normName }
    return pool
        .filter { p -> tokens.all { p.searchText.contains(it) } }
        .sortedWith(compareByDescending<Place> { relevance(it, tokens) }.thenBy { it.normName })
}

fun formatDate(ms: Long): String =
    if (ms <= 0) "" else SimpleDateFormat("d MMMM yyyy", Locale("ar")).format(Date(ms))

fun statusLabel(s: String) = when (s) {
    "approved" -> "مقبول"
    "rejected" -> "مرفوض"
    "hidden" -> "مخفي"
    else -> "قيد المراجعة"
}
