@import 'utils.js'
@import 'padding.js'
@import 'spacing.js'
@import 'layers.js'
@import 'symbols.js'
@import 'async.js'

// Global initalised variables from 'context'
var selection, document, plugin, app, iconImage, command

function onSetUp(context) {
  document = context.document
  plugin = context.plugin
  command = context.command

  // loadFramework("SketchAsync", "DWSketchAsync")
}

// Used for determining whether to round to 'whole pixels'
var pixelFit = NSUserDefaults.standardUserDefaults().boolForKey('tryToFitToPixelBounds')
var automated = !NSUserDefaults.standardUserDefaults().boolForKey('PaddyNoAutomation')

// ****************************
//   Plugin command handlers
// ****************************

// Debugging all actions
function allActions(context) {
  print(context)
}

function toggleAutomaticUpdating(context) {
  NSUserDefaults.standardUserDefaults().setBool_forKey(automated, 'PaddyNoAutomation')

  automated = !automated

  if (!automated) {
    context.document.showMessage('Paddy automation: disabled ❌')
  } else {
    context.document.showMessage('Paddy automation: enabled ✅')
  }
}

function detachInstance(context) {

  startBenchmark()

  document = context.actionContext.document

  var action = context.actionContext.action

  if (context.action == 'ConvertSymbolOrDetachInstances.begin') {

    var symbolDetails = {}

    // Save the master of the symbol to the action for reference
    if (action.selectedLayers().containsOneLayer()) {
      var layer = action.selectedLayers().firstLayer()

      symbolDetails = {
        master: layer.symbolMaster().objectID(),
        x: layer.frame().x(),
        y: layer.frame().y()
      }
    }

    saveValueWithKeyToDoc(symbolDetails, 'preDetachSymbolMaster')
  } else {
    var masterDetails = getValueWithKeyFromDoc('preDetachSymbolMaster')

    if (!masterDetails || !masterDetails.master) return
    // Let's check if all the Text layers of the Symbol master are 'auto'
    // If so, let's readjust them to auto now
    var masterSymbol = document.documentData().layerWithID(masterDetails.master)
    if (masterSymbol && action.selectedLayers().containsOneLayer()) {
      var allAuto = true

      masterSymbol.children().forEach(function(layer) {
        if (layer.isMemberOfClass(MSTextLayer)) {
          if (allAuto && layer.textBehaviour() == 1) {
            allAuto = false
            return
          }
        }
      })

      if (allAuto) {
        var detachedGroup = action.selectedLayers().firstLayer()

        detachedGroup.children().forEach(function(layer) {
          layer.textBehaviour = 0
        })

        var treeMap = buildTreeMap(getAllChildrenForGroup(detachedGroup))
        treeMap.forEach(function(layer){
          updatePaddingAndSpacingForLayer(layer)
        })

        detachedGroup.frame().setX(masterDetails.x)
        detachedGroup.frame().setY(masterDetails.y)
      }
    }
  }

  endBenchmark()

}

function autoApplyPadding(context) {
  applyPadding(context, false)
}

function promptToApplyPadding(context) {
  applyPadding(context, true)
}

function applyPadding(context, promptUser) {
  log('RUN PLUGIN')
  document = context.document

  var selection = context.selection

  // From the selections — get the relevent BG layers
  var uniqueLayers = []

  // PADDING
  selection.forEach(function(layer) {
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

  var padding = defaultPadding()

  if (promptUser) {
    var currentPadding = paddingBG ? getPaddingFromLayer(paddingBG) : defaultPadding()
    var currentPaddingString = paddingToString(currentPadding)
    log('First padding from selection is...', currentPaddingString)

    var paddingString = context.api().getStringFromUser('Padding', currentPaddingString)
    if (paddingString == nil) {
      log('User cancelled submitting a padding string')
      return
    }

    padding = paddingFromString(paddingString)
  }


  log('Padding: ', JSON.stringify(padding))

  // Create new Background layers if necessary
  uniqueLayers.forEach(function(layer) {
    var bg = getBackgroundForLayer(layer)

    var layerPadding = padding

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

        resizeLayer(parent)

      }

    } else if (!promptUser) {
      layerPadding = getAssumedPaddingForBackgroundLayer(bg)
    }

    savePaddingToLayer(layerPadding, bg)
  })


  // Build a tree map of layers that need updating
  // This includes all parent layer groups
  var treeMap = buildTreeMap(uniqueLayers)
  treeMap.forEach(function(layer){
    updatePaddingAndSpacingForLayer(layer)
  })

  log('DONE!')

  selection.forEach(function(layer) {
    layer.select_byExtendingSelection(true, true)
  })
}

function applySpacing(context) {
  var layers = context.selection

  var selectedGroupsForSpacing = []
  layers.forEach(function(layer) {
    if (canLayerHaveSpacing(layer)) {
      selectedGroupsForSpacing.push(layer)
    }
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
  var existingSpacing = selectedGroupsForSpacing.find(function(layer) {
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

  selectedGroupsForSpacing.forEach(function(layer) {
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

  layers.forEach(function(layer) {
    layer.select_byExtendingSelection(true, true)
  })
}

function textChanged(context) {
  document = MSDocument.currentDocument()
  log('RUN PLUGIN BECAUSE TEXT CHANGED')

  var treeMap = buildTreeMap([context.actionContext.layer])
  treeMap.forEach(function(layer){
    updatePaddingAndSpacingForLayer(layer)
  })
}

// SELECTION

var layers = []

function selectionChanged(context) {

  var newSelection = context.actionContext.newSelection

  if (!automated) {
    COScript.currentCOScript().setShouldKeepAround(false)
    return
  }

  if (PERSISTENT) {
    COScript.currentCOScript().setShouldKeepAround(true)
  }

  layers = []

  startBenchmark()
  document = context.actionContext.document

  // print('Selection changed - OLD/NEW')
  // print(context.actionContext.oldSelection)
  // print(context.actionContext.newSelection)

  if (newSelection.length == 1 && newSelection[0].name() == "PADDY-NULL-LAYER") {
    // The selection was becuase of the 'Null layer' used to resolve Craft's stupid Duplicator conflict!!!

    log('Selected the NULL layer; will reselect', context.actionContext.oldSelection)

    context.actionContext.oldSelection.forEach(function(layer) {
      layer.select_byExpandingSelection(true, true)
    })

    COScript.currentCOScript().setShouldKeepAround(false)
    return
  }


  // Only include layers that had properties change
  // Particularly if their frame or position changed

  // Store the properties of a layer when it is initially selected
  // Then we can see if they changed once the user deselects everything
  var initialSelectedProps = getValueWithKeyFromDoc(previouslySelectedKey)
  if (!initialSelectedProps) initialSelectedProps = {}

  var initialParentProps = getValueWithKeyFromDoc(previousParentKey)
  if (!initialParentProps) initialParentProps = {}

  // Layers that we 'will' need to update next time
  // Keep this here, so that next time the selection is nothing, we can tell which layers need updating
  var persistentLayers = getValueWithKeyFromDoc(persistentLayersKey)
  if (!persistentLayers) persistentLayers = []

  // Only run if nothing is now selected
  if (newSelection.length > 0) {

    var previouslySelectedParentProps = initialParentProps

    initialSelectedProps = {}
    initialParentProps = {}
    persistentLayers = []

    newSelection.forEach(function(layer) {

      var rect = layer.absoluteRect() //rectForLayer(layer)
      var props = {
        frame: {
          x: rect.x(),
          y: rect.y(),
          width: rect.width(),
          height: rect.height()
        },
        name: layer.name()
      }

      if (layer.parentGroup()) {
        props.parent = layer.parentGroup().objectID()
      }

      if (layer.isMemberOfClass(MSSymbolInstance)) {
        props.overrides = layer.overrides()
      }

      initialSelectedProps[layer.objectID()] = props

      if (layer.parentGroup()) {
        var parent = layer.parentGroup()

        var parentLayers = []
        parent.layers().forEach(function(layer) {
          parentLayers.push(layer.objectID())
        })

        initialParentProps[parent.objectID()] = {
          children: parentLayers,
          name: parent.name()
        }

        // Check if siblings have been added
        var previousProps = previouslySelectedParentProps[parent.objectID()]
        if (previousProps) {

          if (!stringArraysEqual(previousProps.children, parentLayers)) {
            // PROBABLY duplicated a layer
            persistentLayers.push(parent.objectID())
            persistentLayers.push(layer.objectID()) // Add the layer too, in case it's a symbol
          }
        }
      }
    })

    log('Initial selected Props', JSON.stringify(initialSelectedProps))

    saveValueWithKeyToDoc(initialSelectedProps, previouslySelectedKey)
    saveValueWithKeyToDoc(initialParentProps, previousParentKey)
    saveValueWithKeyToDoc(persistentLayers, persistentLayersKey)

    return
  }

  log('RUN PLUGIN BECAUSE SELECTION CHANGED')

  var docData = document.documentData()

  // Add persistent layers... that is ones that were probably created from duplication
  persistentLayers.forEach(function(layerID) {
    var layer = docData.layerWithID(layerID)
    layers.push(layer)
    log('Added persistent layer', layer)
  })

  // Update the padding for every layer that was previously selected
  log('Update every layer that WAS selected', context.actionContext.oldSelection)

  context.actionContext.oldSelection.forEach(function(layer) {

    // if (contains(layers, layer)) return

    // var layerProps = initialSelectedProps.objectForKey(layer.objectID())
    var layerProps = initialSelectedProps[layer.objectID()]

    if (layerProps) {
      var frame = layer.absoluteRect()//rectForLayer(layer)

      var previousFrame = layerProps.frame
      var x = previousFrame.x
      var y = previousFrame.y
      var width = previousFrame.width
      var height = previousFrame.height

      var sameOrigin = (x == frame.x() && y == frame.y())
      var sameSize = (width == frame.width() && height == frame.height())

      var parent = layerProps.parent
      var overrides = layerProps.overrides

      if (parent && !layer.parentGroup()) {
        // Doesn't have a parent anymore... must've been deleted
        log(2, 'Do not have a parent anymore', layer)
        layers.push(docData.layerWithID(layerProps.parent))
      } else if (!sameSize) {
        log(2, 'Changed frame size', layer)
        layers.push(layer)
        // Add all it's children, if the layer was a group
        if (layer.isMemberOfClass(MSLayerGroup)) {
          layers = layers.concat(getAllChildrenForGroup(layer))
        }
      } else if (!sameOrigin) {
        log(2, 'Frame changed position', layer)
        layers.push(layer.parentGroup())
      } else if (layerProps.name != layer.name()) {
        log(2, 'Changed name', layer)
        layers.push(layer)
      } else if (layer.isMemberOfClass(MSSymbolInstance) && overrides != layer.overrides()) {
        log(2, 'Changed overrides', layer)
        // Ignore unique siblings, if it is a Symbol instance, or a layer group
        // Only add a symbol, if it actually changed props
        layers.push(layer)
      } else {
        log(2, 'Layer did not change', layer)
      }
    } else {
      log('Layer wasn\'t previously selected... – let\'s add it anyway, just in case')
      layers.push(layer)
    }
  })

  // Reset persistent properties
  saveValueWithKeyToDoc({}, previouslySelectedKey)
  saveValueWithKeyToDoc({}, previousParentKey)
  saveValueWithKeyToDoc([], persistentLayersKey)

  if (layers.length > 0) {
    // Build a tree map of layers that need updating
    // This includes all parent layer groups
    var treeMap = buildTreeMap(layers)
    treeMap.forEach(function(layer){
      updatePaddingAndSpacingForLayer(layer)
    })

  }

  endBenchmark()

  if (PERSISTENT) {
    COScript.currentCOScript().setShouldKeepAround(false)
  }

}


/**
 * Update all padding for Background layers relevant to a layer
 */
function updatePaddingAndSpacingForLayer(layer) {
  if (!layer) return
  log('Updating for layer: ' + layer.name(), layer)

  // Ignore Pages, if they have artboards
  if (layer.isMemberOfClass(MSPage) && layer.cachedArtboards() && layer.cachedArtboards().length > 0) {
    return
  }

  // GROUPS = Spacing
  if (layer.isMemberOfClass(MSLayerGroup) || layer.isMemberOfClass(MSArtboardGroup) || layer.isMemberOfClass(MSPage)) {

    if (layerHasSpacing(layer)) {
      var spacing = getSpacingFromLayer(layer)
      applySpacingToGroup(spacing, layer)
    }

    var bg = getBackgroundForLayer(layer)
    updatePaddingForLayerBG(bg)

  }

  // SYMBOL INSTANCE
  else if (layer.isMemberOfClass(MSSymbolInstance)) {

    runOnMainThread(function(){
      updateForSymbolInstance(layer)

      var bg = getBackgroundForLayer(layer)
      updatePaddingForLayerBG(bg)
    })


  }

  // SYMBOL MASTER
  else if (layer.isMemberOfClass(MSSymbolMaster)) {

    // Let's ignore 'Symbol Masters' for Now – I need to figure out a better approach
    return

    runOnMainThread(function(){
      var bg = getBackgroundForLayer(layer)
      if (bg) {
        updatePaddingForLayerBG(bg)
      } else {
        bg = backgroundLayerForSymbol(layer)
        log(1, 'Getting alternate bg', bg)
      }

      if (!bg) return

      var complete = 0
      var total = layer.allInstances().count()

      var updateInstances = true

      if (total >= 10) {
        // if there are more than 10 to update... ask the user if this is what they want to do

        var iconImage = NSImage.alloc().initByReferencingFile(plugin.urlForResourceNamed("icon.png").path())

        var alert = NSAlert.alloc().init()
        var title = 'Update padding for all ' + total + ' instances?'
        var message = 'There\'s ' + total + ' instances of this symbol that should have their padding recalculated – do you want to do this now? \n\nIt can take up to a couple of minutes if there are quite a lot.'

        alert.setIcon(iconImage)
      	alert.setMessageText(title)
      	alert.setInformativeText(message)
      	alert.addButtonWithTitle("Update now")
      	alert.addButtonWithTitle("Do it later")

        updateInstances = (alert.runModal() == '1000')
      }


      if (updateInstances && total > 0) {
        // Said 'Do it now'
        // Update all the instance of the symbol
        var treeMap = buildTreeMap(layer.allInstances())

        treeMap.forEach(function(layer){
          updatePaddingAndSpacingForLayer(layer)
          complete++
        })

        var updatedMessage = 'Paddy: updated ' + total + ' instance'
        if (total > 1) {
          updatedMessage += 's'
        }

        document.showMessage(updatedMessage)
      }

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
  log(1, 'Updating padding with BG', bg)
  if (!bg) {
    // Craft duplicate alert would appear now!
    return
  }

  var padding = getPaddingFromLayer(bg)
  // Craft duplicate alert would appear now!
  if (!padding) return

  log(2, 'Updating padding for...', bg, JSON.stringify(padding))

  var containerRect = getContainerFrameForBGLayer(bg)

  // Outset the Background's frame – by the amount of Padding
  applyPaddingToLayerWithContainerRect(padding, bg, containerRect)

  // Now that the frame has changed — update the 'selected' frame
  resizeLayer(bg.parentGroup())
}
