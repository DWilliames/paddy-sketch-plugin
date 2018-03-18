@import 'padding.js'
@import 'autoLayoutLookup.js'

/**
 * Get the container frame for a BG layer
 * That is, the total frame of all siblings
 * taking into account transformations (e.g. rotation etc.)
 */
function getContainerFrameForBGLayer(bg) {
  log(3, 'Getting container frame for background layer', bg)

  // Ignore layer if it is the BG, is an Artboard or has the prefix '-'
  var validLayers = filter(bg.parentGroup().layers(), function(layer) {
    if (layer == bg)
      return false
    if (layer.isMemberOfClass(MSArtboardGroup))
      return false
    if (layer.isMemberOfClass(MSSliceLayer))
      return false
    if (shouldLayerBeIgnored(layer))
      return false
    return true
  })

  // Get the rect for each layer, only if it exists
  var frames = []

  validLayers.forEach(function(layer) {
    var rect = rectForLayer(layer, true)
    if (rect) {
      frames.push(rect)
    }
  })

  return MSRect.rectWithUnionOfRects(frames)
}


// If the layer should be ignored when calculating the rect of a layer
function shouldLayerBeIgnored(layer) {
  if (!layer) return

  if (layer.name().startsWith('-')) {
    
    // Don't ignore if layer is a text layer whose name wasn't manually modified
    if (layer.isMemberOfClass(MSTextLayer) && layer.stringValue() == layer.name()) {
      return false
    }

    return true
  }

  return false
}

// Whether to check for Stack Groups
var takeIntoAccountStackViews = true


// Return the rect for a layer as an MSRect
function rectForLayer(layer, ignoreWithPrefix) {
  if (!layer || (ignoreWithPrefix && shouldLayerBeIgnored(layer))) {
    return
  }

  if (!alCommand || !takeIntoAccountStackViews || !layerIsStackView(layer)) {

    if (layer.isMemberOfClass(MSLayerGroup) && ignoreWithPrefix) {

      var frames = []

      layer.layers().forEach(function(layer) {
        var rect = rectForLayer(layer, true)

        if (rect) {
          frames.push(rect)
        }
      })

      var rect = MSRect.rectWithUnionOfRects(frames)
      rect.x = rect.x() + layer.frame().x()
      rect.y = rect.y() + layer.frame().y()

      return rect
    } else {
      return MSRect.rectWithRect(layer.frameForTransforms())
    }
  }

  // Calculate based on stack view
  var props = alPropertiesForLayer(layer)
  //     ADModelStackView
  // {
  //     align = 5;
  //     isCollapsing = 1;
  //     spacing = 2;
  //     type = 0;
  // }


  var vertical = (props.type == 0) // Else horizontal

  // Filter out hidden layers if StackGroup 'isCollapsing'
  var layers = (props.isCollapsing == 1) ? filter(layer.layers(), function(layer) {
    return layer.isVisible()
  }) : sortedLayers

  // Map each layer to its rect
  var rects = layers.map(function(layer) {
    return rectForLayer(layer, ignoreWithPrefix)
  })

  // Sort the layers
  // Vertical – Top to bottom
  // Horizontal – Left to right
  var sortedRects = rects.sort(function(a, b) {
    if (vertical) {
      return a.y() <= b.y() ? -1 : 1
    } else {
      return a.x() <= b.x() ? -1 : 1
    }
  })

  var frames = []
  sortedRects.forEach(function(rect, index) {

    if (frames.length > 0) {
      var previous = frames[frames.length - 1]

      if (vertical) {
        rect.y = previous.y() + previous.height() + props.spacing
      } else {
        rect.x = previous.x() + previous.width() + props.spacing
      }

    }

    frames.push(rect)
  })

  var unionRect = MSRect.rectWithUnionOfRects(frames)
  var originalRect = MSRect.rectWithRect(layer.frameForTransforms())
  unionRect.y = originalRect.y()
  unionRect.x = originalRect.x()

  return unionRect
}


/**
 * Get the background layer for a given layer (if any)
 */
function getBackgroundForLayer(layer) {
  log(2, 'Get background for layer: ' + layer.name())
  // By default; check the layers siblings
  var layers = layer.parentGroup() ? layer.parentGroup().layers() : null

  // If it's a group or Artboard; check it's children
  if (layer.isMemberOfClass(MSLayerGroup) || layer.isMemberOfClass(MSArtboardGroup) || layer.isMemberOfClass(MSSymbolMaster) || layer.isMemberOfClass(MSPage)) {
    layers = layer.layers()
  } else if (layer.isMemberOfClass(MSSymbolInstance)) {
    // return backgroundLayerForSymbol(layer)
  }

  return getBGCandidateFromLayers(layers)
}


/**
 * Given an array of layers get the best candidate
 * If a layer is already the background layer, then use it
 * Otherwise get the first match that a Shape, or Symbol Instance
 */
function getBGCandidateFromLayers(layers) {
  if (!layers) return

  log(3, 'Getting background candidate from layers', layers)

  var candidate
  var existingBackground = layers.find(function(layer) {
    if (shouldLayerBeIgnored(layer))
      return false

    if (canLayerHavePadding(layer)) {
      if (layerHasPadding(layer)) {
        return true
      } else if (!candidate) {
        candidate = layer
      }
    }

    return false
  })

  log(3, (existingBackground ? 'Existing background: ' + existingBackground.name() : (candidate ? 'New candidate: ' + candidate.name() : 'No candidate')))

  return existingBackground ? existingBackground : candidate
}


/**
 * Returns if the given array contains a sibling to the layer
 */
function doesArrayContainSibling(array, layer) {
  if (!array || !layer) return

  var parent = layer.parentGroup()
  return array.find(function(layer){
    return layer.parentGroup() == parent
  })
}


/**
 * Get all siblings to a given layer
 */
function getSiblingsForLayer(layer) {
  var parent = layer.parentGroup()
  if (!parent) return

  var siblings = []
  parent.layers().forEach(function(child) {
    if (child != layer) {
      siblings.push(child)
    }
  })

  return siblings
}




function containsLayerID(array, element) {
  if (!array || !element) return

  return array.find(function(layer) {
    return (layer == element)
  })
}


function dependentLayersOfLayerIgnoringLayers(layer, objectIDsToIgnore) {
  if (!layer) {
    return
  }

  if (!objectIDsToIgnore) {
    objectIDsToIgnore = []
  }


  // There are no dependents for text layers that are 'fixed'
  if (layer.isMemberOfClass(MSTextLayer) && layer.textBehaviour() == 1) {
    return
  }

  var siblings = getSiblingsForLayer(layer).sort(function(a, b) {
    return a.frameForTransforms().origin.x <= b.frameForTransforms().origin.x ? -1 : 1
  })

  var dependents = []
  siblings.forEach(function(sibling) {

    if (layerHasPadding(sibling)) {
      return
    }

    if (containsLayerID(objectIDsToIgnore, sibling.objectID())) {
      return
    }

    var sFrame = MSRect.rectWithRect(sibling.frameForTransforms())
    var lFrame = MSRect.rectWithRect(layer.frameForTransforms())

    var withinHorizontalBounds = false

    if (sFrame.minY() < lFrame.minY() - 8 || sFrame.maxY() > lFrame.maxY() + 8) {
      // Is not within vertical bounds
      return
    }

    // It's to the left
    var onTheLeft = (sFrame.minX() < lFrame.minX()) && layer.isMemberOfClass(MSTextLayer) && layer.textAlignment() == 1
    var diff = onTheLeft ? (lFrame.minX() - sFrame.maxX()) : (sFrame.minX() - lFrame.maxX())

    // As far as I can tell; this seems to be the specific dimensions for this
    if (diff <= 20 && diff >= 0) {
      objectIDsToIgnore.push(sibling.objectID())

      var additionalDependents = dependentLayersOfLayerIgnoringLayers(sibling, objectIDsToIgnore)
      var dependentValue = {
        objectID: sibling.objectID(),
        xDiff: (onTheLeft ? -diff : diff),
        name: sibling.name(),
        supporter: layer.objectID()
      }

      if (additionalDependents.dependents) {
        dependentValue.dependents = additionalDependents.dependents
      }
      if (additionalDependents.objectIDs) {
        objectIDsToIgnore = additionalDependents.objectIDs
      }

      dependents.push(dependentValue)
    }

  })

  return {
    objectIDs: objectIDsToIgnore,
    dependents: dependents
  }

}


function getAllChildrenForGroup(group) {
  var layers = []

  group.layers().forEach(function(layer) {
    if (layer.isMemberOfClass(MSShapePathLayer)) {
      // Ignore Shape path layers
      return
    }

    layers.push(layer)

    if (layer.isMemberOfClass(MSLayerGroup)) {
      layers = layers.concat(getAllChildrenForGroup(layer))
    }
  })

  return layers
}


/**
 *
 */
function buildTreeMap(layers) {
  log('Building tree map for layers', layers)

  var fullDepthMap = []
  // Based on the selection, let's include all the ancestors of each selected item
  layers.forEach(function(layer) {
    fullDepthMap.push(layer)

    var parent = layer.parentGroup()
    while(parent) {
      fullDepthMap.push(parent)
      parent = parent.parentGroup()
    }
  })

  // Sort the layers based on their depth
  var sorted = fullDepthMap.sort(function(a, b) {
    var aDepth = layerTreeDepth(a)
    var bDepth = layerTreeDepth(b)

    if (aDepth == bDepth) {
      if (a.isMemberOfClass(MSLayerGroup) && b.isMemberOfClass(MSLayerGroup)) {
          return a.objectID().localeCompare(b.objectID())
      } else if (a.isMemberOfClass(MSLayerGroup)) {
        return -1
      } else if (b.isMemberOfClass(MSLayerGroup)) {
        return 1
      }
      return a.objectID().localeCompare(b.objectID())
    }
    return (layerTreeDepth(a) < layerTreeDepth(b) ? 1 : -1)
  })

  // Remove duplicates
  var unique = []
  for(var i = 0; i < sorted.length; i++) {
    var layer = sorted[i]
    var previous = i > 0 ? sorted[i-1] : null

    if (previous != layer) {
      unique.push(layer)
    }
  }

  log('UNIQUE', unique)

  return unique
}


/**
 * Return the 'depth' of a layer, that is, the number of ancestors it has
 */
function layerTreeDepth(layer) {
  var count = 0
  var parent = layer.parentGroup()

  while(parent) {
    count++
    parent = parent.parentGroup()
  }

  return count
}


/**
 * Returns an array of all layers that are siblings to 'layer'
 * from a given array
 */
function siblingsInArray(array, layer) {
  var siblings = []
  array.forEach(function(arrayItem) {
    if (layer.parentGroup() == arrayItem.parentGroup())
      siblings.push(arrayItem)
  })

  return siblings
}


/**
 * Select all the layers
 */
function selectAll(layers) {
  if (!layers) return

  log(2, 'Select all', layers)

  layers.forEach(function(layer) {
    select(layer)
  })
}


/**
 * Unselect all the layers
 */
function unselectAll(layers) {
  if (!layers) return

  log(2, 'Unselect all', layers)

  layers.forEach(function(layer) {
    unselect(layer)
  })
}


/**
 * Unselect the given layer
 */
function unselect(layer) {
  layer.select_byExtendingSelection(false, false)
}


/**
 * Select the given layer
 */
function select(layer) {
  layer.select_byExtendingSelection(true, true)
}


function resizeLayer(layer) {
  // A hack for resizing – just in case Craft's Duplicator is installed
  // Select a 'Fake' layer, so that when we 'resize', the selection is not empty
  var nullLayer = MSLayer.alloc().init()
  nullLayer.name = "PADDY-NULL-LAYER"
  document.currentPage().addLayer(nullLayer)
  nullLayer.select_byExpandingSelection(true, false)

  layer.layerDidEndResize()

  nullLayer.select_byExpandingSelection(false, false)
  nullLayer.removeFromParent()
}

function pixelFitLayer(layer) {
  if (!pixelFit) return

  var frame = layer.frame()
  var x = Math.round(frame.x())
  var y = Math.round(frame.y())
  var width = frame.width()//Math.round(frame.width())
  var height = frame.height()//Math.round(frame.height())


  layer.frame().setRectByIgnoringProportions(NSMakeRect(x, y, width, height))
}
