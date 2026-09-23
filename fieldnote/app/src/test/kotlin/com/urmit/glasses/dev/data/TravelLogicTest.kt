package com.urmit.glasses.dev.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class TravelLogicTest {
    private val rates = RateTable("INR", 1_790_035_351_000, "test", mapOf("JPY" to 1.6442, "EUR" to 0.00913, "THB" to 0.3700))

    @Test fun convertsThroughTheBase() {
        assertEquals(608.19, rates.convert(1000.0, "JPY", "INR")!!, 0.01)
        assertEquals(1000.0 / 1.6442 * 0.00913, rates.convert(1000.0, "JPY", "EUR")!!, 1e-9)
        assertEquals(250.0, rates.convert(250.0, "INR", "INR")!!, 0.0)
        assertNull(rates.convert(10.0, "XYZ", "INR"))
    }

    @Test fun formatsMoneyForScreenAndSpeech() {
        assertEquals("₹1,234", Money.fmt(1234.0, "INR"))
        // Lakh grouping ("₹1,23,456") comes from ICU on the phone; the JVM's DecimalFormat can't express it, so it isn't asserted here.
        assertEquals("¥1,200", Money.fmt(1200.0, "JPY"))
        assertEquals("THB 35.50", Money.fmt(35.5, "THB"))
        assertEquals("12.50 euros", Money.spoken(12.5, "EUR"))
        assertEquals("1,200 yen", Money.spoken(1200.0, "JPY"))
        assertEquals("730 rupees", Money.spoken(729.8, "INR"))
    }

    @Test fun convertsMenuPriceTokensOnThePhone() {
        val out = Money.annotate("Ramen {{1200}}, beer {{600}}.", "JPY", "INR", rates)
        assertEquals("Ramen 1,200 yen (about 730 rupees), beer 600 yen (about 365 rupees).", out)
        assertEquals("Crêpe 12.50 euros (about 1,369 rupees).", Money.annotate("Crêpe {{12.50 EUR}}.", "JPY", "INR", rates))
        assertEquals("Tea 40 rupees.", Money.annotate("Tea {{40 INR}}.", "JPY", "INR", rates))
        // No rate saved: keep the local amount, never invent a conversion.
        assertEquals("Ramen 1,200 yen.", Money.annotate("Ramen {{1200}}.", "JPY", "INR", null))
        assertEquals("No tokens here.", Money.annotate("No tokens here.", "JPY", "INR", rates))
        // A decimal comma is not a thousands separator.
        assertEquals("Crêpe 12.50 euros (about 1,369 rupees).", Money.annotate("Crêpe {{12,50 EUR}}.", "JPY", "INR", rates))
        assertEquals("Menu 1,200 yen (about 730 rupees).", Money.annotate("Menu {{1,200}}.", "JPY", "INR", rates))
    }

    @Test fun speaksPricesWithTotalsAndNotes() {
        val p = TravelAnalyst.PriceRead("JPY", listOf(TravelAnalyst.PriceLine("Matcha latte", 580.0)), 580.0, "Tax included.")
        val s = TravelAnalyst.speakPrices(p, "INR", rates.copy(at = System.currentTimeMillis()))
        assertTrue(s, s.startsWith("The total is 580 yen (about 353 rupees)."))
        assertTrue(s, s.contains("Tax included."))
        assertEquals("I couldn't find a price in that photo.", TravelAnalyst.speakPrices(TravelAnalyst.PriceRead("JPY", emptyList(), null, ""), "INR", rates))
        assertTrue(TravelAnalyst.speakPrices(p.copy(currency = "KRW"), "INR", rates).contains("no exchange rate for KRW"))
    }

    @Test fun readsBookingTimesInThePlacesOwnZone() {
        val tokyo = ZonedDateTime.of(2026, 10, 3, 14, 5, 0, 0, ZoneId.of("Asia/Tokyo")).toInstant().toEpochMilli()
        assertEquals(tokyo, TravelAnalyst.epoch("2026-10-03T14:05", "Asia/Tokyo"))
        assertEquals(tokyo, TravelAnalyst.epoch("2026-10-03T14:05:00", "Asia/Tokyo"))
        val noon = ZonedDateTime.of(2026, 10, 3, 12, 0, 0, 0, ZoneId.of("Asia/Tokyo")).toInstant().toEpochMilli()
        assertEquals(noon, TravelAnalyst.epoch("2026-10-03", "Asia/Tokyo"))
        assertEquals(0L, TravelAnalyst.epoch("", "Asia/Tokyo"))
        assertEquals(0L, TravelAnalyst.epoch("next Tuesday", "Asia/Tokyo"))
        // Unknown zone falls back to the phone's zone rather than failing.
        assertTrue(TravelAnalyst.epoch("2026-10-03T14:05", "Mars/Olympus") > 0)
    }

    @Test fun recoversJsonFromChattyModels() {
        assertEquals(1, TravelAnalyst.parseJson("```json\n{\"a\":1}\n```").getInt("a"))
        assertEquals(2, TravelAnalyst.parseJson("Here you go: {\"a\":2} Hope that helps").getInt("a"))
        assertTrue(runCatching { TravelAnalyst.parseJson("no json at all") }.exceptionOrNull() is AnalystError)
    }

    @Test fun emergencyNumbersReadNaturally() {
        assertEquals("Police 110, ambulance and fire 119", OfflinePack.emergency("jp")!!.spoken)
        assertEquals("All emergencies 112", OfflinePack.emergency("FR")!!.spoken)
        assertEquals("All emergencies 112, police 100, ambulance 108, fire 101", OfflinePack.emergency("IN")!!.spoken)
        assertNull(OfflinePack.emergency("ZZ"))
    }

    @Test fun ratesRefreshByFetchTimeNotPublicationTime() {
        val t = RateTable("INR", 1_000L, "p", mapOf("JPY" to 1.6), fetched = 2_000L)
        val back = RateTable.from(t.toJson())
        assertEquals(1_000L, back.at); assertEquals(2_000L, back.fetched)
        // Tables saved by earlier builds have no fetch time: fall back to the publication time.
        assertEquals(1_000L, RateTable.from(t.toJson().apply { remove("fetched") }).fetched)
    }

    @Test fun offlineSearchMatchesWordsAndStems() {
        val w = Search.words("where did I park the scooter")
        assertTrue("park" in w && "scooter" in w && "where" !in w)
        assertTrue(Search.score(w, "Parking bay B4, level 2, next to the scooters") >= 2)
        assertEquals(0, Search.score(w, "Hotel breakfast from 7"))
    }
}
