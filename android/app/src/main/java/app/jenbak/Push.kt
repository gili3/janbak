package app.jenbak

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import app.jenbak.data.Repo
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

const val CHANNEL = "jenbak_default"

fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT >= 26) {
        ctx.getSystemService(NotificationManager::class.java)
            .createNotificationChannel(NotificationChannel(CHANNEL, "إشعارات جنبك", NotificationManager.IMPORTANCE_HIGH))
    }
}

/** الإشعارات أثناء فتح التطبيق؛ في الخلفية يعرضها النظام تلقائياً */
class PushService : FirebaseMessagingService() {
    override fun onMessageReceived(m: RemoteMessage) {
        val n = m.notification ?: return
        ensureChannel(this)
        val id = System.currentTimeMillis().toInt()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            m.data.forEach { (k, v) -> putExtra(k, v) }
        }
        val pi = PendingIntent.getActivity(this, id, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(n.title)
            .setContentText(n.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(n.body))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        getSystemService(NotificationManager::class.java).notify(id, notification)
    }

    override fun onNewToken(token: String) {
        val u = FirebaseAuth.getInstance().currentUser ?: return
        CoroutineScope(Dispatchers.IO).launch { runCatching { Repo.saveToken(u.uid, token) } }
    }
}
