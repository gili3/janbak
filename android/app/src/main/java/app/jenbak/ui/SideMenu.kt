package app.jenbak.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.DrawerState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavController
import app.jenbak.AppViewModel
import kotlinx.coroutines.launch

/** زر فتح القائمة الجانبية لشريط الأدوات في الشاشات الرئيسية */
@Composable
fun MenuButton(drawer: DrawerState) {
    val scope = rememberCoroutineScope()
    IconButton({ scope.launch { drawer.open() } }) {
        Icon(Icons.Filled.Menu, contentDescription = "القائمة")
    }
}

/**
 * القائمة الجانبية: المكان الوحيد في التطبيق لإضافة نشاط، وفيها أيضاً طلباتي والإعلانات.
 * تُفتح بزر القائمة أو بالسحب من الحافة، وتُغلق بزر الرجوع.
 */
@Composable
fun SideMenu(nav: NavController, vm: AppViewModel, drawer: DrawerState, content: @Composable () -> Unit) {
    val scope = rememberCoroutineScope()
    val cfg by vm.settings.collectAsStateWithLifecycle()
    val reqs by vm.myRequests.collectAsStateWithLifecycle()
    val news by vm.news.collectAsStateWithLifecycle()
    val pending = reqs.count { it.status == "pending" }

    BackHandler(enabled = drawer.isOpen) { scope.launch { drawer.close() } }

    /** يغلق القائمة ثم ينفّذ الإجراء */
    fun go(action: () -> Unit) {
        scope.launch { drawer.close() }
        action()
    }

    ModalNavigationDrawer(
        drawerState = drawer,
        drawerContent = {
            ModalDrawerSheet {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    Text(
                        "جنبك",
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 28.dp)
                    )
                    Text(
                        cfg.tagline,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 4.dp, bottom = 16.dp)
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Spacer(Modifier.height(12.dp))

                    NavigationDrawerItem(
                        label = { Text("أضف نشاطك") },
                        icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                        selected = true,
                        onClick = { go { startAdd(nav, vm) } },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                    )
                    NavigationDrawerItem(
                        label = { Text("طلباتي") },
                        icon = { Text("📋") },
                        badge = { if (pending > 0) Text("$pending") },
                        selected = false,
                        onClick = { go { nav.navigate("mine") } },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                    )
                    NavigationDrawerItem(
                        label = { Text("الإعلانات") },
                        icon = { Text("📢") },
                        badge = { if (news.isNotEmpty()) Text("${news.size}") },
                        selected = false,
                        onClick = { go { nav.navigate("news") } },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                    )
                    Spacer(Modifier.height(12.dp))
                }
            }
        },
        content = content
    )
}
