@import 'utils.js'
@import 'padding.js'
@import 'spacing.js'
@import 'layers.js'
@import 'symbols.js'


// Global initalised variables from 'context'
var selection, document, plugin, app, iconImage

function onSetUp(context) {
  document = context.document
  plugin = context.plugin
}


// ****************************
//   Plugin command handlers
// ****************************


function applyPadding(context) {
  log('RUN PLUGIN')
  document = context.document

  // From the selections — get the relevent BG layers
  var uniqueLayers = []

  // PADDING
  context.selection.forEach(function(layer) {
    if (layer.isMemberOfClass(MSLayerGroup) || layer.isMemberOfClass(MSArtboardGroup)) {
      uniqueLayers.push(layer)
    } else if (!doesArrayContainSibling(uniqueLayers, layer)) {
      uniqueLayers.push(layer)
    }
  })

  log('From selection, relevant BG layers are...', uniqueLayers)
  var backgrounds = uniqueLayers.map(function(layer) {
    return getBackgroundForLayer(layer)
  })

  var paddingBG = backgrounds.find(function(layer) {
    log('Checking if layer has padding: ' + layer)
    return layerHasPadding(layer)
  })

  log('Existing padding BG layer', paddingBG)

  var currentPadding = paddingBG ? getPaddingFromLayer(paddingBG) : defaultPadding()
  var currentPaddingString = paddingToString(currentPadding)
  log('First padding from selection is...', currentPaddingString)

  var paddingString = context.api().getStringFromUser('Padding', currentPaddingString)
  if (paddingString == nil) {
    log('User cancelled submitting a padding string')
    return
  }

  var padding = paddingFromString(paddingString)
  log('Padding: ', JSON.stringify(padding))

  // Create new Background layers if necessary
  uniqueLayers.forEach(function(layer) {
    var bg = getBackgroundForLayer(layer)
    log('BG layer for: ' + layer.name(), bg)
    if (!bg) {
      // Create a new background if it doesn't have one
      bg = MSShapeGroup.shapeWithRect(NSMakeRect(0, 0, 100, 100))
      bg.style = MSDefaultStyle.defaultStyle()
      bg.name = 'Background'

      var selectedSiblings = siblingsInArray(context.selection, layer)
      log('Creating a new background')

      var frames = selectedSiblings.map(function(layer) {
        return MSRect.rectWithRect(layer.frameForTransforms())
      })

      var frame = MSRect.rectWithUnionOfRects(frames)
      bg.frame().x = frame.x()
      bg.frame().y = frame.y()
      bg.frame().width = frame.width()
      bg.frame().height = frame.height()

      if (layer.isMemberOfClass(MSLayerGroup) || layer.isMemberOfClass(MSArtboardGroup)) {
        log('It\'s a group, so insert the new BG within it')
        layer.insertLayer_atIndex(bg, 0)
      } else {

        var parent = layer.parentGroup()
        if (!parent) return

        if (parent.isMemberOfClass(MSPage) || selectedSiblings.length > 1) {
          log(1, 'All siblings to place in the new group', selectedSiblings)

          var group = MSLayerGroup.new()
          group.setName('Group')
          group.addLayers([bg])

          selectedSiblings.forEach(function(siblingLayer) {
            siblingLayer.removeFromParent()
            group.addLayers([siblingLayer])
          })

          parent.addLayers([group])
        } else {
          parent.insertLayer_atIndex(bg, 0)
        }

        parent.layerDidEndResize()
      }
    }

    savePaddingToLayer(padding, bg)
  })


  // Build a tree map of layers that need updating
  // This includes all parent layer groups
  var treeMap = buildTreeMap(uniqueLayers)
  treeMap.forEach(function(layer){
    updatePaddingAndSpacingForLayer(layer)
  })

  log('DONE!')
}

function applySpacing(context) {
  var layers = context.selection

  // We either selected Groups for spacing, or layers for padding
  var selectedGroupsForSpacing = layers.every(function(layer) {
    return canLayerHaveSpacing(layer)
  })

  log(selectedGroupsForSpacing ? '** Selected layers for spacing' : 'Did not select layers for spacing')
  if (!selectedGroupsForSpacing) {
    var alert = NSAlert.alloc().init()
  	alert.setMessageText("Paddy – Spacing")
  	alert.setInformativeText("Invalid selection! Select only Group layers in order to apply spacing")
  	alert.addButtonWithTitle("Ok")
    return alert.runModal()
  }

  // Existing spacing
  var existingSpacing = layers.find(function(layer) {
    log('Checking if layer has spacing: ' + layer)
    return layerHasSpacing(layer)
  })

  var currentSpacing = existingSpacing ? getSpacingFromLayer(existingSpacing) : defaultSpacing()
  var currentSpacingString = spacingToString(currentSpacing)
  log('First spacing from selection is...', currentSpacingString)

  var spacingString = context.api().getStringFromUser('Spacing', currentSpacingString)
  log('Got spacing string', spacingString)

  if (spacingString == nil) {
    log('User cancelled submitting a spacing string')
    return
  }

  var spacing = spacingFromString(spacingString)
  log(1, 'Will save spacing to layers', JSON.stringify(spacing), layers)

  layers.forEach(function(layer) {
    log(2, 'Will save spacing to layer', layer)
    saveSpacingToLayer(spacing, layer)
  })


  // Build a tree map of layers that need updating
  // This includes all parent layer groups
  var treeMap = buildTreeMap(layers)
  treeMap.forEach(function(layer){
    updatePaddingAndSpacingForLayer(layer)
  })

  log('DONE!')
}

function textChanged(context) {
  log('RUN PLUGIN BECAUSE TEXT CHANGED')
  updatePaddingAndSpacingForLayer(context.actionContext.layer)
}


function selectionChanged(context) {
  startBenchmark()

  // Only run if nothing is now selected
  if (context.actionContext.newSelection.length > 0) return

  log('RUN PLUGIN BECAUSE SELECTION CHANGED')
  document = context.actionContext.document

  // Update the padding for every layer that was previously selected
  log('Update every layer that WAS selected', context.actionContext.oldSelection)

  // All layers that are 'unique' in the sense that they are unique
  // within a set of sibling layers.
  // Therefore, there shouldn't be more than one sibling.
  var uniqueLayers = []
  context.actionContext.oldSelection.forEach(function(layer) {
    // Ignore unique siblings, if it is a Symbol instance, or a layer group
    if (layer.isMemberOfClass(MSSymbolInstance) || layer.isMemberOfClass(MSLayerGroup)) {
      uniqueLayers.push(layer)
    } else if (!doesArrayContainSibling(uniqueLayers, layer)) {
      uniqueLayers.push(layer)
    }
  })

  // Build a tree map of layers that need updating
  // This includes all parent layer groups
  var treeMap = buildTreeMap(uniqueLayers)
  treeMap.forEach(function(layer){
    updatePaddingAndSpacingForLayer(layer)
  })

  endBenchmark()
}


/**
 * Update all padding for Background layers relevant to a layer
 */
function updatePaddingAndSpacingForLayer(layer) {
  if (!layer || layer.isMemberOfClass(MSPage)) return
  log('Updating for layer: ' + layer.name(), layer)

  // GROUPS = Spacing
  if (layer.isMemberOfClass(MSLayerGroup) || layer.isMemberOfClass(MSArtboardGroup) || layer.isMemberOfClass(MSPage)) {

    var bg = getBackgroundForLayer(layer)
    updatePaddingForLayerBG(bg)

    if (layerHasSpacing(layer)) {
      var spacing = getSpacingFromLayer(layer)
      applySpacingToGroup(spacing, layer)
    }

    layer.layerDidEndResize()
  }

  // SYMBOL INSTANCE
  else if (layer.isMemberOfClass(MSSymbolInstance)) {

    updateForSymbolInstance(layer)

    var bg = getBackgroundForLayer(layer)
    updatePaddingForLayerBG(bg)

  }

  // SYMBOL MASTER
  else if (layer.isMemberOfClass(MSSymbolMaster)) {
    var bg = getBackgroundForLayer(layer)
    updatePaddingForLayerBG(bg)

    // Update all the instance of the symbol
    var treeMap = buildTreeMap(layer.allInstances())
    treeMap.forEach(function(layer){
      updatePaddingAndSpacingForLayer(layer)
    })

  }

  // PADDING FROM BACKGROUND
  else {

    var parent = layer.parentGroup()

    if (parent) {
      if (layerHasSpacing(parent)) {
        var spacing = getSpacingFromLayer(parent)
        applySpacingToGroup(spacing, parent)
      }

      parent.layerDidEndResize()
    }

    var bg = getBackgroundForLayer(layer)
    updatePaddingForLayerBG(bg)
  }
}



/**
 * Given a Background layer, update its frame
 * based on the padding stored in its name
 */
function updatePaddingForLayerBG(bg) {
  if (!bg) return

  var padding = getPaddingFromLayer(bg)
  if (!padding) return

  log(2, 'Updating padding for...', bg, JSON.stringify(padding))

  var containerRect = getContainerFrameForBGLayer(bg)

  // Outset the Background's frame – by the amount of Padding
  applyPaddingToLayerWithContainerRect(padding, bg, containerRect)

  // Now that the frame has changed — update the 'selected' frame
  bg.parentGroup().layerDidEndResize()
}
