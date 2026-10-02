package app.jenbak.data

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import app.jenbak.R
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.AuthCredential
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.tasks.await

/** طريقتا الدخول الوحيدتان: ضيف (مجهول) أو حساب جوجل */
object AuthRepo {
    private val auth get() = Firebase.auth

    /** الدخول كضيف: حساب مجهول يتصفح فقط ولا يرسل طلبات */
    suspend fun signInGuest() {
        if (auth.currentUser != null) return
        if (!Net.check()) throw AppException("لا يوجد اتصال بالإنترنت، حاول عند توفره")
        auth.signInAnonymously().await()
    }

    /**
     * الدخول بجوجل. إن كان المستخدم ضيفاً نربط حسابه المجهول بجوجل (يبقى نفس المعرّف)،
     * وإن كان حساب جوجل مسجَّلاً من قبل ندخل به مباشرة.
     */
    suspend fun signInWithGoogle(activity: Activity) {
        if (!Net.check()) throw AppException("لا يوجد اتصال بالإنترنت، حاول عند توفره")
        val credential = googleCredential(activity)
        val current = auth.currentUser
        if (current != null && current.isAnonymous) {
            try {
                current.linkWithCredential(credential).await()
            } catch (e: FirebaseAuthUserCollisionException) {
                auth.signInWithCredential(credential).await()
            }
        } else {
            auth.signInWithCredential(credential).await()
        }
        // قواعد Firestore تقرأ مزوّد الدخول من الرمز، فيجب تحديثه بعد الربط وإلا يبقى «مجهولاً»
        auth.currentUser?.getIdToken(true)?.await()
    }

    private suspend fun googleCredential(activity: Activity): AuthCredential {
        val option = GetSignInWithGoogleOption.Builder(activity.getString(R.string.default_web_client_id)).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        val result = CredentialManager.create(activity).getCredential(activity, request)
        val cred = result.credential
        if (cred is CustomCredential && cred.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            val token = GoogleIdTokenCredential.createFrom(cred.data).idToken
            return GoogleAuthProvider.getCredential(token, null)
        }
        throw AppException("تعذر الدخول بحساب جوجل")
    }
}

fun FirebaseUser?.toMe(): Me? = this?.let {
    Me(
        uid = it.uid,
        isGuest = it.isAnonymous,
        name = it.displayName.orEmpty(),
        email = it.email.orEmpty()
    )
}

/** رسالة عربية مفهومة لأخطاء تسجيل الدخول */
fun Throwable.authMessage(): String = when (this) {
    is GetCredentialCancellationException -> "تم إلغاء تسجيل الدخول"
    is NoCredentialException -> "لا يوجد حساب جوجل على هذا الجهاز، أضف حساباً من إعدادات الهاتف ثم أعد المحاولة"
    is GetCredentialException -> "تعذر الدخول بحساب جوجل، حاول مرة أخرى"
    is AppException -> message ?: "تعذر تسجيل الدخول"
    is FirebaseNetworkException -> "تعذر الاتصال، تحقق من الإنترنت"
    else -> "تعذر تسجيل الدخول، حاول مرة أخرى"
}
