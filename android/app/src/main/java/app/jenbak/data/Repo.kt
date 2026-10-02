package app.jenbak.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.AggregateSource
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private const val MAX_PENDING_PER_USER = 5
private const val MAX_REQUESTS_PER_DAY = 10
/** مهلة العمليات التي تنتظر الخادم؛ بدونها تعلق الكتابة للأبد عند انقطاع الإنترنت */
private const val NET_TIMEOUT_MS = 15_000L

/** نتيجة مراقبة لحظية؛ fromCache = جاءت من الذاكرة المحلية بلا اتصال بالخادم */
data class Snap<T>(val items: List<T>, val fromCache: Boolean)

object Repo {
    private val db get() = Firebase.firestore

    private fun <T> Query.watch(map: (DocumentSnapshot) -> T?): Flow<Snap<T>> = callbackFlow {
        val reg = addSnapshotListener { s, e ->
            if (e != null) {
                close(e)
                return@addSnapshotListener
            }
            if (s != null) trySend(Snap(s.documents.mapNotNull(map), s.metadata.isFromCache))
        }
        awaitClose { reg.remove() }
    }

    fun places() = db.collection("places").whereEqualTo("status", "approved").watch { it.toPlace() }
    fun sections() = db.collection("sections").watch { it.toSection() }

    /** نصوص الشاشة الرئيسية من settings/app؛ القيم الناقصة تبقى افتراضية */
    fun settings(): Flow<AppSettings> = callbackFlow {
        val reg = db.collection("settings").document("app").addSnapshotListener { s, e ->
            if (e != null) { close(e); return@addSnapshotListener }
            val d = AppSettings()
            if (s != null && s.exists()) {
                fun v(k: String, def: String) = (s.get(k) as? String)?.takeIf { it.isNotBlank() } ?: def
                trySend(AppSettings(v("tagline", d.tagline), v("searchHint", d.searchHint)))
            } else trySend(d)
        }
        awaitClose { reg.remove() }
    }
    fun announcements() = db.collection("announcements").whereEqualTo("active", true).watch { it.toAnnouncement() }
    fun myPlaces(uid: String) = db.collection("places").whereEqualTo("ownerUid", uid).watch { it.toPlace() }
    fun myRequests(uid: String) = db.collection("requests").whereEqualTo("ownerUid", uid).watch { it.toRequest() }
    fun inbox(uid: String) = db.collection("inbox").document(uid).collection("items").watch { it.toInbox() }

    private fun requireOnline() {
        if (!Net.check()) throw AppException("لا يوجد اتصال بالإنترنت، حاول عند توفره")
    }

    /**
     * إرسال طلب إضافة (new) أو تعديل (edit): نفس فحوصات الدالة القديمة تُنفَّذ هنا
     * (تنظيف + حد الطلبات المعلّقة + الحد اليومي + منع التكرار) وقواعد Firestore تتحقق مجدداً في الخادم.
     */
    suspend fun submit(kind: String, placeId: String?, input: Draft) {
        requireOnline()
        val user = Firebase.auth.currentUser ?: throw AppException("سجّل الدخول أولاً")
        if (user.isAnonymous) throw AppException("سجّل الدخول بحساب جوجل لإرسال الطلبات")
        val uid = user.uid
        val d = cleanDraft(input)
        try {
            withTimeout(NET_TIMEOUT_MS) {
                val requests = db.collection("requests")
                val pending = requests.whereEqualTo("ownerUid", uid).whereEqualTo("status", "pending")
                    .count().get(AggregateSource.SERVER).await().count
                if (pending >= MAX_PENDING_PER_USER)
                    throw AppException("لديك $MAX_PENDING_PER_USER طلبات قيد المراجعة، انتظر نتيجتها أولاً")

                val since = Timestamp(Date(System.currentTimeMillis() - 24L * 3600 * 1000))
                val recent = requests.whereEqualTo("ownerUid", uid).whereGreaterThanOrEqualTo("createdAt", since)
                    .count().get(AggregateSource.SERVER).await().count
                if (recent >= MAX_REQUESTS_PER_DAY) throw AppException("وصلت للحد اليومي من الطلبات، حاول غداً")

                if (kind == "edit") {
                    if (placeId.isNullOrEmpty()) throw AppException("النشاط المراد تعديله غير محدد")
                    val dup = requests.whereEqualTo("placeId", placeId).whereEqualTo("status", "pending").limit(1).get().await()
                    if (!dup.isEmpty) throw AppException("يوجد طلب تعديل قيد المراجعة لهذا النشاط")
                }

                // منع تكرار نفس النشاط (نفس الهاتف والاسم) بين الأنشطة المنشورة
                val same = db.collection("places").whereEqualTo("status", "approved").whereEqualTo("phone", d.phone)
                    .limit(10).get().await()
                val mine = normalizeAr(d.name).replace(" ", "")
                if (same.documents.any { it.id != placeId && normalizeAr(it.str("name")).replace(" ", "") == mine })
                    throw AppException("هذا النشاط موجود مسبقاً في الدليل")

                val data = hashMapOf<String, Any?>(
                    "kind" to kind, "placeId" to (if (kind == "edit") placeId else null),
                    "name" to d.name, "section" to d.section, "services" to d.services,
                    "address" to d.address, "hours" to d.hours, "phone" to d.phone, "whatsapp" to d.whatsapp,
                    "status" to "pending", "ownerUid" to uid,
                    "ownerEmail" to (user.email ?: ""), "ownerName" to (user.displayName ?: "").take(100),
                    "createdAt" to FieldValue.serverTimestamp()
                )
                requests.add(data).await()
            }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            throw AppException("انتهت مهلة الاتصال، تحقق من الإنترنت وحاول مرة أخرى")
        }
    }

    suspend fun cancelRequest(id: String) {
        db.collection("requests").document(id).delete().await()
    }

    suspend fun markInboxRead(uid: String, ids: List<String>) {
        if (ids.isEmpty()) return
        val batch = db.batch()
        val col = db.collection("inbox").document(uid).collection("items")
        ids.forEach { batch.update(col.document(it), "read", true) }
        batch.commit().await()
    }

    suspend fun saveToken(uid: String, token: String) {
        db.collection("users").document(uid).set(
            mapOf("fcmToken" to token, "platform" to "android", "updatedAt" to FieldValue.serverTimestamp()),
            SetOptions.merge()
        ).await()
    }

    suspend fun clearToken(uid: String) {
        db.collection("users").document(uid).set(
            mapOf("fcmToken" to FieldValue.delete(), "updatedAt" to FieldValue.serverTimestamp()),
            SetOptions.merge()
        ).await()
    }

    /** إحصائية مجهولة لضغطة اتصال/واتساب؛ تفشل بصمت ولا تؤثر على المستخدم، ولا تُرسل بلا إنترنت */
    fun track(placeId: String, type: String) {
        val field = when (type) { "whatsapp" -> "whatsapp"; "call" -> "calls"; else -> return }
        if (placeId.isEmpty() || !Net.check()) return
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())
                val inc = FieldValue.increment(1)
                withTimeout(NET_TIMEOUT_MS) {
                    db.batch()
                        .set(db.collection("stats").document(placeId), mapOf(field to inc, "updatedAt" to FieldValue.serverTimestamp()), SetOptions.merge())
                        .set(db.collection("statsDaily").document(day), mapOf(field to inc), SetOptions.merge())
                        .commit().await()
                }
            }
        }
    }

    /** يحذف بيانات المستخدم ثم حسابه (متطلب Google Play). كان دالة deleteAccount */
    suspend fun deleteAccount() {
        requireOnline()
        val user = Firebase.auth.currentUser ?: throw AppException("سجّل الدخول أولاً")
        val uid = user.uid
        try {
            withTimeout(60_000L) {
                if (db.collection("admins").document(uid).get().await().exists())
                    throw AppException("لا يمكن حذف حساب مدير من التطبيق")
                for (col in listOf("requests", "places")) {
                    val snap = db.collection(col).whereEqualTo("ownerUid", uid).get().await()
                    snap.documents.chunked(400).forEach { chunk ->
                        val b = db.batch()
                        chunk.forEach { b.delete(it.reference) }
                        b.commit().await()
                    }
                }
                val inbox = db.collection("inbox").document(uid).collection("items").get().await()
                inbox.documents.chunked(400).forEach { chunk ->
                    val b = db.batch()
                    chunk.forEach { b.delete(it.reference) }
                    b.commit().await()
                }
                db.collection("users").document(uid).delete().await()
                user.delete().await()
            }
        } catch (e: FirebaseAuthRecentLoginRequiredException) {
            throw AppException("لأسباب أمنية سجّل الخروج ثم الدخول مجدداً وكرّر الحذف")
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            throw AppException("انتهت مهلة الاتصال، تحقق من الإنترنت وحاول مرة أخرى")
        }
    }
}

/** رسالة عربية مفهومة للمستخدم من أي خطأ */
fun Throwable.userMessage(): String = when (this) {
    is AppException -> message ?: "تعذر تنفيذ العملية"
    is FirebaseFirestoreException -> when (code) {
        FirebaseFirestoreException.Code.UNAVAILABLE,
        FirebaseFirestoreException.Code.DEADLINE_EXCEEDED -> "تعذر الاتصال، تحقق من الإنترنت"
        FirebaseFirestoreException.Code.PERMISSION_DENIED -> "لا تملك صلاحية هذه العملية"
        else -> "حدث خطأ غير متوقع، حاول لاحقاً"
    }
    else -> "تعذر تنفيذ العملية، تحقق من الإنترنت"
}

// ───────────────────────── تحويل المستندات (يدوي، آمن مع R8) ─────────────────────────
private fun DocumentSnapshot.str(k: String): String = (get(k) as? String) ?: ""

private fun DocumentSnapshot.millis(k: String): Long =
    when (val v = get(k, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)) {
        is Timestamp -> v.toDate().time
        is Number -> v.toLong()
        else -> 0L
    }

private fun DocumentSnapshot.toPlace(): Place? {
    val name = str("name")
    if (name.isBlank()) return null
    return Place(
        id, name, str("section"), str("services"), str("address"), str("hours"),
        str("phone"), str("whatsapp"), str("status"), str("ownerUid"), millis("createdAt"), str("image")
    )
}

private fun DocumentSnapshot.toSection(): Section? {
    val title = str("title")
    if (title.isBlank()) return null
    if ((get("active") as? Boolean) == false) return null // القسم المخفي لا يظهر في التطبيق
    return Section(
        key = id,
        title = title,
        tint = parseHexColor(str("color")),
        examples = str("examples"),
        image = str("image"),
        order = (get("order") as? Number)?.toLong() ?: 0L
    )
}

private fun DocumentSnapshot.toAnnouncement(): Announcement? {
    val title = str("title")
    if (title.isBlank()) return null
    return Announcement(id, title, str("body"), (get("pinned") as? Boolean) == true, millis("createdAt"), millis("expiresAt"), str("image"), str("link"))
}

private fun DocumentSnapshot.toRequest() = MyRequest(
    id = id,
    kind = str("kind").ifEmpty { "new" },
    placeId = str("placeId"),
    status = str("status").ifEmpty { "pending" },
    rejectReason = str("rejectReason"),
    createdAt = millis("createdAt"),
    draft = Draft(
        str("name"), str("section"), str("services"),
        str("address"), str("hours"), str("phone"), str("whatsapp")
    )
)

private fun DocumentSnapshot.toInbox() = InboxItem(
    id, str("title"), str("body"), str("type"), (get("read") as? Boolean) == true, millis("createdAt")
)
