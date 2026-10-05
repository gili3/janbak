package app.jenbak.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** إعدادات محلية: المفضلة والمظهر */
object Prefs {
    private lateinit var sp: SharedPreferences
    private val _favs = MutableStateFlow<Set<String>>(emptySet())
    private val _theme = MutableStateFlow(0)

    val favs: StateFlow<Set<String>> = _favs

    /** 0 حسب النظام، 1 فاتح، 2 داكن */
    val theme: StateFlow<Int> = _theme

    fun init(ctx: Context) {
        sp = ctx.getSharedPreferences("jenbak", Context.MODE_PRIVATE)
        _favs.value = sp.getStringSet("favs", emptySet())?.toSet() ?: emptySet()
        _theme.value = sp.getInt("theme", 0)
    }

    fun toggleFav(id: String) {
        val n = _favs.value.toMutableSet()
        if (!n.add(id)) n.remove(id)
        _favs.value = n
        sp.edit().putStringSet("favs", HashSet(n)).apply()
    }

    fun setTheme(v: Int) {
        _theme.value = v
        sp.edit().putInt("theme", v).apply()
    }
}
