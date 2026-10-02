package app.jenbak.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** حالة الاتصال الفعلية بالإنترنت (وليس مجرد وجود شبكة واي فاي بلا إنترنت) */
object Net {
    private val _online = MutableStateFlow(true)
    val online: StateFlow<Boolean> = _online

    private lateinit var cm: ConnectivityManager

    fun init(ctx: Context) {
        cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        _online.value = check()
        cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { _online.value = check() }
            override fun onLost(network: Network) { _online.value = check() }
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                _online.value = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            }
        })
    }

    /** VALIDATED = النظام تأكد فعلاً أن الإنترنت يعمل عبر هذه الشبكة */
    fun check(): Boolean {
        val caps = cm.getNetworkCapabilities(cm.activeNetwork ?: return false) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}

/** خطأ مفهوم للمستخدم يُعرض كما هو */
class AppException(message: String) : Exception(message)
