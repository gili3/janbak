package app.jenbak

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.jenbak.data.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

class AppViewModel(app: Application) : AndroidViewModel(app) {
    // بيانات عامة
    val places = MutableStateFlow<List<Place>>(emptyList())
    val news = MutableStateFlow<List<Announcement>>(emptyList())
    val feed = MutableStateFlow(Load.Loading)

    /** هل الإنترنت يعمل فعلاً؟ يُعرض شريط تنبيه عند انقطاعه لأن البيانات حينها من الذاكرة المحلية */
    val online = Net.online

    // بيانات المستخدم الحالي
    /** null = لم يسجّل الدخول بعد (شاشة الترحيب)، وإلا ضيف أو حساب جوجل */
    val user = MutableStateFlow(Firebase.auth.currentUser.toMe())
    val settings = MutableStateFlow(AppSettings())
    val myPlaces = MutableStateFlow<List<Place>>(emptyList())

    private var feedJob: Job? = null
    private var userJob: Job? = null

    private val authListener = FirebaseAuth.AuthStateListener { a ->
        user.value = a.currentUser.toMe()
        watchUser(user.value)
    }

    /** بعد ربط حساب الضيف بجوجل لا يتغير المعرّف فلا يُطلق المستمع، فنحدّث الحالة يدوياً */
    fun refreshUser() {
        user.value = Firebase.auth.currentUser.toMe()
    }

    init {
        loadFeed()
        Firebase.auth.addAuthStateListener(authListener)
    }

    override fun onCleared() {
        Firebase.auth.removeAuthStateListener(authListener)
    }

    fun loadFeed() {
        feedJob?.cancel()
        feed.value = Load.Loading
        feedJob = viewModelScope.launch {
            launch {
                Repo.places().catch { feed.value = Load.Failed }.collect { s ->
                    places.value = s.items
                    // قائمة فارغة من الذاكرة المحلية = لا اتصال ولا بيانات مخزنة
                    feed.value = if (s.items.isEmpty() && s.fromCache) Load.Failed else Load.Ready
                }
            }
            launch {
                Repo.sections().catch { }.collect { s ->
                    SectionStore.all = s.items.sortedWith(compareBy({ it.order }, { it.title }))
                }
            }
            launch { Repo.settings().catch { }.collect { settings.value = it } }
            launch {
                Repo.announcements().catch { }.collect { s ->
                    val now = System.currentTimeMillis()
                    news.value = s.items.filter { it.expiresAt == 0L || it.expiresAt > now }.sortedWith(
                        compareByDescending<Announcement> { it.pinned }.thenByDescending { it.createdAt }
                    )
                }
            }
        }
    }

    private fun watchUser(u: Me?) {
        userJob?.cancel()
        if (u == null) {
            myPlaces.value = emptyList()
            return
        }
        userJob = viewModelScope.launch {
            launch { Repo.myPlaces(u.uid).catch { }.collect { myPlaces.value = it.items } }
        }
    }

    fun placeById(id: String): Place? =
        places.value.firstOrNull { it.id == id } ?: myPlaces.value.firstOrNull { it.id == id }

    fun signOut() {
        Firebase.auth.signOut()
    }

    fun deleteAccount(onResult: (String?) -> Unit) {
        viewModelScope.launch {
            val r = runCatching { Repo.deleteAccount() }
            if (r.isSuccess) {
                Firebase.auth.signOut()
                onResult(null)
            } else {
                onResult(r.exceptionOrNull()?.userMessage() ?: "تعذر تنفيذ العملية")
            }
        }
    }
}
