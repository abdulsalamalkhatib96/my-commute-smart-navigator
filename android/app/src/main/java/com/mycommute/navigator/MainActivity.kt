package com.mycommute.navigator

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Build
import android.view.View
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.geojson.Point
import com.mapbox.maps.MapView
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.maps.plugin.locationcomponent.createDefault2DPuck
import com.mapbox.navigation.base.extensions.applyDefaultNavigationOptions
import com.mapbox.navigation.base.options.NavigationOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.formatter.MapboxDistanceFormatter
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.lifecycle.MapboxNavigationApp
import com.mapbox.navigation.core.lifecycle.MapboxNavigationObserver
import com.mapbox.navigation.core.lifecycle.requireMapboxNavigation
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver
import com.mapbox.navigation.core.trip.session.RouteProgressObserver
import com.mapbox.common.location.Location
import com.mapbox.navigation.tripdata.maneuver.api.MapboxManeuverApi
import com.mapbox.navigation.ui.components.maneuver.view.MapboxManeuverView
import com.mapbox.navigation.voice.api.MapboxAudioGuidance
import com.mapbox.navigation.ui.maps.location.NavigationLocationProvider
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineApi
import com.mapbox.navigation.ui.maps.route.line.api.MapboxRouteLineView
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineApiOptions
import com.mapbox.navigation.ui.maps.route.line.model.MapboxRouteLineViewOptions

/**
 * EXPERIMENTAL NATIVE FOUNDATION.
 * Uses Mapbox map-matched locations and real trip sessions, never simulator mode.
 * Lane arrows, voice turn-by-turn, background-lock field testing and full native UX
 * are intentionally NOT asserted as completed here.
 */
class MainActivity : ComponentActivity() {
    private lateinit var mapView: MapView
    private lateinit var status: TextView
    private lateinit var longitude: EditText
    private lateinit var latitude: EditText
    private lateinit var maneuverView: MapboxManeuverView
    private val preferences by lazy { getSharedPreferences("my_commute", MODE_PRIVATE) }
    private val audioGuidance by lazy { MapboxAudioGuidance.getRegisteredInstance() }
    private val maneuverApi by lazy { MapboxManeuverApi(MapboxDistanceFormatter(navigator.navigationOptions.distanceFormatterOptions)) }
    private var selectedBookmark = "home"
    private var navigating = false
    private var startedAtMs = 0L
    private var initialEtaSeconds = 0.0
    private var requestSerial = 0

    private val locationProvider=NavigationLocationProvider()
    private var origin: Point?=null
    private var initialized=false
    private val routeLineApi=MapboxRouteLineApi(MapboxRouteLineApiOptions.Builder().build())
    private lateinit var routeLineView: MapboxRouteLineView

    private val permissions=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { map ->
        if (map[Manifest.permission.ACCESS_FINE_LOCATION]==true || map[Manifest.permission.ACCESS_COARSE_LOCATION]==true) {
            enableNavigation()
        } else status.text="Location permission required for navigation"
    }
    private val locationObserver=object:LocationObserver {
        override fun onNewRawLocation(rawLocation:Location) {}
        override fun onNewLocationMatcherResult(result:LocationMatcherResult) {
            val position=result.enhancedLocation
            origin=Point.fromLngLat(position.longitude,position.latitude)
            locationProvider.changePosition(position,result.keyPoints)
        }
    }
    private val progressObserver = RouteProgressObserver { progress ->
        if (navigating) {
            val remaining = progress.durationRemaining.toDouble()
            status.text = "الوصول المتوقع خلال ${(remaining / 60).toInt()} دقيقة — ${(progress.distanceRemaining / 1000).toInt()} كم"
            maneuverView.renderManeuvers(maneuverApi.getManeuvers(progress))
            maneuverView.visibility = View.VISIBLE
            if (progress.distanceRemaining < 70.0) stopNavigation()
        }
    }
    private val routesObserver=RoutesObserver { update ->
        if (update.navigationRoutes.isNotEmpty()) {
            routeLineApi.setNavigationRoutes(update.navigationRoutes) { drawing ->
                mapView.mapboxMap.style?.let {routeLineView.renderRouteDrawData(it,drawing)}
            }
            status.text="Route available — confirm junctions on the road"
        }
    }
    private val navigator:MapboxNavigation by requireMapboxNavigation(
        onResumedObserver=object:MapboxNavigationObserver {
            @SuppressLint("MissingPermission")
            override fun onAttached(mapboxNavigation:MapboxNavigation) {
                mapboxNavigation.registerLocationObserver(locationObserver)
                mapboxNavigation.registerRoutesObserver(routesObserver)
                mapboxNavigation.registerRouteProgressObserver(progressObserver)
                if (hasLocationPermission() && navigating) mapboxNavigation.startTripSession(withForegroundService = true)
            }
            override fun onDetached(mapboxNavigation:MapboxNavigation) {
                mapboxNavigation.unregisterLocationObserver(locationObserver)
                mapboxNavigation.unregisterRoutesObserver(routesObserver)
                mapboxNavigation.unregisterRouteProgressObserver(progressObserver)
            }
        },
        onInitialize={MapboxNavigationApp.setup(NavigationOptions.Builder(this).build())}
    )

    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        audioGuidance // Register voice guidance with MapboxNavigationApp.
        mapView=MapView(this)
        routeLineView=MapboxRouteLineView(MapboxRouteLineViewOptions.Builder(this).build())
        mapView.location.apply {
            setLocationProvider(locationProvider)
            locationPuck=createDefault2DPuck()
            enabled=true
        }
        val layout=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL; layoutDirection=View.LAYOUT_DIRECTION_RTL}
        maneuverView=MapboxManeuverView(this).apply {visibility=View.GONE}
        status=TextView(this).apply {text="Experimental native navigator — not yet validated in traffic";textSize=16f;setPadding(20,12,20,12)}
        val row=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL}
        longitude=EditText(this).apply {hint="Destination longitude";inputType=android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED;setSingleLine(true)}
        latitude=EditText(this).apply {hint="Destination latitude";inputType=android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED;setSingleLine(true)}
        row.addView(longitude,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        row.addView(latitude,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        val save=Button(this).apply {text="حفظ الوجهة";setOnClickListener {saveBookmark()}}
        val home=Button(this).apply {text="البيت";setOnClickListener {loadBookmark("home")}}
        val work=Button(this).apply {text="العمل";setOnClickListener {loadBookmark("work")}}
        val start=Button(this).apply {text="ابدأ الملاحة";setOnClickListener {requestRoute()}}
        val stop=Button(this).apply {text="إيقاف GPS والرحلة";setOnClickListener {stopNavigation()}}
        val mute=Button(this).apply {text="كتم الصوت";setOnClickListener {
            if (text == "كتم الصوت") {audioGuidance.mute();text="تشغيل الصوت"}
            else {audioGuidance.unmute();text="كتم الصوت"}
        }}
        layout.addView(status)
        layout.addView(maneuverView)
        layout.addView(home)
        layout.addView(work)
        layout.addView(row)
        layout.addView(save)
        layout.addView(start)
        layout.addView(stop)
        layout.addView(mute)
        layout.addView(mapView,LinearLayout.LayoutParams(-1,0,1f))
        setContentView(layout)
        loadBookmark("home")
        enableNavigation()
    }
    private fun hasLocationPermission() =
        ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED

    private fun loadBookmark(key:String) {
        selectedBookmark=key
        val value=preferences.getString("bookmark_$key","")?.split(',') ?: emptyList()
        longitude.setText(value.getOrNull(0)?.trim().orEmpty())
        latitude.setText(value.getOrNull(1)?.trim().orEmpty())
        status.text=if(key=="home") "الوجهة: البيت" else "الوجهة: العمل"
    }
    private fun saveBookmark() {
        val lng=longitude.text.toString().toDoubleOrNull()
        val lat=latitude.text.toString().toDoubleOrNull()
        if(lng==null||lat==null||!lng.isFinite()||!lat.isFinite()||lng !in -180.0..180.0||lat !in -90.0..90.0) {
            status.text="إحداثيات غير صحيحة"; return
        }
        preferences.edit().putString("bookmark_$selectedBookmark","$lng,$lat").apply()
        status.text="تم حفظ الوجهة محليًا"
    }
    private fun stopNavigation() {
        ++requestSerial
        navigator.setNavigationRoutes(emptyList())
        navigator.stopTripSession()
        val duration=(System.currentTimeMillis()-startedAtMs)/1000
        if(navigating && duration>=120 && initialEtaSeconds>0) {
            val existing=preferences.getString("trip_history","").orEmpty()
            preferences.edit().putString("trip_history",(existing+"$selectedBookmark,$duration,$initialEtaSeconds\n").takeLast(12000)).apply()
        }
        navigating=false
        maneuverView.visibility=View.GONE
        status.text="انتهت الرحلة؛ تم إيقاف الموقع"
    }
    private fun enableNavigation(){
        if(!hasLocationPermission()){
            permissions.launch(
                if(Build.VERSION.SDK_INT>=33)arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.POST_NOTIFICATIONS)
                else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        } else {
            @SuppressLint("MissingPermission")
            navigator.startTripSession(withForegroundService = true)
            status.text="GPS نشط — اختر وجهتك المحفوظة"
        }
    }
    private fun requestRoute(){
        val a=origin
        val lng=longitude.text.toString().toDoubleOrNull()
        val lat=latitude.text.toString().toDoubleOrNull()
        if(a==null||lng==null||lat==null||lng !in -180.0..180.0||lat !in -90.0..90.0){
            status.text="Wait for GPS and enter valid coordinates";return
        }
        if(navigating) {status.text="أنهِ الرحلة الحالية أولًا";return}
        val b=Point.fromLngLat(lng,lat)
        val currentRequest=++requestSerial
        navigator.requestRoutes(RouteOptions.builder().applyDefaultNavigationOptions().coordinatesList(listOf(a,b)).alternatives(true).language("ar").build(),
            object: NavigationRouterCallback {
                override fun onCanceled(routeOptions:RouteOptions,routerOrigin:String){}
                override fun onFailure(reasons:List<RouterFailure>,routeOptions:RouteOptions){status.text="Routing failed"}
                override fun onRoutesReady(routes:List<NavigationRoute>,routerOrigin:String){
                    if(currentRequest!=requestSerial || routes.isEmpty()) return
                    val ordered=routes.sortedBy { it.directionsRoute.duration() }
                    initialEtaSeconds=ordered.first().directionsRoute.duration()
                    startedAtMs=System.currentTimeMillis()
                    navigating=true
                    navigator.setNavigationRoutes(ordered)
                    if (hasLocationPermission()) navigator.startTripSession(withForegroundService = true)
                    status.text="الملاحة نشطة — المسارب حسب بيانات المناورات المتوفرة"
                }
            })
    }
    override fun onDestroy() {
        routeLineApi.cancel()
        maneuverApi.cancel()
        super.onDestroy()
    }
}
