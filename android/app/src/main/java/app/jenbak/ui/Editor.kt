package app.jenbak.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import app.jenbak.data.*
import kotlinx.coroutines.launch

/** mode: new = نشاط جديد، edit = تعديل نشاط (id = placeId)، retry = إعادة إرسال طلب مرفوض (id = requestId) */
@Composable
fun EditorScreen(nav: NavController, vm: AppViewModel, mode: String, id: String) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val user by vm.user.collectAsStateWithLifecycle()
    val places by vm.places.collectAsStateWithLifecycle()
    val title = if (mode == "edit") "تعديل النشاط" else "إضافة نشاط"

    val me = user
    if (me == null || me.isGuest) {
        SubScaffold(title, { nav.popBackStack() }) { pad ->
            Box(Modifier.padding(pad)) {
                EmptyState("🔐", "سجّل الدخول بحساب جوجل", "الضيف يتصفح فقط، ونحتاج حسابك لنرسل لك نتيجة المراجعة", "تسجيل الدخول") { nav.navigate("login") }
            }
        }
        return
    }

    val place = if (mode == "edit") vm.placeById(id) else null
    val request = if (mode == "retry") vm.requestById(id) else null
    val kind = when (mode) {
        "edit" -> "edit"
        "retry" -> request?.kind ?: "new"
        else -> "new"
    }
    val placeId = when (mode) {
        "edit" -> id
        "retry" -> request?.placeId?.takeIf { it.isNotEmpty() }
        else -> null
    }
    val initial = place?.toDraft() ?: request?.draft ?: Draft()

    var name by rememberSaveable(mode, id) { mutableStateOf(initial.name) }
    var section by rememberSaveable(mode, id) { mutableStateOf(initial.section) }
    var services by rememberSaveable(mode, id) { mutableStateOf(initial.services) }
    var address by rememberSaveable(mode, id) { mutableStateOf(initial.address) }
    var hours by rememberSaveable(mode, id) { mutableStateOf(initial.hours) }
    var phone by rememberSaveable(mode, id) { mutableStateOf(initial.phone) }
    var wa by rememberSaveable(mode, id) { mutableStateOf(initial.whatsapp) }
    var sending by remember { mutableStateOf(false) }

    // القسم الأول افتراضياً للنشاط الجديد
    LaunchedEffect(SECTIONS) { if (section.isBlank() || SECTIONS.none { it.key == section }) section = SECTIONS.firstOrNull()?.key.orEmpty() }
    val valid = name.isNotBlank() && section.isNotBlank() && Phone.valid(phone) && (wa.isEmpty() || Phone.valid(wa))

    SubScaffold(title, { nav.popBackStack() }) { pad ->
        Column(
            Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (kind == "edit") {
                Text("التعديل يُراجع من الإدارة قبل أن يظهر للناس.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("القسم", style = MaterialTheme.typography.titleMedium)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(SECTIONS) { s -> FilterChip(section == s.key, { section = s.key }, { Text(s.title) }) }
            }
            TextBox(name, "اسم النشاط *", 100, { name = it })
            TextBox(services, "الخدمات", 500, { services = it }, singleLine = false)
            TextBox(address, "الموقع / العنوان", 200, { address = it })
            TextBox(hours, "ساعات العمل", 100, { hours = it })
            PhoneField(phone, "رقم الهاتف *", { phone = it })
            PhoneField(wa, "واتساب (اختياري)", { wa = it })
            Text("يُراجع طلبك من الإدارة قبل ظهوره، وسيصلك إشعار بالنتيجة.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(
                enabled = valid && !sending, modifier = Modifier.fillMaxWidth(),
                onClick = {
                    sending = true
                    val draft = Draft(name.trim(), section, services.trim(), address.trim(), hours.trim(), phone, wa)
                    scope.launch {
                        val r = runCatching { Repo.submit(kind, placeId, draft) }
                        sending = false
                        if (r.isSuccess) {
                            ctx.toast("تم إرسال الطلب، سيصلك إشعار بالنتيجة")
                            nav.popBackStack()
                        } else {
                            ctx.toast(r.exceptionOrNull()?.userMessage() ?: "تعذر الإرسال")
                        }
                    }
                }
            ) { Text(if (sending) "جارٍ الإرسال..." else "إرسال الطلب") }
        }
    }
}

@Composable
private fun TextBox(value: String, label: String, max: Int, onChange: (String) -> Unit, singleLine: Boolean = true) {
    OutlinedTextField(
        value = value,
        onValueChange = { onChange(it.take(max)) },
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 3,
        supportingText = { Text("${value.length}/$max") }
    )
}
