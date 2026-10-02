package app.jenbak

import android.app.Application
import app.jenbak.data.Net
import app.jenbak.data.Prefs
import com.google.firebase.messaging.FirebaseMessaging

class JenbakApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        Net.init(this)
        ensureChannel(this)
        if (Prefs.newsPush.value) FirebaseMessaging.getInstance().subscribeToTopic("all")
    }
}
