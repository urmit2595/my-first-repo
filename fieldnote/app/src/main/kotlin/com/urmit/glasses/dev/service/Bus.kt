package com.urmit.glasses.dev.service

import kotlinx.coroutines.flow.MutableStateFlow

/** Session state machine states, build brief §4.1. */
enum class SessionState { DISARMED, STANDBY, WAKING, CAPTURING, LISTENING, ANALYSING, SPEAKING, HELD, RECOVERING }

enum class Mode { TAP, WAKE_WORD }

/** What screens observe. The service is the only writer. */
object Bus {
    val state = MutableStateFlow(SessionState.DISARMED)
    val mode = MutableStateFlow(Mode.TAP)
    val armedSince = MutableStateFlow(0L)
    val lastCaptureKey = MutableStateFlow<String?>(null)
    val lastAnswer = MutableStateFlow("")
    val lastError = MutableStateFlow("")
    val controlsPausedByOtherApp = MutableStateFlow(false)
    val wakeWordEndsAt = MutableStateFlow(0L)
    /** "safe to lock" checks: service running, media session active, mic route available, permissions. */
    val checks = MutableStateFlow<List<Pair<String, Boolean>>>(emptyList())
    /** Test A: media key events seen in the current test window. */
    val mediaEvents = MutableStateFlow<List<String>>(emptyList())
    /** Test B: capture timings. */
    val captureTimings = MutableStateFlow<List<CaptureTiming>>(emptyList())
    val toast = MutableStateFlow<String?>(null)
}
