package app.jenbak.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.jenbak.AppViewModel
import com.google.firebase.auth.ktx.auth
import com.google.firebase.ktx.Firebase

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab("home", "الرئيسية", Icons.Filled.Home),
    Tab("search", "بحث", Icons.Filled.Search),
    Tab("favs", "المفضلة", Icons.Filled.Favorite),
    Tab("account", "حسابي", Icons.Filled.Person)
)

@Composable
fun MainBar(nav: NavController, current: String, accountBadge: Int) {
    NavigationBar {
        TABS.forEach { t ->
            NavigationBarItem(
                selected = t.route == current,
                onClick = {
                    if (t.route != current) {
                        nav.navigate(t.route) {
                            popUpTo("home") { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = {
                    BadgedBox(badge = { if (t.route == "account" && accountBadge > 0) Badge { Text("$accountBadge") } }) {
                        Icon(t.icon, contentDescription = t.label)
                    }
                },
                label = { Text(t.label) }
            )
        }
    }
}

@Composable
fun AppRoot(deepLink: MutableState<String?>, vm: AppViewModel = viewModel()) {
    val nav = rememberNavController()
    val me by vm.user.collectAsStateWithLifecycle()
    // أول فتح بلا حساب: شاشة الترحيب (جوجل أو ضيف). وإلا الرئيسية مباشرة
    val start = remember { if (Firebase.auth.currentUser == null) "welcome" else "home" }
    LaunchedEffect(me == null) {
        val route = nav.currentBackStackEntry?.destination?.route
        if (me == null && route != "welcome") {
            nav.navigate("welcome") { popUpTo(nav.graph.id) { inclusive = true } }
        } else if (me != null && route == "welcome") {
            nav.navigate("home") { popUpTo("welcome") { inclusive = true } }
        }
    }
    val inbox by vm.inbox.collectAsStateWithLifecycle()
    val unread = inbox.count { !it.read }

    // فتح الشاشة المناسبة عند النقر على إشعار
    val link = deepLink.value
    LaunchedEffect(link) {
        when (link) {
            "announcement" -> nav.navigate("news")
            "request" -> nav.navigate(if (vm.user.value?.isGuest == false) "inbox" else "home")
        }
        if (link != null) deepLink.value = null
    }

    val online by vm.online.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        if (!online) {
            Surface(color = MaterialTheme.colorScheme.errorContainer, modifier = Modifier.fillMaxWidth()) {
                Text(
                    "لا يوجد اتصال بالإنترنت — المعروض بيانات محفوظة وقد لا تكون محدّثة",
                    modifier = Modifier.statusBarsPadding().padding(horizontal = 12.dp, vertical = 6.dp).fillMaxWidth(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    textAlign = TextAlign.Center
                )
            }
        }
        Box(Modifier.weight(1f).then(if (!online) Modifier.consumeWindowInsets(WindowInsets.statusBars) else Modifier)) {
    NavHost(nav, startDestination = start) {
        composable("welcome") { WelcomeScreen(vm) }
        composable("home") { HomeScreen(nav, vm, unread) }
        composable("search") { SearchScreen(nav, vm, unread) }
        composable("favs") { FavoritesScreen(nav, vm, unread) }
        composable("account") { AccountScreen(nav, vm, unread) }
        composable("section/{key}", listOf(navArgument("key") { type = NavType.StringType })) { e ->
            SectionScreen(nav, vm, e.arguments?.getString("key") ?: "")
        }
        composable("place/{id}", listOf(navArgument("id") { type = NavType.StringType })) { e ->
            DetailScreen(nav, vm, e.arguments?.getString("id") ?: "")
        }
        composable("news") { NewsScreen(nav, vm) }
        composable("login") { LoginScreen(nav, vm) }
        composable("mine") { MyRequestsScreen(nav, vm) }
        composable("myplaces") { MyPlacesScreen(nav, vm) }
        composable("inbox") { InboxScreen(nav, vm) }
        composable("editor/{mode}/{id}") { e ->
            EditorScreen(nav, vm, e.arguments?.getString("mode") ?: "new", e.arguments?.getString("id") ?: "-")
        }
    }
        }
    }
}
