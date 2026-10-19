package com.gabrielcat.admob

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

@InvokeArg
class InitArgs {
  var personalized: Boolean = false
}

@InvokeArg
class BannerArgs {
  lateinit var adUnitId: String
  var position: String = "bottom"
}

@InvokeArg
class InterstitialArgs {
  lateinit var adUnitId: String
}

@TauriPlugin
class AdmobPlugin(private val activity: Activity) : Plugin(activity) {
  private var personalized = false
  private var banner: AdView? = null

  private fun buildRequest(): AdRequest {
    val builder = AdRequest.Builder()
    if (!personalized) {
      val extras = Bundle().apply { putString("npa", "1") }
      builder.addNetworkExtrasBundle(AdMobAdapter::class.java, extras)
    }
    return builder.build()
  }

  private fun removeBanner() {
    banner?.let {
      (it.parent as? ViewGroup)?.removeView(it)
      it.destroy()
    }
    banner = null
  }

  @Command
  fun initialize(invoke: Invoke) {
    val args = invoke.parseArgs(InitArgs::class.java)
    personalized = args.personalized
    MobileAds.initialize(activity) { invoke.resolve() }
  }

  @Command
  fun showBanner(invoke: Invoke) {
    val args = invoke.parseArgs(BannerArgs::class.java)
    activity.runOnUiThread {
      removeBanner()
      val view = AdView(activity).apply {
        adUnitId = args.adUnitId
        setAdSize(AdSize.BANNER)
      }
      val vertical = if (args.position == "top") Gravity.TOP else Gravity.BOTTOM
      val params = FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        vertical or Gravity.CENTER_HORIZONTAL
      )
      activity.findViewById<ViewGroup>(android.R.id.content).addView(view, params)
      view.loadAd(buildRequest())
      banner = view

      // En el WebView 1 px CSS = 1 dp, así que la altura en dp sirve tal cual.
      val ret = JSObject()
      ret.put("height", AdSize.BANNER.height)
      invoke.resolve(ret)
    }
  }

  @Command
  fun hideBanner(invoke: Invoke) {
    activity.runOnUiThread {
      removeBanner()
      invoke.resolve()
    }
  }

  @Command
  fun showInterstitial(invoke: Invoke) {
    val args = invoke.parseArgs(InterstitialArgs::class.java)
    activity.runOnUiThread {
      InterstitialAd.load(activity, args.adUnitId, buildRequest(), object : InterstitialAdLoadCallback() {
        override fun onAdLoaded(ad: InterstitialAd) {
          ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() = invoke.resolve()
            override fun onAdFailedToShowFullScreenContent(error: AdError) = invoke.reject(error.message)
          }
          ad.show(activity)
        }

        override fun onAdFailedToLoad(error: LoadAdError) = invoke.reject(error.message)
      })
    }
  }
}
