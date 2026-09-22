package com.urmit.glasses.dev

import android.app.Application
import com.meta.wearable.dat.core.Wearables
import com.urmit.glasses.dev.data.Diagnostics
import com.urmit.glasses.dev.data.Repo

class FieldnoteApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Wearables.initialize(this)
        Repo.get(this).recoverInterrupted()
        Diagnostics.get(this).event("app_opened")
    }
}
