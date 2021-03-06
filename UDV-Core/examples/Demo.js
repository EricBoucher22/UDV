const terrainAndElevationRequest = 'https://download.data.grandlyon.com/wms/grandlyon';

// use this line for distant building server
const buildingServerRequest = 'http://rict.liris.cnrs.fr/UDVDemo/Data/tileset.json';

// if true, replace regular controls by controls adapted to finding precise orientation for documents
// use false for regular controls (generic user)
var useControlsForEditing = false;

// itowns view (3d scene)
var view;
// itowns extent (city limits)
var extent;
// ====================

// Initialization of the renderer, view and extent
[ view, extent ] = udvcore.Setup3DScene(terrainAndElevationRequest,
                                        buildingServerRequest,
                                        true );

// The renderer provided by THREE.js as handled over by itowns
var renderer = view.scene;

// camera starting position (south-west of the city, altitude 2000)
view.camera.setPosition(new udvcore.itowns.Coordinates('EPSG:3946', extent.west(), extent.south(), 2000));
// camera starting orientation (looking at city center)
view.camera.camera3D.lookAt(extent.center().xyz());


// PlanarControls (camera controller) options : regular mode (generic user) or edit mode
// edit mode is more precise but less ergonomic : used to determine precise orientation for documents
// see itowns/src/Renderer/ThreeExtended/PlanarControls.js for options parameters
const optionsRegularMode = {
    maxAltitude : 15000,
    rotateSpeed : 3.0,
    autoTravelTimeMin: 2,
    autoTravelTimeMax: 6,
};
const optionsEditMode= {
    maxAltitude : 17000,
    rotateSpeed : 1.5,
    zoomInFactor : 0.04,
    zoomOutFactor : 0.04,
    maxPanSpeed : 5.0,
    minPanSpeed : 0.01,
    maxZenithAngle: 88,
};

// itowns' PlanarControls (camera controller) uses optionsEditMode or
// optionsRegularMode depending on the value useControlsForEditing (boolean)
var controls = new udvcore.itowns.PlanarControls(view, (useControlsForEditing)? optionsEditMode : optionsRegularMode);

//////////// Temporal controller section

// Retrieve the layer defined in Setup3DScene (we consider the first one
// with the given name)
const $3dTilesTemporalLayer = view.getLayers(layer => layer.name === '3d-tiles-temporal')[0];

// Definition of the callback that is in charge of triggering a refresh
// of the displayed layer when its (the layer) associated date has changed.
function refreshDisplayLayerOnDate( date ) {
  $3dTilesTemporalLayer.displayDate = date;
  view.notifyChange($3dTilesTemporalLayer);
}

// Instanciate a temporal controller
var temporal = new udvcore.TemporalController(
                            refreshDisplayLayerOnDate,
                            {   // Various available constructor options
                                minTime:   new moment( "1700-01-01" ),
                                maxTime:   new moment( "2020-01-01" ),
                                currentTime: new moment().subtract(10, 'years'),
                                timeStep:  new moment.duration( 1, 'years'),
                                // or "YYYY-MMM" for Years followed months
                                timeFormat: "YYYY",
                                active:true
                              });

$3dTilesTemporalLayer.whenReady.then(
  // In order to configure the temporal slide bar widget, we must
  // retrieve the temporal events of displayed data. At this loading
  // stage it could be that the b3dm with the actual dates (down to
  // the building level) are not already loaded, but only their enclosing
  // tiles are at hand. We could recurse on tile hierarchy, but we also
  // have at hand the tileindex that we can (equivalently for the result)
  // iterate on.
  function() {
    // Store the layer for triggering scene updates when temporal slider
    // will be changed by user:
    temporal.layer = $3dTilesTemporalLayer;

    const tiles = $3dTilesTemporalLayer.tileIndex.index;
    var resultDates = [];
    for( var currentTileNb in tiles ) {
      const start = tiles[currentTileNb].boundingVolume.start_date;
      if( start ) {
        resultDates.push( start );
      }
      const end = tiles[currentTileNb].boundingVolume.end_date;
      if( end ) {
        resultDates.push( end );
      }
    }
    // When there is such thing as a minimum and maximum, inform the temporal
    // widget of the data change and refresh the display.
    // Note: when the dataset doesn't have a minimum of two dates the temporal
    // widget remains with its default min/max values.
    if( resultDates.length >= 2 ) {
      resultDates.sort();
      temporal.minTime = new moment( resultDates[0] );
      temporal.maxTime = new moment( resultDates[resultDates.length-1] );
      temporal.changeTime( temporal.minTime );
      temporal.refresh();
    }
  }
);

var about = new udvcore.AboutWindow({active:true});
var help  = new udvcore.HelpWindow({active:true});

//loading configuration file
// see https://github.com/MEPP-team/VCity/wiki/Configuring-UDV
var config;
$.ajax({
  type: "GET",
  url: "data/config/generalDemoConfig.json",
  datatype: "json",
  async: false,
  success: function(data){
    config = data;
  }
});

//The documentcontroller is in charge of handling the views (research, browser)
// based on the parameter documentModel, it builds the browser view (what attribute does
// a document have, what attributes do we want to display and how...)
// The researchModel and optionsResearch parameters are used to build / paramatrize
// the research view
var controller = new udvcore.DocumentController(view, controls, {temporal: temporal}, config);
///////////////////////////////////////////////////////////////////////////////
//// Create and configure the layout controller

// An html container is required in order to control the placement of the
// dat.GUI object within the page.
var datDotGUIDiv = document.createElement("div");
datDotGUIDiv.id = 'datDotGUIDiv';
document.body.appendChild(datDotGUIDiv);

// Associate the stylesheet for layout configuration
var link = document.createElement('link');
link.setAttribute('rel', 'stylesheet');
link.setAttribute('type', 'text/css');
link.setAttribute('href', './Demo.css');
document.getElementsByTagName('head')[0].appendChild(link);

// Proceed with the creation of the dat.GUI with the above positionning
var datDotGUI = new dat.GUI({ autoPlace: false });
datDotGUI.domElement.id = 'datDotGUI';
var datDotGUIContainer = document.getElementById('datDotGUIDiv');
datDotGUIContainer.appendChild( datDotGUI.domElement );

// About subwindow
aboutController = datDotGUI.add( about, 'windowIsActive'
                               ).name( "About" ).listen();
aboutController.onFinishChange( function(value) { about.refresh(); } );

// About subwindow
helpController = datDotGUI.add( help, 'windowIsActive'
                              ).name( "Help" ).listen();
helpController.onFinishChange( function(value) { help.refresh(); });


var temporalActiveCtrl = datDotGUI.add( temporal, 'temporalIsActive'
).name( "Temporal" ).listen();
temporalActiveCtrl.onFinishChange(function(value) {
  temporal.refresh();
});

//Document uses a folder
var documentFolder = datDotGUI.addFolder("Documents");
var docResearch = documentFolder.add( controller.documentResearch, 'windowIsActive'
                                        ).name("Research").listen();
docResearch.onFinishChange(function(value){
  controller.documentResearch.refresh();
});

var browserOption = documentFolder.add( controller.documentBrowser, 'windowIsActive'
                                       ).name("Browser").listen();
browserOption.onFinishChange(function(value){
  controller.documentBrowser.refresh();
});

datDotGUI.close();     // By default the dat.GUI controls are rolled up

// FIXME instanciate guided tour controller
// var guidedtour = new GuidedTourController(documents,'visite.csv',{temporal: temporal, preventUserFromChangingTour : true});

// instanciate minimap controller
var minimap = new udvcore.MiniMapController(controls, extent, renderer);

// instanciate compass controller
var compass = new udvcore.CompassController(controls);
