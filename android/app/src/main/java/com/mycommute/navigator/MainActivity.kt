package com.mycommute.navigator

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
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
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.lifecycle.MapboxNavigationApp
import com.mapbox.navigation.core.lifecycle.MapboxNavigationObserver
import com.mapbox.navigation.core.lifecycle.requireMapboxNavigation
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver
import com.mapbox.common.location.Location
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
                if (hasLocationPermission())mapboxNavigation.startTripSession()
            }
            override fun onDetached(mapboxNavigation:MapboxNavigation) {
                mapboxNavigation.unregisterLocationObserver(locationObserver)
                mapboxNavigation.unregisterRoutesObserver(routesObserver)
            }
        },
        onInitialize={MapboxNavigationApp.setup(NavigationOptions.Builder(this).build())}
    )

    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        mapView=MapView(this)
        routeLineView=MapboxRouteLineView(MapboxRouteLineViewOptions.Builder(this).build())
        mapView.location.apply {
            setLocationProvider(locationProvider)
            locationPuck=createDefault2DPuck()
            enabled=true
        }
        val layout=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL}
        status=TextView(this).apply {text="Experimental native navigator — not yet validated in traffic";textSize=16f;setPadding(20,12,20,12)}
        val row=LinearLayout(this).apply {orientation=LinearLayout.HORIZONTAL}
        longitude=EditText(this).apply {hint="Destination longitude";inputType=android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED;setSingleLine(true)}
        latitude=EditText(this).apply {hint="Destination latitude";inputType=android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL or android.text.InputType.TYPE_NUMBER_FLAG_SIGNED;setSingleLine(true)}
        row.addView(longitude,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        row.addView(latitude,LinearLayout.LayoutParams(0,LinearLayout.LayoutParams.WRAP_CONTENT,1f))
        val start=Button(this).apply {text="Find route";setOnClickListener {requestRoute()}}
        val stop=Button(this).apply {text="Stop";setOnClickListener {navigator.setNavigationRoutes(emptyList());status.text="Stopped"}}
        layout.addView(status)
        layout.addView(row)
        layout.addView(start)
        layout.addView(stop)
        layout.addView(mapView,LinearLayout.LayoutParams(-1,0,1f))
        setContentView(layout)
        enableNavigation()
    }
    private fun hasLocationPermission() =
        ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED

    private fun enableNavigation(){
        if(!hasLocationPermission()){
            permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.POST_NOTIFICATIONS))
        } else {
            @SuppressLint("MissingPermission")
            navigator.startTripSession()
            status.text="GPS active. Enter your destination coordinates."
        }
    }
    private fun requestRoute(){
        val a=origin
        val lng=longitude.text.toString().toDoubleOrNull()
        val lat=latitude.text.toString().toDoubleOrNull()
        if(a==null||lng==null||lat==null||lng !in -180.0..180.0||lat !in -90.0..90.0){
            status.text="Wait for GPS and enter valid coordinates";return
        }
        val b=Point.fromLngLat(lng,lat)
        navigator.requestRoutes(RouteOptions.builder().applyDefaultNavigationOptions().coordinatesList(listOf(a,b)).build(),
            object: NavigationRouterCallback {
                override fun onCanceled(routeOptions:RouteOptions,routerOrigin:String){}
                override fun onFailure(reasons:List<RouterFailure>,routeOptions:RouteOptions){status.text="Routing failed"}
                override fun onRoutesReady(routes:List<NavigationRoute>,routerOrigin:String){
                    if(routes.isNotEmpty())navigator.setNavigationRoutes(routes)
                }
            })
    }
}
