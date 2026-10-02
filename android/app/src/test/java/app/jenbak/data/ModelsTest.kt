package app.jenbak.data

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Test

class ModelsTest {
    @After fun resetSections() { SectionStore.all = emptyList() }

    private fun place(id: String, name: String, section: String = "shops", services: String = "", address: String = "") =
        Place(id, name, section, services, address, "", "0912345678", "", "approved", "", 0L)

    @Test fun normalize_unifiesHamzaTaaAndYaa() {
        assertEquals(normalizeAr("صيدلية"), normalizeAr("صيدليه"))
        assertEquals("احمد", normalizeAr("أحمد"))
        assertEquals("اسعاف", normalizeAr("إسعاف"))
        assertEquals("علي", normalizeAr("على"))
    }

    @Test fun normalize_removesDiacriticsAndTatweel() {
        assertEquals("المدرسه", normalizeAr("المَدْرَسَةُ"))
        assertEquals("نور", normalizeAr("نـــور"))
    }

    @Test fun normalize_convertsDigitsAndSpaces() {
        assertEquals("0912", normalizeAr("٠٩١٢"))
        assertEquals("a b", normalizeAr("  A   B "))
    }

    @Test fun phone_validation() {
        assertTrue(Phone.valid("0912345678"))
        assertFalse(Phone.valid("912345678"))
        assertFalse(Phone.valid("09123456789"))
        assertFalse(Phone.valid("09123abc78"))
    }

    @Test fun phone_formats() {
        assertEquals("091", Phone.latin("٠٩١"))
        assertEquals("+249912345678", Phone.e164("0912345678"))
        assertEquals("249912345678", Phone.intl("0912345678"))
        assertEquals("249912345678", Phone.intl("249912345678"))
    }

    @Test fun search_matchesRegardlessOfSpelling() {
        val all = listOf(place("1", "صيدلية الأمل"), place("2", "مخبز النور"))
        assertEquals(listOf("1"), searchPlaces(all, "صيدليه", null).map { it.id })
        assertEquals(listOf("1"), searchPlaces(all, "الامل", null).map { it.id })
    }

    @Test fun search_requiresAllWords() {
        val all = listOf(place("1", "صيدلية الأمل"), place("2", "صيدلية النور"))
        assertEquals(listOf("2"), searchPlaces(all, "صيدلية نور", null).map { it.id })
        assertTrue(searchPlaces(all, "صيدلية الشفاء", null).isEmpty())
    }

    @Test fun search_ranksNameMatchesBeforeServiceMatches() {
        val all = listOf(
            place("b", "مخبز النور", services = "خبز وصيدلية صغيرة"),
            place("a", "صيدلية الأمل")
        )
        assertEquals(listOf("a", "b"), searchPlaces(all, "صيدلية", null).map { it.id })
    }

    @Test fun search_filtersBySectionAndSortsWhenQueryEmpty() {
        val all = listOf(
            place("1", "ب", section = "shops"),
            place("2", "أ", section = "shops"),
            place("3", "ج", section = "crafts")
        )
        assertEquals(listOf("2", "1"), searchPlaces(all, "", "shops").map { it.id })
        assertEquals(listOf("3"), searchPlaces(all, "ج", "crafts").map { it.id })
    }

    @Test fun searchText_includesAddressAndSectionTitle() {
        SectionStore.all = listOf(Section("shops", "المحلات", Color(0xFFD97706), ""))
        val p = place("1", "نور", services = "بقالة", address = "السوق")
        assertTrue(p.searchText.contains("بقاله"))
        assertTrue(p.searchText.contains("السوق"))
        assertTrue(p.searchText.contains(normalizeAr("المحلات")))
    }

    @Test fun sections_startEmpty_andComeOnlyFromStore() {
        assertTrue(SECTIONS.isEmpty())
        assertEquals(null, sectionOf("shops"))
        SectionStore.all = listOf(Section("shops", "المحلات", Color(0xFFD97706), ""))
        assertEquals("shops", sectionOf("shops")?.key)
    }

    @Test fun parseHexColor_validAndFallback() {
        assertEquals(Color(0xFFD97706), parseHexColor("#D97706"))
        assertEquals(Color.Gray, parseHexColor("nope"))
        assertEquals(Color.Gray, parseHexColor("#12"))
    }
}
