package app.jenbak

import android.app.Application
import app.jenbak.data.Net
import app.jenbak.data.Prefs

class JenbakApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
        Net.init(this)
    }
}
